import prisma from './db.ts';
import { sendWhatsAppMessage, sendWhatsAppTemplate } from './whatsapp-service.ts';
import { buildRenewalMessage, dateKeyInTimeZone, daysBetweenCalendarDates, rollRenewalForward } from './reminder-utils.ts';

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;

async function reconcileRenewals(now: Date) {
  const subscriptions = await prisma.subscription.findMany({
    where: { reminderEnabled: true, renewalOrEndDate: { not: null } },
    include: { user: true },
  });
  for (const subscription of subscriptions) {
    if (!subscription.user.whatsappNumber || !subscription.renewalOrEndDate) continue;
    const todayKey = dateKeyInTimeZone(now, subscription.user.timeZone);
    let renewalKey = subscription.renewalOrEndDate.toISOString().slice(0, 10);
    if (subscription.tag !== 'trial' && renewalKey < todayKey && subscription.billingFrequency) {
      const rolled = rollRenewalForward(renewalKey, subscription.billingFrequency, todayKey);
      if (rolled !== renewalKey) {
        renewalKey = rolled;
        await prisma.subscription.update({ where: { id: subscription.id }, data: { renewalOrEndDate: new Date(`${rolled}T00:00:00Z`) } });
      }
    }
    const daysRemaining = daysBetweenCalendarDates(todayKey, renewalKey);
    if (daysRemaining < 1 || daysRemaining > subscription.user.reminderLeadDays) continue;
    const deliveryKey = `renewal:${subscription.id}:${renewalKey}:${daysRemaining}`;
    await prisma.reminderDelivery.upsert({
      where: { deliveryKey }, update: {},
      create: {
        userEmail: subscription.userEmail,
        subscriptionId: subscription.id,
        kind: 'renewal',
        deliveryKey,
        message: buildRenewalMessage(subscription.serviceName, renewalKey, daysRemaining, subscription.amount),
        scheduledFor: now,
      },
    });
  }
}

async function dispatchPending(now: Date) {
  const deliveries = await prisma.reminderDelivery.findMany({
    where: { status: 'pending', scheduledFor: { lte: now } },
    include: { user: true, subscription: true },
    orderBy: { scheduledFor: 'asc' },
    take: 10,
  });
  for (const delivery of deliveries) {
    const claimed = await prisma.reminderDelivery.updateMany({ where: { id: delivery.id, status: 'pending' }, data: { status: 'sending', attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    if (!delivery.user.whatsappNumber || (delivery.kind === 'renewal' && !delivery.subscription?.reminderEnabled)) {
      await prisma.reminderDelivery.update({ where: { id: delivery.id }, data: { status: 'cancelled', lastError: 'The WhatsApp connection or reminder was disabled.' } });
      continue;
    }
    try {
      const providerMessageId = delivery.kind === 'connection_test'
        ? await sendWhatsAppTemplate(delivery.user.whatsappNumber)
        : await sendWhatsAppMessage(delivery.user.whatsappNumber, delivery.message);
      await prisma.reminderDelivery.update({ where: { id: delivery.id }, data: { status: 'sent', sentAt: new Date(), providerMessageId, lastError: null } });
      console.log('[reminders] WhatsApp accepted delivery', { deliveryId: delivery.id, kind: delivery.kind, providerMessageId: Boolean(providerMessageId) });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'WhatsApp delivery failed.';
      console.error('[reminders] WhatsApp delivery rejected', { deliveryId: delivery.id, kind: delivery.kind, attempt: delivery.attempts + 1, error: message });
      const retry = delivery.attempts + 1 < 3;
      await prisma.reminderDelivery.update({
        where: { id: delivery.id },
        data: retry
          ? { status: 'pending', scheduledFor: new Date(Date.now() + Math.min(10, 2 ** delivery.attempts) * 60_000), lastError: message }
          : { status: 'failed', lastError: message },
      });
    }
  }
}

export async function runReminderCycle(now = new Date()): Promise<void> {
  if (running) return;
  running = true;
  try { await reconcileRenewals(now); await dispatchPending(now); }
  catch (error) { console.error('Reminder cycle failed:', error instanceof Error ? error.message : error); }
  finally { running = false; }
}

export function startReminderScheduler(): void {
  if (timer) return;
  void runReminderCycle();
  timer = setInterval(() => void runReminderCycle(), 5_000);
  timer.unref?.();
}
