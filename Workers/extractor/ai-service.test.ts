import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeEmail, analyzeEmails, resultFromAI } from './ai-service.ts';
import type { ScrapedEmail } from './types.ts';
process.env.GEMINI_REQUEST_INTERVAL_MS = '0';
process.env.GEMINI_MAX_ATTEMPTS = '1';

const email: ScrapedEmail = {
  id: 'synthetic-email', threadId: 'synthetic-thread', labels: [],
  snippet: '', from: 'Receipts <receipts@processor.example>', to: 'test@example.com',
  subject: 'Acme subscription receipt', date: '2026-09-03',
  timestamp: Date.parse('2026-09-03T12:00:00Z'),
  bodyText: 'Your Acme Pro subscription is now active. Acme Pro subscription. Recurring cost: USD 20.00. Billed monthly. Next renewal: October 3, 2026.',
  attachments: [],
};
const answer = {
  isQualified: true, tag: 'subscription', serviceName: 'Acme Pro',
  amount: 'USD 20.00', billingFrequency: 'monthly', renewalOrEndDate: '2026-10-03',
  evidence: {
    status: 'Your Acme Pro subscription is now active.',
    serviceName: 'Acme Pro subscription.',
    amount: 'Recurring cost: USD 20.00.',
    billingFrequency: 'Billed monthly.',
    renewalOrEndDate: 'Next renewal: October 3, 2026.',
  },
};

test('AI findings and real source excerpts reach the cards unchanged', () => {
  const result = resultFromAI(email, answer)!;
  assert.equal(result.serviceName, 'Acme Pro');
  assert.equal(result.amount, 'USD 20.00');
  assert.equal(result.billingFrequency, 'monthly');
  assert.equal(result.renewalOrEndDate, '2026-10-03');
  assert.deepEqual(result.evidence, answer.evidence);
});

test('missing facts are not guessed from sender, arrival date, or known merchant prices', () => {
  const result = resultFromAI(email, { isQualified: true, tag: 'subscription', evidence: { status: answer.evidence.status } })!;
  assert.equal(result.serviceName, 'Not found');
  assert.equal(result.amount, undefined);
  assert.equal(result.billingFrequency, undefined);
  assert.equal(result.renewalOrEndDate, undefined);
});

test('invented source excerpts and amounts contradicting a real excerpt are rejected', () => {
  const result = resultFromAI(email, {
    ...answer, amount: 'USD 99.00',
    evidence: { ...answer.evidence, serviceName: 'Acme Pro from an invented source' },
  })!;
  assert.equal(result.serviceName, 'Not found');
  assert.equal(result.amount, undefined);
  assert.equal(result.evidence?.amount, undefined);
});

test('attachment text can support the AI findings', () => {
  const withAttachment = {
    ...email, bodyText: 'See attached receipt.',
    attachments: [{ filename: 'invoice.pdf', mimeType: 'application/pdf', size: 100, isConvertible: true, textContent: email.bodyText }],
  };
  assert.equal(resultFromAI(withAttachment, answer)?.amount, 'USD 20.00');
});

test('invalid explicit dates are rejected and replaced by the deterministic interval projection', () => {
  const result = resultFromAI(email, { ...answer, renewalOrEndDate: '2026-02-30' })!;
  assert.equal(result.renewalOrEndDate, '2026-10-03');
  assert.equal(result.evidence?.renewalOrEndDate, undefined);
  assert.equal(result.renewalEstimate?.date, '2026-10-03');
});

test('AI rejection is respected and malformed responses are errors', () => {
  assert.equal(resultFromAI(email, { isQualified: false, tag: 'subscription' }), null);
  assert.throws(() => resultFromAI(email, {}), /incomplete/);
  assert.throws(() => resultFromAI(email, null), /invalid/);
});

test('AI request receives full extracted text; failures never invoke regex guessing', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'synthetic-test-key';
  try {
    let sent: any;
    globalThis.fetch = async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }));
    };
    const longEmail = { ...email, bodyText: 'x'.repeat(12000) + email.bodyText };
    assert.equal((await analyzeEmail(longEmail))?.amount, 'USD 20.00');
    assert.equal(JSON.parse(sent.contents[0].parts[0].text).message, longEmail.bodyText);
    assert.match(sent.systemInstruction.parts[0].text, /untrusted data/);

    globalThis.fetch = async () => new Response('{}', { status: 429 });
    await assert.rejects(() => analyzeEmail(email), /rate-limiting/);
    globalThis.fetch = async () => new Response('{}');
    await assert.rejects(() => analyzeEmail(email), /unreadable/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});

test('batch responses are matched by email ID and excerpts cannot leak between emails', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    const other = { ...email, id: 'other-email', bodyText: 'A newsletter without a receipt.', subject: 'Newsletter' };
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        results: [
          { ...answer, emailId: other.id },
          { ...answer, emailId: email.id },
        ],
      }) }] } }] }));
    };
    const results = await analyzeEmails([email, other]);
    assert.equal(calls, 1);
    assert.equal(results[0].result?.amount, 'USD 20.00');
    assert.equal(results[1].result?.amount, undefined);
    assert.equal(results[1].result, null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});
