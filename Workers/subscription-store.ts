import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from './db.ts';
import type { JWTPayload } from './Authentication-JWT.ts';
import type { SubscriptionResult } from './extractor/types.ts';
import { dateKeyInTimeZone, rollRenewalForward } from './reminder-utils.ts';

export const frequencies = ['weekly', 'monthly', 'quarterly', 'annually'] as const;
export type SavedSubscription = {
  id: string; serviceName: string; billingFrequency?: string; renewalOrEndDate?: string; amount?: string;
  tag: 'subscription' | 'trial'; source: 'manual' | 'gmail'; sourceId: string; reminderEnabled: boolean; createdAt: string;
};
export class SubscriptionValidationError extends Error {}

export function validateSubscriptionDetails(input: unknown) {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const serviceName = typeof value.serviceName === 'string' ? value.serviceName.trim() : '';
  if (!serviceName || serviceName.length > 160) throw new SubscriptionValidationError('Enter a merchant name (up to 160 characters).');
  if (!frequencies.includes(value.billingFrequency as typeof frequencies[number])) throw new SubscriptionValidationError('Choose a billing frequency.');
  const date = typeof value.renewalOrEndDate === 'string' ? value.renewalOrEndDate : '';
  const parsed = new Date(date + 'T00:00:00.000Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new SubscriptionValidationError('Enter a valid renewal date.');
  const amount = typeof value.amount === 'string' ? value.amount.trim() : '';
  if (amount.length > 80) throw new SubscriptionValidationError('Keep the cost under 80 characters.');
  return { serviceName, billingFrequency: value.billingFrequency as string, renewalOrEndDate: parsed, amount: amount || undefined };
}

export function validateManualSubscription(input: unknown) {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const details = validateSubscriptionDetails(input);
  const requestId = typeof value.requestId === 'string' ? value.requestId : '';
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw new SubscriptionValidationError('Please reopen the form and try again.');
  return { ...details, requestId };
}

type DbClient = Pick<PrismaClient, '$transaction' | 'subscription'>;
const userRecord = (user: JWTPayload) => ({
  where: { email: user.email }, update: { name: user.name, avatar: user.avatar },
  create: { email: user.email, name: user.name, avatar: user.avatar, provider: user.provider, providerId: user.id },
});
const serialize = (record: { id: string; serviceName: string; billingFrequency: string | null; renewalOrEndDate: Date | null; amount: string | null; tag: string; source: string; sourceId: string; reminderEnabled: boolean; createdAt: Date }): SavedSubscription => ({
  id: record.id, serviceName: record.serviceName, billingFrequency: record.billingFrequency || undefined,
  renewalOrEndDate: record.renewalOrEndDate?.toISOString().slice(0, 10), amount: record.amount || undefined,
  tag: record.tag === 'trial' ? 'trial' : 'subscription', source: record.source === 'manual' ? 'manual' : 'gmail',
  sourceId: record.sourceId, reminderEnabled: record.reminderEnabled, createdAt: record.createdAt.toISOString(),
});

export function createSubscriptionStore(client: DbClient = prisma) {
  return {
    async list(user: JWTPayload, now = new Date()) {
      const records = await client.subscription.findMany({
        where: { userEmail: user.email },
        include: { user: { select: { timeZone: true } } },
        orderBy: [{ renewalOrEndDate: 'asc' }, { createdAt: 'asc' }],
      });
      await Promise.all(records.map(async (record) => {
        if (record.tag === 'trial' || !record.renewalOrEndDate || !record.billingFrequency) return;
        const renewalKey = record.renewalOrEndDate.toISOString().slice(0, 10);
        const todayKey = dateKeyInTimeZone(now, record.user.timeZone);
        if (renewalKey >= todayKey) return;
        const rolled = rollRenewalForward(renewalKey, record.billingFrequency, todayKey);
        if (rolled === renewalKey) return;
        record.renewalOrEndDate = new Date(`${rolled}T00:00:00.000Z`);
        await client.subscription.update({ where: { id: record.id }, data: { renewalOrEndDate: record.renewalOrEndDate } });
      }));
      return records.map(serialize).sort((left, right) =>
        (left.renewalOrEndDate || '9999-12-31').localeCompare(right.renewalOrEndDate || '9999-12-31') ||
        left.createdAt.localeCompare(right.createdAt));
    },
    async addManual(user: JWTPayload, input: unknown) {
      const details = validateManualSubscription(input);
      const record = await client.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.user.upsert(userRecord(user));
        return tx.subscription.upsert({
          where: { userEmail_source_sourceId: { userEmail: user.email, source: 'manual', sourceId: details.requestId } }, update: {},
          create: { userEmail: user.email, source: 'manual', sourceId: details.requestId, serviceName: details.serviceName,
            billingFrequency: details.billingFrequency, renewalOrEndDate: details.renewalOrEndDate, amount: details.amount },
        });
      });
      return serialize(record);
    },
    async addExtracted(user: JWTPayload, results: SubscriptionResult[]) {
      await client.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.user.upsert(userRecord(user));
        for (const result of results) {
          const renewal = result.renewalOrEndDate ? new Date(result.renewalOrEndDate + 'T00:00:00.000Z') : undefined;
          await tx.subscription.upsert({
            where: { userEmail_source_sourceId: { userEmail: user.email, source: 'gmail', sourceId: result.emailId } },
            update: { serviceName: result.serviceName, billingFrequency: result.billingFrequency, renewalOrEndDate: renewal, amount: result.amount, tag: result.tag },
            create: { userEmail: user.email, source: 'gmail', sourceId: result.emailId, serviceName: result.serviceName,
              billingFrequency: result.billingFrequency, renewalOrEndDate: renewal, amount: result.amount, tag: result.tag },
          });
        }
      });
      return this.list(user);
    },
    async setReminder(user: JWTPayload, id: string, enabled: boolean) {
      const changed = await client.subscription.updateMany({ where: { id, userEmail: user.email }, data: { reminderEnabled: enabled } });
      if (!changed.count) return null;
      const record = await client.subscription.findFirst({ where: { id, userEmail: user.email } });
      return record ? serialize(record) : null;
    },
    async update(user: JWTPayload, id: string, input: unknown) {
      const details = validateSubscriptionDetails(input);
      const changed = await client.subscription.updateMany({
        where: { id, userEmail: user.email },
        data: {
          serviceName: details.serviceName,
          billingFrequency: details.billingFrequency,
          renewalOrEndDate: details.renewalOrEndDate,
          amount: details.amount ?? null,
        },
      });
      if (!changed.count) return null;
      const record = await client.subscription.findFirst({ where: { id, userEmail: user.email } });
      return record ? serialize(record) : null;
    },
    async remove(user: JWTPayload, id: string) {
      const deleted = await client.subscription.deleteMany({ where: { id, userEmail: user.email } });
      return deleted.count > 0;
    },
  };
}

export const subscriptionStore = createSubscriptionStore();
