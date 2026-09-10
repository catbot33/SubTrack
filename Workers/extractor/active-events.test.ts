import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestActiveSubscriptions } from './extraction-jobs.ts';
import { GmailService, GMAIL_UPDATES_QUERY } from './gmail-service.ts';
import { resultFromAI } from './ai-service.ts';
import type { ScrapedEmail, SubscriptionResult, SubscriptionTag } from './types.ts';

const now = Date.parse('2026-09-03T12:00:00Z');
function event(id: string, day: number, tag: SubscriptionTag, merchant = 'Acme'): SubscriptionResult {
  return {
    emailId: id, subject: id, from: 'billing@example.com', date: '', timestamp: now + day * 86400000,
    isQualified: true, tag, serviceName: merchant, summary: '', amount: 'USD 20.00', billingFrequency: 'monthly',
  };
}

test('a later cancellation removes the merchant regardless of processing order', () => {
  assert.deepEqual(latestActiveSubscriptions([
    event('cancel', -1, 'cancellation', 'Acme'),
    event('paid', -10, 'subscription', 'Acme Pro'),
    event('trial', -20, 'trial', 'Acme Inc.'),
  ], now), []);
});

test('the latest signup after a cancellation becomes active again', () => {
  const result = latestActiveSubscriptions([
    event('old-paid', -30, 'subscription'),
    event('cancel', -10, 'cancellation'),
    event('new-trial', -1, 'trial'),
  ], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].emailId, 'new-trial');
});

test('only the latest paid receipt is shown and other merchants are unaffected', () => {
  const result = latestActiveSubscriptions([
    event('old', -10, 'subscription'),
    { ...event('latest', -1, 'subscription'), amount: 'USD 25.00' },
    event('other', -2, 'subscription', 'Other Service'),
    event('cancel-other', -1, 'cancellation', 'Other Service'),
  ], now);
  assert.equal(result.length, 1);
  assert.equal(result[0].amount, 'USD 25.00');
});

test('expired trials and same-time cancellations are excluded', () => {
  assert.deepEqual(latestActiveSubscriptions([
    { ...event('expired', -10, 'trial'), renewalOrEndDate: '2026-09-02' },
    event('paid', -1, 'subscription', 'Other Service'),
    event('cancel', -1, 'cancellation', 'Other Service'),
  ], now), []);
  assert.equal(latestActiveSubscriptions([
    { ...event('ongoing', -1, 'trial'), renewalOrEndDate: '2026-09-10' },
  ], now).length, 1);
});

test('promotional status excerpts and cancellation instructions cannot qualify', () => {
  const email: ScrapedEmail = {
    id: 'promotion', threadId: '', labels: [], snippet: '', from: '', to: '', subject: 'Acme offer',
    date: '', timestamp: now, bodyText: 'Start your trial today. Manage your subscription in settings.',
    attachments: [],
  };
  assert.equal(resultFromAI(email, {
    isQualified: true, tag: 'trial', evidence: { status: 'Start your trial today.' },
  }), null);
  assert.equal(resultFromAI(email, {
    isQualified: true, tag: 'cancellation', evidence: { status: 'Manage your subscription in settings.' },
  }), null);
  assert.equal(resultFromAI(email, { isQualified: true, tag: 'trial', evidence: {} }), null);
});

test('Gmail queries Updates only and excludes Promotions, spam and trash on every page', async () => {
  const gmail = new GmailService({ accessToken: 'test-token', connectedAt: now });
  const calls: Array<Record<string, unknown>> = [];
  // Replace the SDK client without making network calls.
  Object.defineProperty(gmail, 'gmail', { value: { users: { messages: {
    list: async (params: Record<string, unknown>) => {
      calls.push(params);
      return { data: params.pageToken
        ? { messages: [{ id: 'second' }] }
        : { messages: [{ id: 'first' }], nextPageToken: 'next' } };
    },
  } } } });
  assert.deepEqual(await gmail.listMessageIds(), ['first', 'second']);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.q, GMAIL_UPDATES_QUERY);
    assert.equal(call.q, 'category:updates -category:promotions');
    assert.deepEqual(call.labelIds, ['CATEGORY_UPDATES']);
    assert.equal(call.includeSpamTrash, false);
  }
});
