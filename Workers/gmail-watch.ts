import { timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from './db.ts';
import { openGmailTokens, sealGmailTokens } from './gmail-token.ts';
import { analyzeEmails } from './extractor/ai-service.ts';
import { GmailService } from './extractor/gmail-service.ts';
import type { GmailTokens, SubscriptionResult } from './extractor/types.ts';

type PushEnvelope = {
  message?: { data?: string; messageId?: string; message_id?: string };
};

export function decodeGmailPush(body: unknown): { eventId: string; emailAddress: string; historyId: string } {
  const envelope = body && typeof body === 'object' ? body as PushEnvelope : {};
  const eventId = envelope.message?.messageId || envelope.message?.message_id || '';
  if (!eventId || !envelope.message?.data) throw new Error('Invalid Pub/Sub message.');
  let payload: unknown;
  try { payload = JSON.parse(Buffer.from(envelope.message.data, 'base64').toString('utf8')); }
  catch { throw new Error('Invalid Gmail notification payload.'); }
  const value = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const emailAddress = typeof value.emailAddress === 'string' ? value.emailAddress.toLowerCase() : '';
  const historyId = typeof value.historyId === 'string' ? value.historyId : '';
  if (!emailAddress || !/^\d+$/.test(historyId)) throw new Error('Incomplete Gmail notification payload.');
  return { eventId, emailAddress, historyId };
}

export function webhookTokenIsValid(received: unknown): boolean {
  const expected = process.env.GMAIL_WEBHOOK_TOKEN;
  if (!expected || typeof received !== 'string') return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizeMerchant(value: string): string {
  return value.toLowerCase().replace(/\b(premium|plus|pro|subscription|billing|receipt|invoice|inc|ltd|llc)\b/g, '').replace(/[^a-z0-9]/g, '');
}

function dateOrNull(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) ? date : null;
}

async function storeAnalysis(userEmail: string, result: SubscriptionResult): Promise<void> {
  if (result.tag === 'cancellation') {
    const pending = await prisma.reviewCandidate.findMany({ where: { userEmail, status: 'pending' } });
    const merchant = normalizeMerchant(result.serviceName);
    const matches = pending.filter((item) => merchant && normalizeMerchant(item.serviceName) === merchant).map((item) => item.id);
    if (matches.length) {
      await prisma.reviewCandidate.updateMany({ where: { id: { in: matches } }, data: { status: 'superseded' } });
    }
    return;
  }
  const alreadySaved = await prisma.subscription.findUnique({
    where: { userEmail_source_sourceId: { userEmail, source: 'gmail', sourceId: result.emailId } },
    select: { id: true },
  });
  if (alreadySaved) return;
  await prisma.reviewCandidate.upsert({
    where: { userEmail_emailId: { userEmail, emailId: result.emailId } },
    update: {
      subject: result.subject, sender: result.from, receivedAt: new Date(result.timestamp), tag: result.tag,
      serviceName: result.serviceName, amount: result.amount, billingFrequency: result.billingFrequency,
      renewalOrEndDate: dateOrNull(result.renewalOrEndDate), summary: result.summary,
      evidence: result.evidence as Prisma.InputJsonValue | undefined,
      merchantInference: result.merchantInference,
      renewalEstimate: result.renewalEstimate as Prisma.InputJsonValue | undefined,
      status: 'pending',
    },
    create: {
      userEmail, emailId: result.emailId, subject: result.subject, sender: result.from,
      receivedAt: new Date(result.timestamp), tag: result.tag, serviceName: result.serviceName,
      amount: result.amount, billingFrequency: result.billingFrequency,
      renewalOrEndDate: dateOrNull(result.renewalOrEndDate), summary: result.summary,
      evidence: result.evidence as Prisma.InputJsonValue | undefined,
      merchantInference: result.merchantInference,
      renewalEstimate: result.renewalEstimate as Prisma.InputJsonValue | undefined,
    },
  });
}

async function analyzeMessageIds(userEmail: string, gmail: GmailService, messageIds: string[]): Promise<void> {
  let eligibleCount = 0;
  let findingCount = 0;
  for (let offset = 0; offset < messageIds.length; offset += 8) {
    const fetched = await Promise.allSettled(messageIds.slice(offset, offset + 8).map((id) => gmail.getMessageDetails(id)));
    const emails = fetched.flatMap((item) => item.status === 'fulfilled' && item.value.labels.includes('INBOX') && !item.value.labels.includes('CATEGORY_PROMOTIONS') ? [item.value] : []);
    eligibleCount += emails.length;
    for (const analysis of await analyzeEmails(emails)) {
      if (analysis.result) { await storeAnalysis(userEmail, analysis.result); findingCount++; }
    }
  }
  console.info('[Gmail monitor]', { userEmail, changedMessages: messageIds.length, eligibleMessages: eligibleCount, findings: findingCount });
}

function fallbackIntervalMs(): number {
  const configured = Number(process.env.GMAIL_FALLBACK_INTERVAL_MS);
  return Number.isFinite(configured)
    ? Math.max(30_000, Math.min(configured, 60 * 60 * 1000))
    : process.env.GMAIL_PUBSUB_TOPIC ? 15 * 60 * 1000 : 60_000;
}

async function processEvent(eventId: string): Promise<void> {
  const event = await prisma.gmailWebhookEvent.findUnique({ where: { id: eventId } });
  if (!event || event.status === 'completed') return;
  const connection = await prisma.gmailConnection.findUnique({ where: { gmailEmail: event.emailAddress }, include: { owner: { select: { monitoringPaused: true } } } });
  if (!connection) {
    await prisma.gmailWebhookEvent.update({ where: { id: eventId }, data: { status: 'ignored', lastError: 'No Gmail connection for this mailbox.' } });
    return;
  }
  if (connection.owner.monitoringPaused) {
    await prisma.gmailWebhookEvent.update({ where: { id: eventId }, data: { status: 'paused', lastError: 'Live monitoring is paused by the user.' } });
    return;
  }
  const tokens = openGmailTokens(connection.sealedTokens);
  if (!tokens) throw new Error('Stored Gmail credentials could not be opened. Reconnect Gmail.');
  const gmail = new GmailService(tokens);
  const startHistoryId = connection.historyId;
  if (!startHistoryId) {
    await prisma.gmailConnection.update({ where: { gmailEmail: event.emailAddress }, data: { historyId: event.historyId, lastSyncAt: new Date() } });
    await prisma.gmailWebhookEvent.update({ where: { id: eventId }, data: { status: 'completed' } });
    return;
  }
  let history: { messageIds: string[]; historyId: string };
  try {
    history = await gmail.listHistory(startHistoryId);
  } catch (error) {
    const status = (error as { code?: number; response?: { status?: number } })?.response?.status ?? (error as { code?: number })?.code;
    if (status !== 404) throw error;
    // Gmail can expire old history cursors. Reconcile a bounded recent window,
    // then resume incremental history from the mailbox's current cursor.
    const [messageIds, profile] = await Promise.all([
      gmail.listMessageIds('newer_than:7d in:inbox -category:promotions', undefined, ['INBOX']),
      gmail.getProfile(),
    ]);
    history = { messageIds, historyId: profile.historyId || event.historyId };
  }
  await analyzeMessageIds(connection.ownerEmail, gmail, history.messageIds);
  await prisma.$transaction([
    prisma.gmailConnection.update({ where: { gmailEmail: event.emailAddress }, data: { historyId: history.historyId || event.historyId, lastSyncAt: new Date(), lastError: null, watchStatus: process.env.GMAIL_PUBSUB_TOPIC ? 'active' : 'polling' } }),
    prisma.gmailWebhookEvent.update({ where: { id: eventId }, data: { status: 'completed', lastError: null } }),
  ]);
}

let workerBusy = false;
export async function runGmailWatchCycle(): Promise<void> {
  if (workerBusy) return;
  workerBusy = true;
  try {
    const events = await prisma.gmailWebhookEvent.findMany({ where: { status: { in: ['pending', 'failed'] }, attempts: { lt: 5 } }, orderBy: { createdAt: 'asc' }, take: 10 });
    for (const event of events) {
      await prisma.gmailWebhookEvent.update({ where: { id: event.id }, data: { status: 'processing', attempts: { increment: 1 } } });
      try { await processEvent(event.id); }
      catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to process Gmail history.';
        await prisma.gmailWebhookEvent.update({ where: { id: event.id }, data: { status: 'failed', lastError: message } });
        await prisma.gmailConnection.updateMany({ where: { gmailEmail: event.emailAddress }, data: { lastError: message } });
      }
    }
  } finally { workerBusy = false; }
}

export function startGmailWatchWorker(): void {
  const timer = setInterval(() => void runGmailWatchCycle(), 5_000);
  timer.unref?.();
  const renewalTimer = setInterval(() => void renewExpiringWatches(), 6 * 60 * 60 * 1000);
  renewalTimer.unref?.();
  const fallbackInterval = fallbackIntervalMs();
  const fallbackTimer = setInterval(() => void runFallbackSync(), fallbackInterval);
  fallbackTimer.unref?.();
  void runGmailWatchCycle();
  void renewExpiringWatches();
  void runFallbackSync();
}

export async function enqueueGmailPush(body: unknown): Promise<void> {
  const push = decodeGmailPush(body);
  const connection = await prisma.gmailConnection.findUnique({ where: { gmailEmail: push.emailAddress }, select: { id: true } });
  if (!connection) return;
  await prisma.$transaction([
    prisma.gmailWebhookEvent.upsert({ where: { id: push.eventId }, update: {}, create: { id: push.eventId, emailAddress: push.emailAddress, historyId: push.historyId } }),
    prisma.gmailConnection.update({ where: { gmailEmail: push.emailAddress }, data: { lastWebhookAt: new Date() } }),
  ]);
  void runGmailWatchCycle();
}

export async function saveGmailConnection(ownerEmail: string, tokens: GmailTokens, knownGmailEmail?: string): Promise<void> {
  const gmailEmail = (knownGmailEmail || (await new GmailService(tokens).getProfile()).emailAddress).toLowerCase();
  if (!gmailEmail) throw new Error('Gmail did not provide an email address.');
  const existing = await prisma.gmailConnection.findUnique({ where: { gmailEmail } });
  const oldTokens = openGmailTokens(existing?.sealedTokens);
  const merged: GmailTokens = { ...tokens, refreshToken: tokens.refreshToken || oldTokens?.refreshToken };
  await prisma.gmailConnection.upsert({
    where: { gmailEmail },
    update: { ownerEmail, sealedTokens: sealGmailTokens(merged), watchStatus: 'pending', lastError: null },
    create: { ownerEmail, gmailEmail, sealedTokens: sealGmailTokens(merged) },
  });
  await registerWatch(gmailEmail);
}

export async function registerWatch(gmailEmail: string): Promise<void> {
  const topic = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topic) {
    const connection = await prisma.gmailConnection.findUnique({ where: { gmailEmail } });
    const tokens = openGmailTokens(connection?.sealedTokens);
    if (!tokens) throw new Error('Reconnect Gmail to enable new-email monitoring.');
    const gmail = new GmailService(tokens);
    const [profile, recentIds] = await Promise.all([
      gmail.getProfile(),
      gmail.listMessageIds('newer_than:2d in:inbox -category:promotions', 50, ['INBOX']),
    ]);
    await prisma.gmailConnection.update({
      where: { gmailEmail },
      data: { historyId: connection?.historyId || profile.historyId, watchStatus: 'polling', watchExpiration: null, lastError: null },
    });
    if (recentIds.length) await analyzeMessageIds(connection!.ownerEmail, gmail, recentIds);
    return;
  }
  const connection = await prisma.gmailConnection.findUnique({ where: { gmailEmail } });
  const tokens = openGmailTokens(connection?.sealedTokens);
  if (!tokens) throw new Error('Reconnect Gmail to enable new-email monitoring.');
  try {
    const gmail = new GmailService(tokens);
    const [watch, recentIds] = await Promise.all([
      gmail.watch(topic),
      gmail.listMessageIds('newer_than:2d in:inbox -category:promotions', 50, ['INBOX']),
    ]);
    await prisma.gmailConnection.update({ where: { gmailEmail }, data: { historyId: watch.historyId, watchExpiration: watch.expiration, watchStatus: 'active', lastError: null } });
    if (recentIds.length) await analyzeMessageIds(connection!.ownerEmail, gmail, recentIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start Gmail monitoring.';
    await prisma.gmailConnection.update({ where: { gmailEmail }, data: { watchStatus: 'failed', lastError: message } });
    throw error;
  }
}

async function renewExpiringWatches(): Promise<void> {
  const renewBefore = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const connections = await prisma.gmailConnection.findMany({
    where: {
      owner: { monitoringPaused: false },
      ...(process.env.GMAIL_PUBSUB_TOPIC ? { OR: [{ watchExpiration: null }, { watchExpiration: { lt: renewBefore } }] } : {}),
    },
  });
  for (const connection of connections) {
    try { await registerWatch(connection.gmailEmail); }
    catch (error) { console.warn('[Gmail watch] Renewal failed', { gmailEmail: connection.gmailEmail, error: error instanceof Error ? error.message : 'Unknown error' }); }
  }
}

async function runFallbackSync(): Promise<void> {
  const staleBefore = new Date(Date.now() - Math.max(30_000, Math.floor(fallbackIntervalMs() * 0.8)));
  const connections = await prisma.gmailConnection.findMany({
    where: { owner: { monitoringPaused: false }, historyId: { not: null }, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: staleBefore } }] },
    select: { gmailEmail: true, historyId: true },
  });
  for (const connection of connections) {
    const bucket = Math.floor(Date.now() / fallbackIntervalMs());
    await prisma.gmailWebhookEvent.upsert({
      where: { id: `fallback:${connection.gmailEmail}:${bucket}` },
      update: {},
      create: { id: `fallback:${connection.gmailEmail}:${bucket}`, emailAddress: connection.gmailEmail, historyId: connection.historyId! },
    });
  }
  if (connections.length) void runGmailWatchCycle();
}

export function serializeCandidate(record: {
  id: string; emailId: string; subject: string; sender: string; receivedAt: Date; tag: string;
  serviceName: string; amount: string | null; billingFrequency: string | null; renewalOrEndDate: Date | null;
  summary: string; evidence: unknown; merchantInference: string | null; renewalEstimate: unknown;
}) {
  return {
    candidateId: record.id, emailId: record.emailId, subject: record.subject, from: record.sender,
    date: record.receivedAt.toUTCString(), timestamp: record.receivedAt.getTime(),
    tag: record.tag === 'trial' ? 'trial' : 'subscription', serviceName: record.serviceName,
    amount: record.amount || undefined, billingFrequency: record.billingFrequency || undefined,
    renewalOrEndDate: record.renewalOrEndDate?.toISOString().slice(0, 10), summary: record.summary,
    evidence: record.evidence || undefined, merchantInference: record.merchantInference || undefined,
    renewalEstimate: record.renewalEstimate || undefined,
  };
}
