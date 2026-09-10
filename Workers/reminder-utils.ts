const DAY_MS = 86_400_000;
const ALLOWED_TIME_ZONES = new Set(Intl.supportedValuesOf('timeZone'));

export function safeTimeZone(value: string | null | undefined): string {
  return value && ALLOWED_TIME_ZONES.has(value) ? value : 'Asia/Karachi';
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: safeTimeZone(timeZone), year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function daysBetweenCalendarDates(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function addBillingCycle(dateKey: string, frequency: string): string | null {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (frequency === 'weekly') date.setUTCDate(date.getUTCDate() + 7);
  else if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'annually') {
    const months = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
    const targetMonth = month - 1 + months;
    const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
    date.setUTCFullYear(year, targetMonth, Math.min(day, lastDay));
  } else return null;
  return date.toISOString().slice(0, 10);
}

export function rollRenewalForward(dateKey: string, frequency: string, todayKey: string): string {
  let current = dateKey;
  for (let guard = 0; guard < 240 && current < todayKey; guard += 1) {
    const next = addBillingCycle(current, frequency);
    if (!next || next <= current) break;
    current = next;
  }
  return current;
}

export function buildRenewalMessage(serviceName: string, renewalDate: string, daysRemaining: number, amount?: string | null): string {
  const when = daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`;
  return `SubTrack reminder: ${serviceName} renews ${when} (${renewalDate})${amount ? ` for ${amount}` : ''}. Review or update it in SubTrack.`;
}
