import { setTimeout as delay } from 'node:timers/promises';

export class ScanError extends Error {
  code: string;
  retryable: boolean;
  retryAfterMs: number;
  constructor(message: string, code: string, retryable = false, retryAfterMs = 0) {
    super(message);
    this.name = 'ScanError';
    this.code = code;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
  }
}

export function boundedSetting(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback;
}

export function safeScanError(error: unknown, service: 'gmail' | 'ai'): ScanError {
  if (error instanceof ScanError) return error;
  const failure = error as { code?: unknown; response?: { status?: number; data?: { error?: unknown } } };
  const status = failure?.response?.status ?? failure?.code;
  if (service === 'gmail' && (status === 401 || failure?.response?.data?.error === 'invalid_grant')) {
    return new ScanError('Gmail access expired or was revoked. Reconnect Gmail to continue.', 'GMAIL_RECONNECT');
  }
  if (service === 'gmail' && status === 403) {
    return new ScanError('Gmail denied read access. Reconnect with Gmail permission and check that the Gmail API is enabled.', 'GMAIL_RECONNECT');
  }
  return new ScanError(
    service === 'gmail' ? 'An email could not be read from Gmail. Try again.' : 'AI could not review this email. Try again.',
    service === 'gmail' ? 'GMAIL_READ_FAILED' : 'AI_RESPONSE_INVALID',
  );
}

export async function geminiResponseError(response: Response): Promise<ScanError> {
  const data = await response.json().catch(() => ({})) as {
    error?: { details?: Array<{ retryDelay?: string; violations?: Array<{ quotaId?: string }> }> };
  };
  const details = data.error?.details ?? [];
  const dailyQuota = details.some((detail) => detail.violations?.some((v) => /PerDay/i.test(v.quotaId ?? '')));
  const retrySeconds = Number.parseFloat(details.find((detail) => detail.retryDelay)?.retryDelay ?? '');
  const header = response.headers.get('retry-after');
  const headerMs = header ? (/^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header) - Date.now()) : 0;
  const retryMs = Math.max(0, headerMs || 0, Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 0);
  if (response.status === 429) {
    return new ScanError(
      dailyQuota ? 'The configured Gemini model has reached its daily quota. Findings are retained; retry after quota resets or configure a model with available quota.'
        : 'Gemini is rate-limiting requests. Findings are retained; please try again shortly.',
      dailyQuota ? 'AI_DAILY_QUOTA' : 'AI_RATE_LIMIT', !dailyQuota, retryMs,
    );
  }
  if (response.status === 401 || response.status === 403) {
    return new ScanError('Gemini rejected the API credentials. Check GEMINI_API_KEY in the project .env.', 'AI_AUTH');
  }
  if (response.status === 404) {
    return new ScanError('The configured Gemini model is unavailable. Check GEMINI_MODEL in the project .env.', 'AI_MODEL');
  }
  if (response.status >= 500) {
    return new ScanError('Gemini is temporarily unavailable after retrying. Findings are retained; try again shortly.', 'AI_UNAVAILABLE', true, retryMs);
  }
  return new ScanError('Gemini rejected the analysis request. Check the API key and model configuration.', 'AI_REQUEST');
}

let queue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

/** One paced request at a time across scans; retries never flood an exhausted provider. */
export function requestGemini(prompt: string, payload: unknown, onStatus?: (message: string) => void): Promise<unknown> {
  const task = queue.then(async () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new ScanError('Set GEMINI_API_KEY in the project .env before scanning.', 'AI_CONFIG');
    const model = (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').replace(/^models\//, '');
    const attempts = boundedSetting('GEMINI_MAX_ATTEMPTS', 3, 1, 3);
    const interval = boundedSetting('GEMINI_REQUEST_INTERVAL_MS', 6500, 0, 60000);
    for (let attempt = 0; attempt < attempts; attempt++) {
      const wait = Math.max(0, nextRequestAt - Date.now());
      if (wait) {
        onStatus?.('Waiting briefly before reviewing more emails');
        await delay(wait);
      }
      nextRequestAt = Date.now() + interval;
      onStatus?.('Reviewing emails with AI');
      try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          signal: AbortSignal.timeout(boundedSetting('GEMINI_TIMEOUT_MS', 60000, 1000, 120000)),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: prompt }] },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0 },
          }),
        });
        if (!response.ok) throw await geminiResponseError(response);
        const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
        const text = data.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? '').join('') ?? '';
        try {
          return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
        } catch {
          throw new ScanError('AI returned an unreadable email analysis. Please retry.', 'AI_RESPONSE_INVALID');
        }
      } catch (error) {
        const failure = error instanceof ScanError ? error
          : new ScanError('The connection to Gemini timed out or failed. Please retry.', 'AI_NETWORK', true);
        console.warn('[Extraction AI]', { code: failure.code, model, attempt: attempt + 1 });
        if (!failure.retryable || attempt + 1 === attempts || failure.retryAfterMs > 60000) throw failure;
        const backoff = Math.max(failure.retryAfterMs, 1000 * 2 ** attempt);
        onStatus?.('AI is busy. Retrying email review shortly');
        await delay(backoff);
      }
    }
    throw new ScanError('AI review could not finish.', 'AI_UNAVAILABLE');
  });
  queue = task.then(() => undefined, () => undefined);
  return task;
}
