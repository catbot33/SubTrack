import { randomUUID } from 'crypto';
import { analyzeEmails } from './ai-service.ts';
import { boundedSetting, safeScanError, ScanError } from './gemini-client.ts';
import { GmailService } from './gmail-service.ts';
import type { ExtractionJob, GmailTokens, ScrapedEmail, SubscriptionResult } from './types.ts';

const jobs = new Map<string, ExtractionJob>();

function normalizeServiceName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^(no-reply|billing|support|receipts|updates|notifications)@/i, '')
    .replace(/\.(com|org|net|io|ai|co|app|dev)\b/gi, '')
    .replace(/\b(premium|plus|pro|team|family|individual|student|subscription|billing|receipt|invoice|inc|incorporated|ltd|limited|llc)\b/gi, '')
    .replace(/[^a-z0-9]/g, '') || value.toLowerCase();
}

export function latestActiveSubscriptions(results: SubscriptionResult[], now = Date.now()): SubscriptionResult[] {
  const groups = new Map<string, SubscriptionResult[]>();
  for (const result of results) {
    const key = result.serviceName === 'Not found'
      ? result.emailId
      : normalizeServiceName(result.serviceName || result.from || result.subject);
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }

  const active: SubscriptionResult[] = [];
  for (const history of groups.values()) {
    // At an identical timestamp, conservatively let cancellation win.
    history.sort((left, right) => left.timestamp - right.timestamp ||
      Number(left.tag === 'cancellation') - Number(right.tag === 'cancellation'));
    const latestEvent = history.at(-1);
    if (!latestEvent || latestEvent.tag === 'cancellation') continue;
    if (latestEvent.tag === 'trial' && latestEvent.renewalOrEndDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(latestEvent.renewalOrEndDate) &&
        Date.parse(latestEvent.renewalOrEndDate + 'T23:59:59.999Z') < now) continue;
    active.push(latestEvent);
  }

  return active.sort((left, right) => right.timestamp - left.timestamp);
}

const analysisCache = new Map<string, { result: SubscriptionResult | null; expiresAt: number }>();

async function runExtraction(job: ExtractionJob, tokens: GmailTokens): Promise<void> {
  let service: 'gmail' | 'ai' = 'gmail';
  const stopIfCancelled = () => {
    if (!job.cancelRequested && job.stage !== 'cancelled') return false;
    job.stage = 'cancelled';
    job.detail = 'Scan cancelled';
    job.updatedAt = Date.now();
    return true;
  };
  const update = () => {
    job.results = latestActiveSubscriptions(job.rawResults);
    if (!stopIfCancelled()) {
      job.percentage = Math.min(96, 10 + Math.round(job.processed / Math.max(1, job.total) * 86));
    }
    job.updatedAt = Date.now();
  };
  try {
    const gmail = new GmailService(tokens);
    console.info('[Extraction]', { jobId: job.id, phase: 'listing' });
    const messageIds = [...new Set(await gmail.listMessageIds())];
    if (stopIfCancelled()) return;
    job.total = messageIds.length;
    const batchSize = boundedSetting('GEMINI_BATCH_SIZE', 8, 1, 12);
    for (let offset = 0; offset < messageIds.length; offset += batchSize) {
      if (stopIfCancelled()) return;
      job.stage = 'reading';
      job.detail = 'Extracting emails';
      job.updatedAt = Date.now();
      service = 'gmail';
      const pending: string[] = [];
      const cacheKey = (id: string) => JSON.stringify(['active-events-v3', job.ownerId, process.env.GEMINI_MODEL, id]);
      for (const id of messageIds.slice(offset, offset + batchSize)) {
        const cached = analysisCache.get(cacheKey(id));
        if (cached && cached.expiresAt > Date.now()) {
          if (cached.result) job.rawResults.push(cached.result);
          job.processed++;
          job.reviewed++;
        } else pending.push(id);
      }
      update();
      const emails: ScrapedEmail[] = [];
      // Bound Gmail reads separately from the single paced AI request queue.
      for (let cursor = 0; cursor < pending.length; cursor += 3) {
        if (stopIfCancelled()) return;
        const fetched = await Promise.allSettled(pending.slice(cursor, cursor + 3).map((id) => gmail.getMessageDetails(id)));
        if (stopIfCancelled()) return;
        for (const entry of fetched) {
          if (entry.status === 'fulfilled') emails.push(entry.value);
          else {
            const error = safeScanError(entry.reason, 'gmail');
            if (error.code === 'GMAIL_RECONNECT') throw error;
            job.errors.push(error.message);
            job.processed++;
            console.warn('[Extraction]', { jobId: job.id, phase: 'reading', code: error.code });
          }
        }
      }
      update();
      if (!emails.length) continue;
      service = 'ai';
      job.stage = 'classifying';
      const analyses = await analyzeEmails(emails, (detail) => {
        if (job.cancelRequested || job.stage === 'cancelled') return;
        job.detail = detail;
        job.updatedAt = Date.now();
      });
      if (stopIfCancelled()) return;
      for (const analysis of analyses) {
        job.processed++;
        if (analysis.error) job.errors.push(analysis.error);
        else {
          job.reviewed++;
          if (analysis.result) job.rawResults.push(analysis.result);
          analysisCache.set(cacheKey(analysis.emailId), { result: analysis.result, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
        }
      }
      update();
      console.info('[Extraction]', { jobId: job.id, phase: 'reviewed', processed: job.processed, total: job.total, found: job.results.length });
    }
    if (stopIfCancelled()) return;
    if (job.total && !job.reviewed) {
      throw new ScanError(job.errors[0] || 'No email analysis was returned. Please retry.', 'NO_EMAILS_REVIEWED');
    }
    job.stage = 'completed';
    job.percentage = 100;
    job.detail = job.errors.length ? 'Scan incomplete. Review the subscriptions found.' : 'Email review complete';
  } catch (error) {
    if (stopIfCancelled()) return;
    const failure = safeScanError(error, service);
    job.stage = 'failed';
    job.errorCode = failure.code;
    job.detail = failure.message;
    console.warn('[Extraction]', { jobId: job.id, phase: service, code: failure.code, processed: job.processed, total: job.total, found: job.results.length });
  } finally {
    job.results = latestActiveSubscriptions(job.rawResults);
    job.updatedAt = Date.now();
    while (analysisCache.size > 5000) analysisCache.delete(analysisCache.keys().next().value!);
  }
}

export function startExtraction(ownerId: string, tokens: GmailTokens): ExtractionJob {
  const active = [...jobs.values()].find((job) => job.ownerId === ownerId && !['failed', 'completed', 'cancelled', 'confirmed'].includes(job.stage));
  if (active) return active;
  const now = Date.now();
  for (const [jobId, existingJob] of jobs) {
    if (now - existingJob.updatedAt > 24 * 60 * 60 * 1000) jobs.delete(jobId);
  }
  const job: ExtractionJob = {
    id: `extract_${now}_${randomUUID().slice(0, 8)}`,
    ownerId,
    total: 0,
    processed: 0,
    reviewed: 0,
    percentage: 4,
    stage: 'finding',
    detail: 'Connecting securely to Gmail',
    results: [],
    rawResults: [],
    errors: [],
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(job.id, job);
  void runExtraction(job, tokens);
  return job;
}

export function getExtractionJob(jobId: string, ownerId: string): ExtractionJob | null {
  const job = jobs.get(jobId);
  return job?.ownerId === ownerId ? job : null;
}

export function cancelExtractionJob(jobId: string, ownerId: string): ExtractionJob | null {
  const job = getExtractionJob(jobId, ownerId);
  if (!job) return null;
  if (!['completed', 'failed', 'cancelled', 'confirmed'].includes(job.stage)) {
    job.cancelRequested = true;
    job.stage = 'cancelled';
    job.detail = 'Scan cancelled';
    job.results = latestActiveSubscriptions(job.rawResults);
    job.updatedAt = Date.now();
  }
  return job;
}

export function confirmExtractionJob(
  jobId: string,
  ownerId: string,
  subscriptions: SubscriptionResult[],
): ExtractionJob | null {
  const job = getExtractionJob(jobId, ownerId);
  if (!job || !['completed', 'failed', 'cancelled'].includes(job.stage) || !job.results.length) return null;
  const originalResults = new Map(job.results.map((result) => [result.emailId, result]));
  job.results = subscriptions.map((result) => ({
    ...result,
    evidence: originalResults.get(result.emailId)?.evidence,
    merchantInference: originalResults.get(result.emailId)?.merchantInference,
    renewalEstimate: originalResults.get(result.emailId)?.renewalEstimate,
  }));
  job.stage = 'confirmed';
  job.detail = 'Subscriptions confirmed';
  job.updatedAt = Date.now();
  return job;
}

export function publicJob(job: ExtractionJob) {
  return {
    jobId: job.id,
    total: job.total,
    processed: job.processed,
    percentage: job.percentage,
    stage: job.stage,
    detail: job.detail,
    skippedEmails: job.stage === 'failed' ? job.total - job.reviewed : job.errors.length,
    errorCode: job.errorCode,
    reconnectUrl: job.errorCode === 'GMAIL_RECONNECT' ? '/auth/google/connect' : undefined,
    results: job.results,
    error: job.stage === 'failed' ? job.detail : undefined,
  };
}
