import test from 'node:test';
import assert from 'node:assert/strict';
import { addBillingCycle, buildRenewalMessage, daysBetweenCalendarDates, rollRenewalForward } from './reminder-utils.ts';
import { normalizeWhatsAppNumber, sendWhatsAppTemplate } from './whatsapp-service.ts';

test('daily reminder windows use calendar days', () => {
  assert.equal(daysBetweenCalendarDates('2026-09-20', '2026-09-27'), 7);
  assert.equal(daysBetweenCalendarDates('2026-09-24', '2026-09-27'), 3);
  assert.equal(daysBetweenCalendarDates('2026-09-26', '2026-09-27'), 1);
});

test('monthly projection clamps to the last valid day', () => {
  assert.equal(addBillingCycle('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(addBillingCycle('2028-01-31', 'monthly'), '2028-02-29');
  assert.equal(addBillingCycle('2026-09-05', 'annually'), '2027-09-05');
});

test('past recurring renewals roll to the current or next cycle', () => {
  assert.equal(rollRenewalForward('2026-06-27', 'monthly', '2026-09-05'), '2026-09-27');
});

test('messages include merchant, date, countdown and optional amount', () => {
  assert.equal(buildRenewalMessage('Figma', '2026-09-27', 3, '$15'), 'SubTrack reminder: Figma renews in 3 days (2026-09-27) for $15. Review or update it in SubTrack.');
});

test('WhatsApp numbers are normalized and validated', () => {
  assert.equal(normalizeWhatsAppNumber('+92 (300) 123-4567'), '923001234567');
  assert.throws(() => normalizeWhatsAppNumber('123'));
});

test('connection confirmations use a WhatsApp template directly', async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const originalPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  let payload: Record<string, unknown> | undefined;
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
  globalThis.fetch = async (_input, init) => {
    payload = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ messages: [{ id: 'accepted-id' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    assert.equal(await sendWhatsAppTemplate('+92 300 1234567'), 'accepted-id');
    assert.equal(payload?.type, 'template');
    assert.deepEqual(payload?.template, { name: 'hello_world', language: { code: 'en_US' } });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.WHATSAPP_ACCESS_TOKEN; else process.env.WHATSAPP_ACCESS_TOKEN = originalToken;
    if (originalPhoneId === undefined) delete process.env.WHATSAPP_PHONE_NUMBER_ID; else process.env.WHATSAPP_PHONE_NUMBER_ID = originalPhoneId;
  }
});
