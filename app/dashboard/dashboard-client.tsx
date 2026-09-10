'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AddIcon,
  BellIcon,
  CalendarMarkIcon,
  CardIcon,
  CheckCircleIcon,
  DangerCircleIcon,
  LetterIcon,
  LinkRoundIcon,
  Logout2Icon,
  MagnifierIcon,
  DownloadMinimalisticIcon,
  MenuDotsIcon,
  RestartIcon,
  SettingsMinimalisticIcon,
  ShieldCheckIcon,
  SidebarMinimalisticIcon,
  TrashBinMinimalisticIcon,
  Widget5Icon,
} from '@solar-icons/react/linear';
import { Widget5Icon as ActiveOverviewIcon, CardIcon as ActiveCardIcon, DangerCircleIcon as ActiveReviewIcon, BellIcon as ActiveBellIcon, LinkRoundIcon as ActiveLinkIcon } from '@solar-icons/react/bold';
import styles from './dashboard.module.css';
import type { SubscriptionEvidence, SubscriptionResult } from '../../Workers/extractor/types';
import type { SavedSubscription } from '../../Workers/subscription-store';
import ManualSubscriptionDialog from './manual-subscription-dialog';
import { ConnectionsPanel, RemindersPanel } from './reminder-panels';

type DashboardUser = { name: string; email: string; avatar?: string };
type Subscription = {
  candidateId?: string;
  emailId: string;
  subject: string;
  from: string;
  date: string;
  timestamp: number;
  tag: 'subscription' | 'trial';
  serviceName: string;
  amount?: string;
  billingFrequency?: string;
  renewalOrEndDate?: string;
  merchantInference?: string;
  renewalEstimate?: SubscriptionResult['renewalEstimate'];
  summary: string;
  evidence?: SubscriptionEvidence;
};
type JobResponse = {
  jobId: string;
  total: number;
  processed: number;
  percentage: number;
  stage: 'finding' | 'reading' | 'classifying' | 'preparing' | 'completed' | 'cancelled' | 'failed' | 'confirmed';
  detail: string;
  results: Subscription[];
  error?: string;
  errorCode?: string;
  reconnectUrl?: string;
  skippedEmails?: number;
};
type View = 'idle' | 'scanning' | 'review' | 'confirmed' | 'error';
type Screen = 'Overview' | 'Subscriptions' | 'Needs review' | 'Reminders' | 'Connections';

const workspaceNavigation = [
  { label: 'Overview', icon: Widget5Icon, activeIcon: ActiveOverviewIcon },
  { label: 'Subscriptions', icon: CardIcon, activeIcon: ActiveCardIcon },
  { label: 'Needs review', icon: DangerCircleIcon, activeIcon: ActiveReviewIcon },
  { label: 'Reminders', icon: BellIcon, activeIcon: ActiveBellIcon },
] as const;
const accountNavigation = [
  { label: 'Connections', icon: LinkRoundIcon, activeIcon: ActiveLinkIcon },
] as const;

function initialsFor(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'ST';
}

function formatRenewal(date?: string): string {
  if (!date) return 'Needs details';
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'));
}

const supportedCurrencyCodes = [
  'AED', 'ARS', 'AUD', 'BDT', 'BGN', 'BHD', 'BRL', 'CAD', 'CHF', 'CLP', 'CNY', 'COP', 'CZK', 'DKK', 'DZD', 'EGP',
  'EUR', 'GBP', 'GHS', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JOD', 'JPY', 'KES', 'KRW', 'KWD', 'LKR', 'MAD',
  'MXN', 'MYR', 'NGN', 'NOK', 'NPR', 'NZD', 'OMR', 'PEN', 'PHP', 'PKR', 'PLN', 'QAR', 'RON', 'RSD', 'RUB', 'SAR',
  'SEK', 'SGD', 'THB', 'TRY', 'TWD', 'UAH', 'USD', 'VND', 'ZAR',
] as const;

function parseSavedAmount(value?: string): { amount: number; currency: string } | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  const explicitCode = supportedCurrencyCodes.find((code) => new RegExp(`\\b${code}\\b`).test(upper));
  const currency = explicitCode || (upper.includes('CA$') || upper.includes('C$') ? 'CAD'
    : upper.includes('AU$') || upper.includes('A$') ? 'AUD'
      : upper.includes('NZ$') ? 'NZD' : upper.includes('SG$') ? 'SGD'
        : value.includes('€') ? 'EUR' : value.includes('£') ? 'GBP' : value.includes('₹') ? 'INR'
          : value.includes('¥') ? 'JPY' : /\bRS\.?\s/i.test(value) ? 'PKR' : value.includes('$') ? 'USD' : undefined);
  const numericText = value.replace(/[^0-9.,-]/g, '');
  const lastComma = numericText.lastIndexOf(',');
  const lastDot = numericText.lastIndexOf('.');
  const normalizedNumber = lastComma >= 0 && lastDot >= 0
    ? lastComma > lastDot
      ? numericText.replaceAll('.', '').replace(',', '.')
      : numericText.replaceAll(',', '')
    : lastComma >= 0
      ? numericText.length - lastComma - 1 <= 2 ? numericText.replace(',', '.') : numericText.replaceAll(',', '')
      : numericText.split('.').length > 2 ? numericText.replaceAll('.', '') : numericText;
  const numeric = Number(normalizedNumber);
  return currency && Number.isFinite(numeric) ? { amount: numeric, currency } : null;
}

function projectedAnnualUsd(item: SavedSubscription, usdRates: Record<string, number>): number | null {
  const parsed = parseSavedAmount(item.amount);
  if (!parsed) return null;
  const multiplier = ({ weekly: 52, monthly: 12, quarterly: 4, annually: 1 } as Record<string, number>)[item.billingFrequency || ''];
  const usdRate = usdRates[parsed.currency];
  return multiplier && Number.isFinite(usdRate) ? parsed.amount * multiplier * usdRate : null;
}

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DashboardClient({
  user,
  autoStart,
}: {
  user: DashboardUser;
  autoStart: boolean;
}) {
  const [view, setView] = useState<View>(autoStart ? 'scanning' : 'idle');
  const [job, setJob] = useState<JobResponse | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [pendingCandidates, setPendingCandidates] = useState<Subscription[]>([]);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState<Screen>(autoStart ? 'Needs review' : 'Overview');
  const [saved, setSaved] = useState<SavedSubscription[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'monthly' | 'annually' | 'trial'>('all');
  const [libraryQuery, setLibraryQuery] = useState('');
  const [renewalWindow, setRenewalWindow] = useState<3 | 7 | 14>(14);
  const [reminderSaving, setReminderSaving] = useState<string | null>(null);
  const [usdRates, setUsdRates] = useState<Record<string, number>>({ USD: 1 });
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesUnavailable, setRatesUnavailable] = useState(false);
  const confirmLock = useRef(false);
  const latestJob = useRef<JobResponse | null>(null);

  const refreshSaved = useCallback(async () => {
    const response = await fetch('/api/subscriptions', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load subscriptions.');
    setSaved(data.subscriptions as SavedSubscription[]);
    setLoadError('');
  }, []);

  const refreshCandidates = useCallback(async () => {
    const response = await fetch('/api/review-candidates', { cache: 'no-store' });
    const data = await response.json() as { candidates?: Subscription[]; error?: string };
    if (!response.ok) throw new Error(data.error || 'Unable to load new Gmail findings.');
    const candidates = data.candidates ?? [];
    setPendingCandidates(candidates);
    return candidates;
  }, []);

  const selectScreen = (next: Screen) => {
    setScreen(next);
    if (next === 'Subscriptions' || next === 'Reminders') {
      void refreshSaved().catch(() => setLoadError('Unable to load saved subscriptions. Refresh to retry.'));
    }
    if (next === 'Needs review') {
      void refreshCandidates().then((candidates) => {
        if (view === 'idle' && candidates.length) { setSubscriptions(candidates); setJob(null); setView('review'); }
      }).catch(() => setLoadError('Unable to load new Gmail findings. Refresh to retry.'));
    }
  };

  const startScan = useCallback(async () => {
    setScreen('Needs review');
    setView('scanning');
    setError('');
    setSubscriptions([]);
    latestJob.current = null;
    setJob({
      jobId: '', total: 0, processed: 0, percentage: 2, stage: 'finding',
      detail: 'Connecting securely to Gmail', results: [],
    });
    try {
      const response = await fetch('/api/extraction/start', { method: 'POST' });
      const data = (await response.json()) as JobResponse & { error?: string };
      if (response.status === 409 && data.reconnectUrl) {
        window.location.assign(data.reconnectUrl);
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Unable to start the Gmail scan.');
      setJob(data);
      latestJob.current = data;
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Unable to start the Gmail scan.');
      setView('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      try {
        await Promise.all([refreshSaved(), refreshCandidates()]);
        if (!active) return;
      } catch { if (active) setLoadError('Unable to load saved subscriptions. Refresh to retry.'); }
      if (!active) return;
      setReady(true);
      if (autoStart) { window.history.replaceState(null, '', '/dashboard'); void startScan(); }
    };
    void restore();
    return () => { active = false; };
  }, [autoStart, refreshCandidates, refreshSaved, startScan]);

  useEffect(() => {
    const poll = setInterval(() => {
      void refreshCandidates().then((candidates) => {
        if (screen === 'Needs review' && view === 'idle' && candidates.length) {
          setSubscriptions(candidates); setJob(null); setView('review');
        }
      }).catch(() => undefined);
    }, 15_000);
    return () => clearInterval(poll);
  }, [refreshCandidates, screen, view]);

  const savedCurrencyKey = [...new Set(saved.map((item) => parseSavedAmount(item.amount)?.currency).filter((currency): currency is string => Boolean(currency && currency !== 'USD')))].sort().join(',');
  useEffect(() => {
    if (!savedCurrencyKey) {
      setUsdRates({ USD: 1 });
      setRatesLoading(false);
      setRatesUnavailable(false);
      return;
    }
    const controller = new AbortController();
    setRatesLoading(true);
    setRatesUnavailable(false);
    void fetch(`/api/exchange-rates?currencies=${encodeURIComponent(savedCurrencyKey)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { rates?: Record<string, number>; error?: string };
        if (!response.ok || !data.rates) throw new Error(data.error || 'Dollar conversion rates are unavailable.');
        setUsdRates({ USD: 1, ...data.rates });
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setRatesUnavailable(true);
      })
      .finally(() => { if (!controller.signal.aborted) setRatesLoading(false); });
    return () => controller.abort();
  }, [savedCurrencyKey]);

  useEffect(() => {
    if (view !== 'scanning' || !job?.jobId) return;
    let active = true;
    let pollFailures = 0;
    let nextPoll: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`/api/extraction/status/${job.jobId}`, { cache: 'no-store' });
        const data = (await response.json()) as JobResponse & { error?: string };
        if (!response.ok) throw new Error(data.error || 'Unable to read scan progress.');
        if (!active) return;
        pollFailures = 0;
        setJob(data);
        latestJob.current = data;
        setSubscriptions(data.results);
        setError('');
        if (data.stage === 'completed' || data.stage === 'cancelled') {
          setView('review');
        } else if (data.stage === 'confirmed') {
          setView('confirmed');
        } else if (data.stage === 'failed') {
          setError(data.error || data.detail);
          setView(data.results.length ? 'review' : 'error');
        } else {
          nextPoll = setTimeout(() => void poll(), 900);
        }
      } catch (pollError) {
        if (!active) return;
        if (++pollFailures < 3) {
          nextPoll = setTimeout(() => void poll(), 1500 * pollFailures);
          return;
        }
        setError(pollError instanceof Error ? pollError.message : 'The scan stopped unexpectedly.');
        setView(latestJob.current?.results.length ? 'review' : 'error');
      }
    };
    void poll();
    return () => {
      active = false;
      if (nextPoll) clearTimeout(nextPoll);
    };
  }, [job?.jobId, view]);

  const cancelScan = async () => {
    if (!job?.jobId || cancelling) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/extraction/cancel/${encodeURIComponent(job.jobId)}`, { method: 'POST' });
      const data = (await response.json()) as JobResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Unable to cancel the scan.');
      setJob(data);
      latestJob.current = data;
      setSubscriptions(data.results);
      setError('');
      setView('review');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to cancel the scan.');
    } finally {
      setCancelling(false);
    }
  };

  const updateSubscription = (index: number, field: keyof Subscription, value: string) => {
    setSubscriptions((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item,
    ));
  };

  const confirmSubscriptions = async () => {
    const isWebhookReview = subscriptions.length > 0 && subscriptions.every((item) => Boolean(item.candidateId));
    if ((!job?.jobId && !isWebhookReview) || confirmLock.current) return;
    confirmLock.current = true;
    setConfirming(true);
    if (subscriptions.some((item) => !item.serviceName.trim() || !item.billingFrequency || item.billingFrequency === 'Not found' || !/^\d{4}-\d{2}-\d{2}$/.test(item.renewalOrEndDate || ''))) {
      setError('Merchant, billing frequency, and renewal date are required for every subscription.');
      setView('review');
      confirmLock.current = false;
      setConfirming(false);
      return;
    }
    try {
      const response = await fetch(isWebhookReview ? '/api/review-candidates/confirm' : '/api/extraction/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job?.jobId, subscriptions }),
      });
      const data = (await response.json()) as JobResponse & { error?: string; savedSubscriptions: SavedSubscription[] };
      if (!response.ok) throw new Error(data.error || 'Unable to confirm subscriptions.');
      setJob(data);
      setSaved((current) => [...new Map([...data.savedSubscriptions, ...current].map((item) => [item.id, item])).values()]);
      if (isWebhookReview) setPendingCandidates((current) => current.filter((item) => !subscriptions.some((savedItem) => savedItem.candidateId === item.candidateId)));
      setError('');
      setView('confirmed');
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Unable to confirm subscriptions.');
      setView('review');
    } finally {
      confirmLock.current = false;
      setConfirming(false);
    }
  };

  const removeReviewItem = async (subscription: Subscription, index: number) => {
    if (!subscription.candidateId) {
      setSubscriptions((current) => current.filter((_, itemIndex) => itemIndex !== index));
      return;
    }
    try {
      const response = await fetch(`/api/review-candidates/${encodeURIComponent(subscription.candidateId)}/dismiss`, { method: 'POST' });
      if (!response.ok) throw new Error('Unable to dismiss this finding.');
      setSubscriptions((current) => current.filter((item) => item.candidateId !== subscription.candidateId));
      setPendingCandidates((current) => current.filter((item) => item.candidateId !== subscription.candidateId));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to dismiss this finding.'); }
  };

  const scanProgress = (() => {
    if (view === 'scanning') {
      const percentage = job?.percentage ?? 2;
      const scanTitles: Partial<Record<JobResponse['stage'], string>> = {
        finding: 'Connecting to Gmail',
        reading: 'Extracting emails',
        classifying: 'Reviewing emails',
        preparing: 'Preparing your review',
      };
      const scanTitle = scanTitles[job?.stage ?? 'finding'] ?? 'Finding your subscriptions';
      return (
        <section className={styles.scanState} aria-live="polite" aria-labelledby="scan-title">
          <div className={styles.scanIcon} aria-hidden="true"><RestartIcon /></div>
          <p className={styles.progressValue}>{percentage}%</p>
          <h2 id="scan-title">{scanTitle}</h2>
          <p className={styles.scanDetail}>{job?.detail || 'Connecting securely to Gmail'}</p>
          <div className={styles.progressTrack} role="progressbar" aria-label="Gmail scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
            <span style={{ width: `${percentage}%` }} />
          </div>
          <p className={styles.currentTask}>
            {job?.total ? `${job.processed} of ${job.total} emails processed` : 'Finding subscription-related emails in your inbox.'}
          </p>
          <button className={styles.cancelScanButton} type="button" disabled={cancelling || !job?.jobId} onClick={() => void cancelScan()}>
            {cancelling ? 'Cancelling…' : 'Cancel scan'}
          </button>
        </section>
      );
    }
    return null;
  })();

  const content = (() => {
    if (view === 'scanning' && !subscriptions.length) return scanProgress;
    if (view === 'review' || view === 'scanning') {
      const isScanning = view === 'scanning';
      const webhookReview = !job && subscriptions.some((item) => Boolean(item.candidateId));
      const canConfirm = webhookReview || job?.stage === 'completed' || job?.stage === 'failed' || job?.stage === 'cancelled';
      const incomplete = Boolean(job?.skippedEmails || job?.stage === 'failed' || job?.stage === 'cancelled' || error);
      return (
        <section className={styles.reviewState} aria-labelledby="review-title">
          {isScanning ? <div className={styles.liveProgress}>{scanProgress}</div> : null}
          <div className={styles.reviewHeader}>
            <div>
              <p className={styles.sectionLabel}>{isScanning ? 'Found so far' : webhookReview ? 'New Gmail finding' : job?.stage === 'cancelled' ? 'Scan cancelled' : incomplete ? 'Scan incomplete' : 'Scan complete'}</p>
              <h2 id="review-title">{isScanning ? 'Subscriptions found' : webhookReview ? 'Review new subscriptions' : 'Review your subscriptions'}</h2>
              <p>{isScanning ? 'Results appear as emails are reviewed. You can edit them once the scan stops.' : webhookReview ? 'New Updates emails were checked by AI. Confirm the subscriptions you want saved, or dismiss them.' : 'Review the details found in your emails. Projected dates use the trial length or billing cycle. You can edit any field.'}</p>
            </div>
            <span className={styles.resultCount}>{subscriptions.length} found</span>
          </div>

          {incomplete ? (
            <p className={styles.scanWarning} role="status">
              {job?.stage === 'cancelled' ? 'The scan was cancelled. ' : error ? error + ' ' : (job?.skippedEmails ?? 0) + ' emails couldn’t be reviewed. '}
              {subscriptions.length ? 'Your findings are still shown below.' : 'No subscriptions were identified in the emails reviewed.'}
              {!isScanning && canConfirm && subscriptions.length ? ' You can edit and confirm these now.' : ''}
            </p>
          ) : null}

          {subscriptions.length ? (
            <div className={styles.subscriptionList}>
              {subscriptions.map((subscription, index) => (
                <article className={styles.subscriptionCard} key={subscription.emailId}>
                  <div className={styles.subscriptionIdentity}>
                    <span className={styles.serviceMark} aria-hidden="true">{subscription.serviceName.slice(0, 1).toUpperCase()}</span>
                    <label>
                      <span>Merchant</span>
                      <input disabled={isScanning || confirming} placeholder="Not found in email" value={subscription.serviceName === 'Not found' ? '' : subscription.serviceName} onChange={(event) => updateSubscription(index, 'serviceName', event.target.value)} />
                    </label>
                  </div>
                  <label>
                    <span>Cost</span>
                    <input disabled={isScanning || confirming} placeholder="Not found in email" value={subscription.amount ?? ''} onChange={(event) => updateSubscription(index, 'amount', event.target.value)} />
                  </label>
                  <label>
                    <span>Billing cycle</span>
                    <select disabled={isScanning || confirming} value={subscription.billingFrequency ?? 'Not found'} onChange={(event) => updateSubscription(index, 'billingFrequency', event.target.value)}>
                      <option value="Not found">Not found</option><option value="monthly">Monthly</option><option value="annually">Annually</option><option value="weekly">Weekly</option><option value="quarterly">Quarterly</option><option value="other">Other</option>
                    </select>
                  </label>
                  <label>
                    <span>{subscription.tag === 'trial' ? 'Trial ends' : 'Next renewal'}{subscription.renewalEstimate && subscription.renewalEstimate.date === subscription.renewalOrEndDate ? ' · Projected' : ''}</span>
                    <input type="date" disabled={isScanning || confirming} value={subscription.renewalOrEndDate ?? ''} onChange={(event) => updateSubscription(index, 'renewalOrEndDate', event.target.value)} />
                  </label>
                  <button disabled={isScanning || confirming} className={styles.removeButton} type="button" aria-label={`Remove ${subscription.serviceName}`} onClick={() => void removeReviewItem(subscription, index)}>
                    <TrashBinMinimalisticIcon aria-hidden="true" />
                  </button>
                  <details className={styles.emailEvidence}>
                    <summary>What AI found in this email</summary>
                    <p className={styles.sourceEmail}>{subscription.subject} · {subscription.from}</p>
                    {subscription.merchantInference ? <p>{subscription.merchantInference}</p> : null}
                    {subscription.renewalEstimate ? <p>{subscription.renewalEstimate.explanation}{subscription.renewalEstimate.date !== subscription.renewalOrEndDate ? ' You edited the calculated date.' : ''}</p> : null}
                    <dl>
                      {([
                        ['status', 'Active-status evidence'],
                        ['serviceName', 'Merchant'],
                        ['amount', 'Cost'],
                        ['billingFrequency', 'Billing cycle'],
                        ['renewalOrEndDate', subscription.tag === 'trial' ? 'Trial ends' : 'Next renewal'],
                      ] as const).map(([field, label]) => (
                        <div key={field}>
                          <dt>{label}</dt>
                          <dd>{subscription.evidence?.[field] || (field === 'renewalOrEndDate' && subscription.renewalEstimate ? 'Calculated from the email details, as explained above.' : 'Not stated clearly in this email.')}</dd>
                        </div>
                      ))}
                    </dl>
                    <p>Original email excerpts stay unchanged when you edit the fields above.</p>
                  </details>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.noResults}>
              <LetterIcon aria-hidden="true" />
              <h3>{incomplete ? 'No subscriptions found in the reviewed emails' : 'No active subscriptions found'}</h3>
              <p>You can scan again later or add a subscription manually.</p>
            </div>
          )}

          {!isScanning ? <div className={styles.reviewActions}>
            {!canConfirm && job?.jobId ? <button className={styles.secondaryButton} type="button" onClick={() => { setError(''); setView('scanning'); }}>Resume status updates</button> : null}
            <button disabled={confirming} className={styles.secondaryButton} type="button" onClick={() => void startScan()}><RestartIcon aria-hidden="true" /><span>Scan again</span></button>
            {subscriptions.length && canConfirm ? <button disabled={confirming} className={styles.confirmButton} type="button" onClick={() => void confirmSubscriptions()}><CheckCircleIcon aria-hidden="true" /><span>{confirming ? 'Saving…' : 'Confirm subscriptions'}</span></button> : null}
          </div> : null}
        </section>
      );
    }

    if (view === 'confirmed') {
      return (
        <section className={styles.emptyState} aria-labelledby="confirmed-title">
          <div className={styles.successIcon} aria-hidden="true"><CheckCircleIcon /></div>
          <h2 id="confirmed-title">Subscriptions confirmed</h2>
          <p className={styles.emptyDescription}>{subscriptions.length} {subscriptions.length === 1 ? 'subscription is' : 'subscriptions are'} ready in SubTrack.</p>
          <button className={styles.connectButton} type="button" onClick={() => setScreen('Subscriptions')}>View subscriptions</button>
        </section>
      );
    }

    if (view === 'error') {
      return (
        <section className={styles.emptyState} aria-labelledby="error-title">
          <div className={styles.errorIcon} aria-hidden="true"><DangerCircleIcon /></div>
          <h2 id="error-title">{job?.errorCode?.startsWith('AI_') ? 'Email analysis paused' : job?.errorCode === 'GMAIL_RECONNECT' ? 'Reconnect Gmail' : 'Email scan paused'}</h2>
          <p className={styles.emptyDescription}>{error || 'Check your connection and try again.'}</p>
          {job?.reconnectUrl
            ? <a className={styles.connectButton} href={job.reconnectUrl}>Reconnect Gmail</a>
            : <button className={styles.connectButton} type="button" onClick={() => void startScan()}><RestartIcon aria-hidden="true" /><span>Retry scan</span></button>}
        </section>
      );
    }

    return (
      <section className={styles.emptyState} aria-labelledby="empty-state-title">
        <div className={styles.mailIcon} aria-hidden="true"><LetterIcon /></div>
        <h2 id="empty-state-title">No subscriptions yet</h2>
        <p className={styles.emptyDescription}>Connect an inbox from Connections to extract subscriptions, or add one manually.</p>
        <button className={styles.connectButton} type="button" onClick={() => setScreen('Connections')}><LinkRoundIcon aria-hidden="true" /><span>Open connections</span></button>
      </section>
    );
  })();

  const reviewCount = pendingCandidates.length + (job ? (view === 'scanning' ? Math.max(1, subscriptions.length) : view === 'review' ? subscriptions.length : 0) : 0);
  const openManual = () => {
    setSaveNotice('');
    setManualOpen(true);
  };
  const filteredSaved = saved.filter((item) => {
    const matchesFilter = libraryFilter === 'all' || (libraryFilter === 'trial' ? item.tag === 'trial' : item.billingFrequency === libraryFilter);
    return matchesFilter && item.serviceName.toLowerCase().includes(libraryQuery.trim().toLowerCase());
  });
  const toggleReminder = async (item: SavedSubscription) => {
    if (reminderSaving) return;
    setReminderSaving(item.id);
    setLoadError('');
    try {
      const response = await fetch(`/api/subscriptions/${encodeURIComponent(item.id)}/reminder`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !item.reminderEnabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update the reminder.');
      setSaved((current) => current.map((savedItem) => savedItem.id === item.id ? data.subscription : savedItem));
    } catch (cause) { setLoadError(cause instanceof Error ? cause.message : 'Unable to update the reminder.'); }
    finally { setReminderSaving(null); }
  };
  const exportSubscriptions = () => {
    const quote = (value?: string) => `"${String(value || '').replaceAll('"', '""')}"`;
    const csv = ['Merchant,Frequency,Amount,Next renewal,Source', ...filteredSaved.map((item) =>
      [item.serviceName, item.billingFrequency, item.amount, item.renewalOrEndDate, item.source].map(quote).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'subtrack-subscriptions.csv'; link.click(); URL.revokeObjectURL(url);
  };
  const pricedSubscriptions = saved.filter((item) => Boolean(parseSavedAmount(item.amount)));
  const annualAmounts = saved.map((item) => projectedAnnualUsd(item, usdRates)).filter((value): value is number => value !== null);
  const annualTotal = annualAmounts.reduce((total, value) => total + value, 0);
  const totalsPending = ratesLoading && Boolean(savedCurrencyKey);
  const totalsIncomplete = ratesUnavailable || annualAmounts.length < pricedSubscriptions.length;
  const monthlyTotalText = totalsPending || totalsIncomplete ? '$—' : formatUsd(annualTotal / 12);
  const annualTotalText = totalsPending || totalsIncomplete ? '$—' : formatUsd(annualTotal);
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const upcomingWithin14Days = saved.filter((item) => {
    if (!item.renewalOrEndDate) return false;
    const renewal = Date.parse(item.renewalOrEndDate + 'T00:00:00Z');
    return renewal >= todayUtc && renewal <= todayUtc + 14 * 24 * 60 * 60 * 1000;
  }).sort((left, right) => Date.parse(left.renewalOrEndDate + 'T00:00:00Z') - Date.parse(right.renewalOrEndDate + 'T00:00:00Z'));
  const upcomingSubscriptions = upcomingWithin14Days.filter((item) => Date.parse(item.renewalOrEndDate + 'T00:00:00Z') <= todayUtc + renewalWindow * 24 * 60 * 60 * 1000);
  const upcomingCount = upcomingWithin14Days.length;
  const reminderCount = saved.filter((item) => item.reminderEnabled).length;
  const missingReminders = Math.max(0, saved.length - reminderCount);
  const reminderCoverage = saved.length ? Math.round((reminderCount / saved.length) * 100) : 0;
  const reminderCoverageTitle = reminderCount === saved.length
    ? 'All renewals are protected'
    : reminderCount === 0
      ? 'Your renewals need protection'
      : reminderCount * 2 >= saved.length
        ? 'Most renewals are protected'
        : 'Some renewals are protected';
  const overviewContent = (
    <section className={styles.overview} aria-label="Subscription overview">
      <div className={styles.spendingCard}>
        <div className={styles.spendingCopy}>
          <div className={styles.spendingHeadlines} aria-label={`${monthlyTotalText} monthly spent; ${annualTotalText} yearly projected`}>
            <p><strong>{monthlyTotalText}</strong><span> monthly spent</span></p>
            <p><strong>{annualTotalText}</strong><span> yearly projected</span></p>
          </div>
          <p>One uncertain charge and one missing reminder are<br />the only things that need your attention.</p>
          {!saved.length ? <button className={styles.connectButton} type="button" onClick={() => setScreen('Connections')}><LinkRoundIcon aria-hidden="true" />Open connections</button> : null}
        </div>
        <Image className={styles.spendingGraphic} src="/overview-curve.png" alt="" width={231} height={83} />
      </div>
      <div className={styles.overviewMetrics}>
        <article className={`${styles.metricCard} ${styles.upcomingMetric}`}><span><CalendarMarkIcon aria-hidden="true" />Upcoming</span><strong>{upcomingCount}</strong></article>
        <article className={`${styles.metricCard} ${styles.reviewMetric}`}><span><DangerCircleIcon aria-hidden="true" />Needs review</span><strong>{reviewCount}</strong></article>
        <article className={`${styles.metricCard} ${styles.reminderMetric}`}><span><BellIcon aria-hidden="true" />Reminders on</span><strong>{reminderCount}/{saved.length}</strong></article>
        <article className={`${styles.metricCard} ${styles.activeMetric}`}><span><ShieldCheckIcon aria-hidden="true" />Active plans</span><strong>{saved.length}</strong></article>
      </div>
      <section className={styles.upcomingRenewals} aria-labelledby="upcoming-renewals-title">
        <header className={styles.upcomingHeader}>
          <div><p>Next {renewalWindow} days</p><h2 id="upcoming-renewals-title">Upcoming renewals</h2></div>
          <div className={styles.upcomingHeaderActions}>
            <div className={styles.renewalWindowTabs} role="group" aria-label="Upcoming renewal window">
              {([14, 7, 3] as const).map((days) => <button type="button" aria-pressed={renewalWindow === days} className={renewalWindow === days ? styles.activeRenewalWindowTab : styles.renewalWindowTab} onClick={() => setRenewalWindow(days)} key={days}>{days} days</button>)}
            </div>
            <button className={styles.upcomingViewAll} type="button" onClick={() => selectScreen('Subscriptions')}>View all</button>
          </div>
        </header>
        {upcomingSubscriptions.length ? <div className={styles.upcomingList}>
          {upcomingSubscriptions.map((item) => {
            const renewal = new Date(item.renewalOrEndDate + 'T00:00:00Z');
            const daysUntilRenewal = Math.round((renewal.getTime() - todayUtc) / (24 * 60 * 60 * 1000));
            const frequency = ({ weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Yearly' } as Record<string, string>)[item.billingFrequency || ''] || 'Recurring plan';
            const countdown = daysUntilRenewal === 0 ? 'today' : daysUntilRenewal === 1 ? 'tomorrow' : `in ${daysUntilRenewal} days`;
            return <article className={styles.upcomingRow} key={item.id}>
              <time className={styles.upcomingDate} dateTime={item.renewalOrEndDate}><span>{new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(renewal).toUpperCase()}</span><strong>{renewal.getUTCDate()}</strong></time>
              <div className={styles.upcomingSubscription}><span className={styles.upcomingMark} aria-hidden="true">{initialsFor(item.serviceName).slice(0, 1)}</span><span><strong>{item.serviceName}</strong><small>{item.tag === 'trial' ? `Trial → ${frequency.toLowerCase()}` : frequency}</small></span></div>
              <div className={styles.upcomingAmount}><strong>{item.amount || '—'}</strong><small>{countdown}</small></div>
              <button disabled={reminderSaving === item.id || !item.renewalOrEndDate} className={item.reminderEnabled ? styles.reminderOn : styles.reminderOff} type="button" onClick={() => void toggleReminder(item)}>{reminderSaving === item.id ? 'Saving…' : item.reminderEnabled ? 'Reminder on' : 'Set reminder'}</button>
            </article>;
          })}
        </div> : <p className={styles.upcomingEmpty}>No renewals in the next {renewalWindow} days.</p>}
      </section>
      <section className={styles.reminderCoverageCard} aria-labelledby="reminder-coverage-title">
        <header>
          <div><span>Reminder coverage</span><h2 id="reminder-coverage-title">{reminderCoverageTitle}</h2></div>
          <strong>{reminderCoverage}%</strong>
        </header>
        <progress aria-label={`${reminderCoverage}% of subscriptions have reminders enabled`} max="100" value={reminderCoverage}>{reminderCoverage}%</progress>
        <div className={styles.coverageLabels}>
          <span>{reminderCount} {reminderCount === 1 ? 'reminder' : 'reminders'} set</span>
          <span>{missingReminders} missing</span>
        </div>
      </section>
    </section>
  );
  const savedContent = (
    <section className={styles.library} aria-labelledby="saved-title">
      <div className={styles.libraryHeading}>
        <div><p className={styles.sectionLabel}>Library</p><h2 id="saved-title">{screen === 'Reminders' ? 'Renewal dates' : 'All subscriptions'}</h2>{screen !== 'Reminders' ? <p>Everything SubTrack has confidently identified as recurring.</p> : null}</div>
        <div className={styles.libraryActions}><button className={styles.secondaryButton} type="button" disabled={!filteredSaved.length} onClick={exportSubscriptions}><DownloadMinimalisticIcon aria-hidden="true" />Export</button><button className={styles.confirmButton} type="button" onClick={openManual}><AddIcon aria-hidden="true" />Add manually</button></div>
      </div>
      {screen === 'Reminders' ? <p className={styles.scanWarning}>Renewal dates are saved here. Email and push reminders aren’t enabled yet.</p> : null}
      {reviewCount ? <button className={styles.reviewNotice} type="button" onClick={() => setScreen('Needs review')}><span className={styles.reviewBadge}>{view === 'scanning' ? '1' : reviewCount}</span><span>{view === 'scanning' ? 'Gmail scan in progress' : 'Gmail scan ready for review'}</span><span>View review →</span></button> : null}
      <div className={styles.libraryTableShell}>
        <div className={styles.libraryToolbar}>
          <div className={styles.filterTabs} aria-label="Filter subscriptions">{([
            ['all', 'All'], ['monthly', 'Monthly'], ['annually', 'Yearly'], ['trial', 'Trials'],
          ] as const).map(([value, label]) => <button type="button" aria-pressed={libraryFilter === value} className={libraryFilter === value ? styles.activeFilter : styles.filterButton} onClick={() => setLibraryFilter(value)} key={value}>{label}</button>)}</div>
          <label className={styles.librarySearch}><MagnifierIcon aria-hidden="true" /><span className={styles.srOnly}>Search saved subscriptions</span><input value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Search subscriptions" /></label>
        </div>
        {filteredSaved.length ? <div className={styles.libraryTable} role="table" aria-label="Saved subscriptions">
          <div className={styles.tableHeader} role="row"><span role="columnheader">Subscription</span><span role="columnheader">Billing</span><span role="columnheader">Amount</span><span role="columnheader">Next renewal</span><span role="columnheader">Reminder</span><span /></div>
          {filteredSaved.map((item) => <div className={styles.tableRow} role="row" key={item.id}>
            <div className={styles.tableSubscription} role="cell"><span className={styles.serviceMark} aria-hidden="true">{initialsFor(item.serviceName).slice(0, 1)}</span><span><strong>{item.serviceName}</strong><small>{item.source === 'manual' ? 'Added manually' : item.tag === 'trial' ? 'Trial' : 'From Gmail'}</small></span></div>
            <span role="cell">{({ weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Yearly' } as Record<string, string>)[item.billingFrequency || ''] || 'Needs details'}</span>
            <strong role="cell">{item.amount || '—'}</strong><span role="cell">{formatRenewal(item.renewalOrEndDate)}</span>
            <span role="cell"><button disabled={reminderSaving === item.id || !item.renewalOrEndDate} className={item.reminderEnabled ? styles.reminderOn : styles.reminderOff} type="button" onClick={() => void toggleReminder(item)}>{reminderSaving === item.id ? 'Saving…' : item.reminderEnabled ? 'Reminder on' : 'Set reminder'}</button></span>
            <button className={styles.rowMenu} type="button" aria-label={`More options for ${item.serviceName}`}><MenuDotsIcon aria-hidden="true" /></button>
          </div>)}
        </div> : <div className={styles.noResults}><CardIcon aria-hidden="true" /><h3>{saved.length ? 'No matching subscriptions' : 'No saved subscriptions yet'}</h3>{!saved.length ? <button className={styles.connectButton} type="button" onClick={openManual}>Add manually</button> : null}</div>}
      </div>
      {view === 'idle' ? <button className={styles.connectButton} type="button" onClick={() => setScreen('Connections')}><LinkRoundIcon aria-hidden="true" />Open connections</button> : view === 'confirmed' ? <button className={styles.secondaryButton} type="button" onClick={() => void startScan()}><RestartIcon aria-hidden="true" />Scan Gmail again</button> : null}
    </section>
  );

  const mainContent = !ready ? <p role="status">Loading your workspace…</p> : screen === 'Needs review'
    ? view === 'idle' ? <section className={styles.emptyState}><h2>Nothing to review yet</h2><p className={styles.emptyDescription}>New findings from connected inboxes will appear here.</p><button className={styles.connectButton} type="button" onClick={() => setScreen('Connections')}>Open connections</button></section> : content
    : screen === 'Overview' ? saved.length ? overviewContent : content
      : screen === 'Subscriptions' ? savedContent
        : screen === 'Reminders' ? <RemindersPanel subscriptions={saved} savingId={reminderSaving} onToggle={toggleReminder} onOpenConnections={() => setScreen('Connections')} />
          : <ConnectionsPanel />;

  return (
    <div className={styles.dashboardShell}>
      <aside className={styles.sidebar} aria-label="Primary navigation">
        <div className={styles.sidebarTop}>
          <div className={styles.brandRow}>
            <span className={styles.brandMark} aria-hidden="true">S<span /></span>
            <span className={styles.brandCopy}><strong>SubTrack</strong></span>
            <SidebarMinimalisticIcon className={styles.collapseIcon} aria-hidden="true" />
          </div>
          <nav className={styles.navigation}>
            <p>Workspace</p>
            {workspaceNavigation.map((item) => {
              const active = screen === item.label;
              const Icon = active ? item.activeIcon : item.icon;
              return <button type="button" className={active ? styles.activeNavItem : styles.navItem} aria-current={active ? 'page' : undefined} aria-label={item.label + (item.label === 'Needs review' && reviewCount ? ` (${reviewCount} pending)` : '')} onClick={() => selectScreen(item.label)} key={item.label}><Icon aria-hidden="true" /><span>{item.label}</span>{item.label === 'Needs review' && reviewCount ? <span className={styles.reviewBadge} aria-hidden="true">{reviewCount > 99 ? '99+' : reviewCount}</span> : null}</button>;
            })}
            <p className={styles.accountLabel}>Account</p>
            {accountNavigation.map((item) => {
              const active = screen === item.label;
              const Icon = active ? item.activeIcon : item.icon;
              return <button type="button" className={active ? styles.activeNavItem : styles.navItem} aria-current={active ? 'page' : undefined} onClick={() => selectScreen(item.label)} key={item.label}><Icon aria-hidden="true" /><span>{item.label}</span></button>;
            })}
            <a className={styles.navItem} href="#settings"><SettingsMinimalisticIcon aria-hidden="true" /><span>Settings</span></a>
          </nav>
        </div>
        <div className={styles.userCard}>
          <div className={styles.avatar}>{user.avatar ? <Image src={user.avatar} alt="" width={38} height={38} unoptimized /> : <span>{initialsFor(user.name)}</span>}</div>
          <span className={styles.userDetails}><strong>{user.name}</strong><small>{user.email}</small></span>
          <a className={styles.logoutButton} href="/auth/logout" aria-label="Sign out"><Logout2Icon aria-hidden="true" /></a>
        </div>
      </aside>
      <section className={styles.dashboardArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarTitle}><h1>{screen}</h1>{screen === 'Subscriptions' ? <p>Manage every detected recurring service.</p> : null}</div>
          <div className={styles.topbarActions}>
            <button className={styles.topbarSearch} type="button" aria-label="Search subscriptions"><MagnifierIcon aria-hidden="true" /><span>Search subscriptions</span></button>
            <button className={styles.notificationButton} type="button" aria-label={reviewCount ? `Open review, ${reviewCount} pending` : 'Open review'} onClick={() => setScreen('Needs review')}><BellIcon aria-hidden="true" />{reviewCount ? <span className={styles.notificationDot} /> : null}</button>
            <button disabled={!ready} className={styles.addButton} type="button" aria-label="Add manually" onClick={openManual}><AddIcon aria-hidden="true" /><span>Add manually</span></button>
          </div>
        </header>
        <main className={styles.workspace}>
          {loadError ? <p className={styles.scanWarning} role="alert">{loadError}</p> : null}
          {saveNotice ? <p className={styles.savedNotice} role="status">{saveNotice}</p> : null}
          {mainContent}
        </main>
      </section>
      {manualOpen ? <ManualSubscriptionDialog onClose={() => setManualOpen(false)} onSaved={(subscription) => {
        setSaved((current) => current.some((item) => item.id === subscription.id) ? current : [...current, subscription]);
        setManualOpen(false);
        setScreen('Subscriptions');
        setSaveNotice(subscription.serviceName + ' added.');
      }} /> : null}
    </div>
  );
}
