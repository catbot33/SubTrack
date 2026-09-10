import type { ScrapedEmail, SubscriptionResult } from './types.ts';

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const genericName = /^(?:no[ -]?reply|receipts?|billing|support|notifications?|updates?|payments?|accounts?|team|hello|info|mail|email)$/i;
// These senders may deliver another merchant's receipt; never use them as the provider.
const intermediary = /\b(stripe|paypal|paddle|lemonsqueezy|lemon squeezy|chargebee|recurly|braintree|adyen|fastspring|sendgrid|mailgun|amazonses|postmark|processor|gmail|outlook|hotmail|yahoo|protonmail)\b/i;

export function isIntermediary(value: string): boolean {
  return intermediary.test(value);
}

export function senderMerchant(from: string): { name: string; explanation: string } | undefined {
  const address = from.match(/<?([^\s<>]+@([^\s<>]+))>?/);
  if (!address || isIntermediary(from)) return undefined;
  const display = from.slice(0, address.index).replace(/[<"']/g, '').trim()
    .replace(/\s+(?:billing|receipts?|support|notifications?|team)$/i, '').trim();
  if (display && !genericName.test(display) && display.length <= 100) {
    return { name: display, explanation: 'Identified from the email sender name.' };
  }
  // Keep the actual domain visible instead of inventing a brand spelling.
  const domain = address[2].toLowerCase().replace(/^(?:(?:mail|email|billing|receipts?|notifications?|updates?|noreply)\.)+/, '');
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain) || genericName.test(domain.split('.')[0])) return undefined;
  return { name: domain, explanation: 'Identified from the sender domain; check the provider name before confirming.' };
}

export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addCalendarInterval(start: string, count: number, unit: string): string {
  const date = new Date(start + 'T00:00:00Z');
  if (unit === 'days' || unit === 'weeks') date.setUTCDate(date.getUTCDate() + count * (unit === 'weeks' ? 7 : 1));
  else {
    const day = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + count * (unit === 'years' ? 12 : 1));
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(day, lastDay));
  }
  return date.toISOString().slice(0, 10);
}

function receivedCalendarDay(email: ScrapedEmail): string | undefined {
  // Preserve the sender's calendar day and timezone when supplied by the Date header.
  const headerDay = email.date.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/)?.[1];
  const mailDay = email.date.match(/(?:^|,\s*)(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const senderDay = mailDay ? mailDay[3] + '-' + String(months.indexOf(mailDay[2].toLowerCase()) + 1).padStart(2, '0') + '-' + mailDay[1].padStart(2, '0') : headerDay;
  if (senderDay && validDate(senderDay)) return senderDay;
  if (Number.isFinite(email.timestamp)) return new Date(email.timestamp).toISOString().slice(0, 10);
  return undefined;
}

/** AI selects source facts; deterministic calendar arithmetic computes the estimate. */
export function estimateRenewal(email: ScrapedEmail, result: SubscriptionResult, raw: unknown): SubscriptionResult['renewalEstimate'] {
  if (result.renewalOrEndDate || result.tag === 'cancellation') return undefined;
  const sources = [email.subject, email.bodyText, ...email.attachments.map((item) => item.textContent ?? '')].map(normalize);
  const supported = (quote: unknown): quote is string => typeof quote === 'string' && quote.trim().length > 0 &&
    quote.length <= 1000 && sources.some((source) => source.includes(normalize(quote)));

  if (result.tag === 'subscription') {
    const interval = { weekly: [1, 'weeks'], monthly: [1, 'months'], quarterly: [3, 'months'], annually: [1, 'years'] } as const;
    const selected = interval[result.billingFrequency as keyof typeof interval];
    const intervalEvidence = result.evidence?.billingFrequency;
    const receivedDay = receivedCalendarDay(email);
    if (!selected || !supported(intervalEvidence) || !receivedDay) return undefined;
    const [count, unit] = selected;
    return {
      date: addCalendarInterval(receivedDay, count, unit),
      explanation: `Projected from the email received date: ${receivedDay} + ${count} ${unit}. Interval evidence: “${intervalEvidence}”`,
    };
  }

  if (!raw || typeof raw !== 'object') return undefined;
  const basis = raw as Record<string, unknown>;
  if (basis.event !== 'start' || !supported(basis.eventEvidence)) return undefined;
  let start: string;
  let anchorDescription: string;
  if (basis.startDate != null) {
    if (!validDate(basis.startDate) || !supported(basis.startEvidence)) return undefined;
    start = basis.startDate;
    anchorDescription = 'start/charge date stated in the email';
  } else {
    const receivedDay = receivedCalendarDay(email);
    if (!receivedDay) return undefined;
    start = receivedDay;
    anchorDescription = 'email date, assumed to be the start/charge date';
  }
  let count: number;
  let unit: string;
  let quote: string;
  if (result.tag === 'trial') {
    if (!Number.isInteger(basis.trialLength) || Number(basis.trialLength) < 1 || Number(basis.trialLength) > 366 ||
        !['days', 'weeks', 'months'].includes(String(basis.trialUnit)) || !supported(basis.trialEvidence)) return undefined;
    count = Number(basis.trialLength);
    unit = String(basis.trialUnit);
    quote = basis.trialEvidence;
    const durationText = normalize(quote).replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|fourteen|thirty)\b/g,
      (word) => String(({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fourteen: 14, thirty: 30 } as Record<string, number>)[word]));
    const duration = new RegExp('(?:^|[^0-9])' + count + '[\\s-]*' + unit.replace(/s$/, '') + 's?\\b');
    if (!duration.test(durationText)) return undefined;
  } else return undefined;
  const date = addCalendarInterval(start, count, unit);
  return { date, explanation: 'Estimated: ' + start + ' (' + anchorDescription + ') + ' + count + ' ' + unit + '. Interval evidence: “' + quote + '”' };
}
