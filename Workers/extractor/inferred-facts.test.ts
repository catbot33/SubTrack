import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resultFromAI } from './ai-service.ts';
import { addCalendarInterval, senderMerchant } from './inferred-facts.ts';
import { latestActiveSubscriptions } from './extraction-jobs.ts';
import type { ScrapedEmail } from './types.ts';

// Synthetic unit fixtures only; these are never sent to Gemini or added to the dashboard.
const email: ScrapedEmail = {
  id: 'fixture', threadId: 'fixture', labels: [], snippet: '',
  from: 'Acme Billing <receipts@acme.com>', to: 'fixture@example.com',
  subject: 'Your subscription', date: 'Thu, 03 Sep 2026 23:30:00 -0700',
  timestamp: Date.parse('2026-09-04T06:30:00Z'), attachments: [],
  bodyText: 'Your Acme subscription started today. Billed monthly. Your 7-day trial has started.',
};
const answer = {
  isQualified: true, tag: 'subscription', serviceName: null, billingFrequency: 'monthly',
  evidence: { status: 'Your Acme subscription started today.', billingFrequency: 'Billed monthly.' },
  dateCalculation: { event: 'start', eventEvidence: 'Your Acme subscription started today.', startDate: null },
};

test('sender identifies provider while processors and generic sender names do not', () => {
  const result = resultFromAI(email, answer)!;
  assert.equal(result.serviceName, 'Acme');
  assert.equal(result.evidence?.serviceName, email.from);
  assert.ok(result.merchantInference);
  assert.equal(senderMerchant('Receipts <receipt@stripe.com>'), undefined);
  assert.equal(senderMerchant('Receipts <receipt@processor.example>'), undefined);
  assert.equal(senderMerchant('Support <billing@acme.com>')?.name, 'acme.com');
});

test('brand punctuation normalization retains the email evidence', () => {
  const result = resultFromAI({ ...email, subject: 'Acme-Cloud receipt' }, {
    ...answer, serviceName: 'Acme Cloud', evidence: { ...answer.evidence, serviceName: 'Acme-Cloud receipt' },
  })!;
  assert.equal(result.serviceName, 'Acme Cloud');
  assert.equal(result.merchantInference, undefined);
});

test('monthly renewal uses the received calendar date and records a projection separately from excerpts', () => {
  const result = resultFromAI(email, answer)!;
  assert.equal(result.renewalOrEndDate, '2026-10-03');
  assert.equal(result.renewalEstimate?.date, '2026-10-03');
  assert.match(result.renewalEstimate!.explanation, /email received date/);
  assert.equal(result.evidence?.renewalOrEndDate, undefined);
});

test('trial starts plus seven days; no use of paid billing cycle for trials', () => {
  const trial = { ...answer, tag: 'trial', dateCalculation: {
    event: 'start', eventEvidence: 'Your 7-day trial has started.',
    trialLength: 7, trialUnit: 'days', trialEvidence: 'Your 7-day trial has started.',
  } };
  assert.equal(resultFromAI(email, trial)?.renewalOrEndDate, '2026-09-10');
  assert.equal(resultFromAI(email, { ...trial, dateCalculation: { ...trial.dateCalculation, trialLength: 70 } })?.renewalOrEndDate, undefined);
  assert.equal(resultFromAI(email, { ...trial, dateCalculation: { ...trial.dateCalculation, trialLength: null } })?.renewalOrEndDate, undefined);
});

test('subscription projection uses arrival while an explicit renewal takes precedence', () => {
  const datedEmail = { ...email, bodyText: email.bodyText + ' Period started August 31, 2026. Renews October 5, 2026.' };
  const datedAnswer = { ...answer, dateCalculation: { ...answer.dateCalculation,
    startDate: '2026-08-31', startEvidence: 'Period started August 31, 2026.',
  } };
  assert.equal(resultFromAI(datedEmail, datedAnswer)?.renewalOrEndDate, '2026-10-03');
  const explicit = resultFromAI(datedEmail, { ...datedAnswer, renewalOrEndDate: '2026-10-05',
    evidence: { ...answer.evidence, renewalOrEndDate: 'Renews October 5, 2026.' },
  })!;
  assert.equal(explicit.renewalOrEndDate, '2026-10-05');
  assert.equal(explicit.renewalEstimate, undefined);
});

test('calendar intervals handle month end, leap years, weeks and quarters', () => {
  assert.equal(addCalendarInterval('2026-01-31', 1, 'months'), '2026-02-28');
  assert.equal(addCalendarInterval('2024-02-29', 1, 'years'), '2025-02-28');
  assert.equal(addCalendarInterval('2026-11-30', 3, 'months'), '2027-02-28');
  assert.equal(addCalendarInterval('2026-12-29', 1, 'weeks'), '2027-01-05');
});

test('all active subscriptions with a proven interval get dates while cancellations and missing intervals do not', () => {
  assert.equal(resultFromAI(email, { ...answer, dateCalculation: { ...answer.dateCalculation, event: 'reminder' } })?.renewalOrEndDate, '2026-10-03');
  assert.equal(resultFromAI(email, { ...answer, tag: 'cancellation' })?.renewalOrEndDate, undefined);
  assert.equal(resultFromAI(email, { ...answer, billingFrequency: null })?.renewalOrEndDate, undefined);
  assert.equal(resultFromAI(email, { ...answer, dateCalculation: { ...answer.dateCalculation, eventEvidence: 'Invented start' } })?.renewalOrEndDate, '2026-10-03');
  assert.equal(resultFromAI(email, { ...answer, dateCalculation: { ...answer.dateCalculation, startDate: '2026-02-30', startEvidence: 'Billed monthly.' } })?.renewalOrEndDate, '2026-10-03');
});

test('estimated renewal never overrides a later cancellation', () => {
  const active = resultFromAI(email, answer)!;
  const cancelled = { ...active, tag: 'cancellation' as const, emailId: 'cancelled', timestamp: active.timestamp + 1000 };
  assert.deepEqual(latestActiveSubscriptions([cancelled, active]), []);
});
