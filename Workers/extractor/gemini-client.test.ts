import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundedSetting, geminiResponseError, requestGemini, safeScanError } from './gemini-client.ts';

process.env.GEMINI_API_KEY = 'synthetic-test-key';
process.env.GEMINI_REQUEST_INTERVAL_MS = '0';
process.env.GEMINI_MAX_ATTEMPTS = '3';

test('503 is retried and a subsequent successful response is returned', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => ++calls === 1
      ? new Response('{}', { status: 503 })
      : new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }));
    assert.deepEqual(await requestGemini('Synthetic test', {}), { ok: true });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('daily quota fails once with actionable cause, not repeated requests', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({ error: { details: [{
        violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
      }] } }), { status: 429 });
    };
    await assert.rejects(() => requestGemini('Synthetic test', {}), { code: 'AI_DAILY_QUOTA' });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('retry delay, credential failures, Gmail reconnection and invalid settings are handled', async () => {
  const limit = await geminiResponseError(new Response(JSON.stringify({
    error: { details: [{ retryDelay: '12s' }] },
  }), { status: 429 }));
  assert.equal(limit.retryAfterMs, 12000);
  assert.equal(limit.retryable, true);
  assert.equal((await geminiResponseError(new Response('{}', { status: 403 }))).code, 'AI_AUTH');
  assert.equal(safeScanError({ response: { status: 401 } }, 'gmail').code, 'GMAIL_RECONNECT');
  process.env.TEST_INVALID_SETTING = 'nonsense';
  assert.equal(boundedSetting('TEST_INVALID_SETTING', 8, 1, 12), 8);
  delete process.env.TEST_INVALID_SETTING;
});
