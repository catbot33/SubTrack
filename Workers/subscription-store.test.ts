import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import prisma, { closeSubscriptionDatabaseForTests } from './db.ts';
import { createSubscriptionStore, validateManualSubscription } from './subscription-store.ts';
import type { JWTPayload } from './Authentication-JWT.ts';

const input = { serviceName: '  Fixture merchant  ', billingFrequency: 'monthly', renewalOrEndDate: '2026-10-03', requestId: 'unit-test-request-001' };

test('manual form requires merchant, supported frequency and a real date, but not cost', () => {
  assert.equal(validateManualSubscription(input).serviceName, 'Fixture merchant');
  assert.equal(validateManualSubscription(input).amount, undefined);
  for (const invalid of [null, { ...input, serviceName: ' ' }, { ...input, billingFrequency: '' }, { ...input, billingFrequency: 'other' },
    { ...input, renewalOrEndDate: '' }, { ...input, renewalOrEndDate: '2026-02-30' }, { ...input, requestId: '../../escape' }]) assert.throws(() => validateManualSubscription(invalid));
});

test('database subscriptions persist, isolate users, deduplicate, and cascade with their user', async () => {
  const suffix = randomUUID();
  const user = { id: 'provider-' + suffix, email: `subtrack-test-${suffix}@example.invalid`, name: 'Test user', provider: 'google' } as JWTPayload;
  const other = { ...user, id: 'provider-other-' + suffix, email: `subtrack-other-${suffix}@example.invalid` };
  const store = createSubscriptionStore();
  try {
    const first = await store.addManual(user, { ...input, requestId: 'request-' + suffix });
    const duplicate = await store.addManual(user, { ...input, requestId: 'request-' + suffix });
    assert.equal(first.id, duplicate.id);
    assert.equal(first.reminderEnabled, true);
    assert.equal((await store.list(user)).length, 1);
    assert.equal((await store.list(other)).length, 0);
    assert.equal(await store.setReminder(other, first.id, true), null);
    assert.equal((await store.setReminder(user, first.id, true))?.reminderEnabled, true);
    const editInput = { serviceName: 'Updated merchant', billingFrequency: 'annually', renewalOrEndDate: '2027-01-15', amount: '' };
    assert.equal(await store.update(other, first.id, editInput), null);
    const updated = await store.update(user, first.id, editInput);
    assert.equal(updated?.serviceName, 'Updated merchant');
    assert.equal(updated?.billingFrequency, 'annually');
    assert.equal(updated?.renewalOrEndDate, '2027-01-15');
    assert.equal(updated?.amount, undefined);
    const rolling = await store.addManual(user, {
      ...input,
      renewalOrEndDate: '2026-06-27',
      requestId: 'rolling-' + suffix,
    });
    const rolled = await store.list(user, new Date('2026-09-05T12:00:00.000Z'));
    assert.equal(rolled.find((item) => item.id === rolling.id)?.renewalOrEndDate, '2026-09-27');
    assert.equal((await prisma.subscription.findUnique({ where: { id: rolling.id } }))?.renewalOrEndDate?.toISOString().slice(0, 10), '2026-09-27');
    const relation = await prisma.subscription.findUnique({ where: { id: first.id }, include: { user: true } });
    assert.equal(relation?.user.email, user.email);
    assert.equal(await store.remove(other, first.id), false);
    assert.equal(await store.remove(user, first.id), true);
    assert.equal(await prisma.subscription.count({ where: { id: first.id } }), 0);
    await prisma.user.delete({ where: { email: user.email } });
    assert.equal(await prisma.subscription.count({ where: { id: first.id } }), 0);
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [user.email, other.email] } } });
    await closeSubscriptionDatabaseForTests();
  }
});
