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
    assert.equal((await store.list(user)).length, 1);
    assert.equal((await store.list(other)).length, 0);
    assert.equal(await store.setReminder(other, first.id, true), null);
    assert.equal((await store.setReminder(user, first.id, true))?.reminderEnabled, true);
    const relation = await prisma.subscription.findUnique({ where: { id: first.id }, include: { user: true } });
    assert.equal(relation?.user.email, user.email);
    await prisma.user.delete({ where: { email: user.email } });
    assert.equal(await prisma.subscription.count({ where: { id: first.id } }), 0);
  } finally {
    await prisma.user.deleteMany({ where: { email: { in: [user.email, other.email] } } });
    await closeSubscriptionDatabaseForTests();
  }
});
