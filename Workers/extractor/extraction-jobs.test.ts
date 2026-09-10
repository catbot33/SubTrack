import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { confirmExtractionJob, getExtractionJob, publicJob, startExtraction } from './extraction-jobs.ts';
import { GmailService } from './gmail-service.ts';
import type { ScrapedEmail } from './types.ts';
process.env.GEMINI_REQUEST_INTERVAL_MS = '0';
process.env.GEMINI_MAX_ATTEMPTS = '1';
process.env.GEMINI_BATCH_SIZE = '1';

test('findings appear during processing and survive another email failing', async () => {
  const originalList = GmailService.prototype.listMessageIds;
  const originalGet = GmailService.prototype.getMessageDetails;
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalConcurrency = process.env.SCRAPE_CONCURRENCY;
  let releaseSecond!: () => void;
  const secondEmail = new Promise<void>((resolve) => { releaseSecond = resolve; });
  const email: ScrapedEmail = {
    id: 'receipt', threadId: 'thread', subject: 'Acme subscription',
    from: 'billing@acme.example', to: 'test@example.com', date: '2026-09-03',
    timestamp: Date.parse('2026-09-03'), snippet: '', labels: [], attachments: [],
    bodyText: 'Your Acme subscription is active. Acme costs USD 20.00 monthly.',
  };
  const waitUntil = async (ready: () => boolean) => {
    const deadline = Date.now() + 5000;
    while (!ready()) {
      assert.ok(Date.now() < deadline, 'job did not reach expected state');
      await setImmediate();
    }
  };
  try {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.SCRAPE_CONCURRENCY = '1';
    GmailService.prototype.listMessageIds = async () => ['receipt', 'unavailable'];
    GmailService.prototype.getMessageDetails = async (id) => {
      if (id === 'receipt') return email;
      await secondEmail;
      throw new Error('Synthetic email fetch failure');
    };
    globalThis.fetch = async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        results: [{ emailId: 'receipt', isQualified: true, tag: 'subscription', serviceName: 'Acme',
        amount: 'USD 20.00', billingFrequency: 'monthly',
        evidence: { status: 'Your Acme subscription is active.', serviceName: 'Acme', amount: 'USD 20.00', billingFrequency: 'monthly' } }],
      }) }] } }],
    }));

    const job = startExtraction('test-owner', { accessToken: 'test-token', connectedAt: Date.now() });
    assert.equal(startExtraction('test-owner', { accessToken: 'test-token', connectedAt: Date.now() }).id, job.id);
    await waitUntil(() => job.processed === 1);
    assert.equal(publicJob(job).results[0]?.serviceName, 'Acme');
    assert.notEqual(job.stage, 'completed');
    assert.equal(getExtractionJob(job.id, 'someone-else'), null);
    assert.equal(confirmExtractionJob(job.id, 'test-owner', job.results), null);

    releaseSecond();
    await waitUntil(() => job.stage === 'completed');
    assert.equal(publicJob(job).skippedEmails, 1);
    assert.equal(publicJob(job).results[0]?.amount, 'USD 20.00');

    // A terminal failure must expose the same findings and permit their confirmation.
    job.stage = 'failed';
    assert.equal(publicJob(job).results.length, 1);
    const confirmed = confirmExtractionJob(job.id, 'test-owner', [{ ...job.results[0], amount: 'USD 22.00' }]);
    assert.equal(confirmed?.stage, 'confirmed');
    assert.equal(confirmed?.results[0].amount, 'USD 22.00');
    assert.equal(confirmed?.results[0].evidence?.amount, 'USD 20.00');

    // Retrying reuses the successful analysis without spending another AI request.
    globalThis.fetch = async () => { throw new Error('Cached receipt should not call AI again'); };
    const retried = startExtraction('test-owner', { accessToken: 'test-token', connectedAt: Date.now() });
    await waitUntil(() => retried.stage === 'completed');
    assert.equal(retried.reviewed, 1);
    assert.equal(retried.results[0].amount, 'USD 20.00');

    GmailService.prototype.getMessageDetails = async () => { throw new Error('Synthetic failure'); };
    const emptyJob = startExtraction('empty-owner', { accessToken: 'test-token', connectedAt: Date.now() });
    await waitUntil(() => emptyJob.stage === 'failed');
    assert.equal(publicJob(emptyJob).results.length, 0);
    assert.equal(confirmExtractionJob(emptyJob.id, 'empty-owner', []), null);

    // Provider quota is not mislabeled as Gmail failure, and unread work is counted.
    GmailService.prototype.getMessageDetails = async () => email;
    let quotaCalls = 0;
    globalThis.fetch = async () => {
      quotaCalls++;
      return new Response(JSON.stringify({ error: { details: [{
        violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
      }] } }), { status: 429 });
    };
    const quotaJob = startExtraction('quota-owner', { accessToken: 'test-token', connectedAt: Date.now() });
    await waitUntil(() => quotaJob.stage === 'failed');
    assert.equal(quotaCalls, 1);
    assert.equal(publicJob(quotaJob).errorCode, 'AI_DAILY_QUOTA');
    assert.equal(publicJob(quotaJob).skippedEmails, 2);
    assert.match(publicJob(quotaJob).error ?? '', /daily quota/);
  } finally {
    releaseSecond();
    GmailService.prototype.listMessageIds = originalList;
    GmailService.prototype.getMessageDetails = originalGet;
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalConcurrency === undefined) delete process.env.SCRAPE_CONCURRENCY;
    else process.env.SCRAPE_CONCURRENCY = originalConcurrency;
  }
});
