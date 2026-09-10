'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { ClockCircleIcon, LinkRoundIcon } from '@solar-icons/react/linear';
import { FaWhatsapp } from 'react-icons/fa';
import type { SavedSubscription } from '../../Workers/subscription-store';
import styles from './dashboard.module.css';

type ReminderSettings = {
  whatsappNumber: string | null;
  connectedAt: string | null;
  reminderLeadDays: 1 | 3 | 7;
  timeZone: string;
  whatsappConfigured: boolean;
  latestTest: null | { status: string; scheduledFor: string; sentAt: string | null; lastError: string | null };
};
type GmailConnection = { email: string; status: string; connectedAt: string; lastSyncAt: string | null; error: string | null };

function initials(name: string) { return name.trim().slice(0, 1).toUpperCase() || 'S'; }
function renewalLabel(value?: string) {
  if (!value) return 'Renewal date needed';
  return `Renews ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))}`;
}

async function getSettings(): Promise<ReminderSettings> {
  const response = await fetch('/api/reminders/settings', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load reminder settings.');
  return data;
}

async function getGmailConnections(): Promise<GmailConnection[]> {
  const response = await fetch('/api/connections/gmail', { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load Gmail connections.');
  return data.connections ?? [];
}

export function RemindersPanel({
  subscriptions,
  savingId,
  onToggle,
  onOpenConnections,
}: {
  subscriptions: SavedSubscription[];
  savingId: string | null;
  onToggle: (subscription: SavedSubscription) => Promise<void>;
  onOpenConnections: () => void;
}) {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [error, setError] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  useEffect(() => { void getSettings().then(setSettings).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unable to load reminders.')); }, []);
  const enabled = subscriptions.filter((item) => item.reminderEnabled).length;
  const protectedCount = subscriptions.filter((item) => item.reminderEnabled && item.renewalOrEndDate).length;

  const setLeadDays = async (leadDays: 1 | 3 | 7) => {
    if (!settings || savingLead || leadDays === settings.reminderLeadDays) return;
    setSavingLead(true); setError('');
    try {
      const response = await fetch('/api/reminders/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderLeadDays: leadDays, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update reminder timing.');
      setSettings((current) => current ? { ...current, reminderLeadDays: data.reminderLeadDays, timeZone: data.timeZone } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update reminder timing.'); }
    finally { setSavingLead(false); }
  };

  return <section className={styles.remindersPage} aria-labelledby="reminders-title">
    <div className={styles.remindersHeading}>
      <p className={styles.sectionLabel}>Reminder control</p>
      <h2 id="reminders-title">Stay ahead without the noise.</h2>
      <p>Choose which subscriptions deserve a heads-up<br />and how early you want it.</p>
    </div>
    {error ? <p className={styles.scanWarning} role="alert">{error}</p> : null}
    {!settings?.whatsappNumber ? <button type="button" className={styles.connectionNotice} onClick={onOpenConnections}><LinkRoundIcon aria-hidden="true" /><span>Connect WhatsApp before enabling delivery.</span><strong>Connect number</strong></button> : null}
    <div className={styles.reminderMetrics}>
      <article className={styles.reminderEnabledMetric}><span>Enabled</span><strong>{enabled}</strong></article>
      <article className={styles.reminderDisabledMetric}><span>Disabled</span><strong>{Math.max(0, subscriptions.length - enabled)}</strong></article>
      <article className={styles.reminderProtectedMetric}><span>Upcoming protected</span><strong>{protectedCount}/{subscriptions.length}</strong></article>
      <article className={styles.reminderLeadMetric}><span>Default lead time</span><strong>{settings?.reminderLeadDays ?? 3}d</strong></article>
    </div>
    <div className={styles.reminderGrid}>
      <section className={styles.coverageCard} aria-labelledby="coverage-title">
        <div className={styles.cardHeading}><p>Subscriptions</p><h3 id="coverage-title">Reminder coverage</h3></div>
        {subscriptions.length ? <div className={styles.coverageList}>{subscriptions.map((item) => <div className={styles.coverageRow} key={item.id}>
          <span className={styles.serviceMark} aria-hidden="true">{initials(item.serviceName)}</span>
          <span className={styles.coverageIdentity}><strong>{item.serviceName}</strong><small>{renewalLabel(item.renewalOrEndDate)}</small></span>
          <button
            type="button"
            role="switch"
            aria-checked={item.reminderEnabled}
            aria-label={`${item.reminderEnabled ? 'Disable' : 'Enable'} reminders for ${item.serviceName}`}
            className={item.reminderEnabled ? styles.toggleOn : styles.toggleOff}
            disabled={savingId === item.id || !item.renewalOrEndDate}
            onClick={() => void onToggle(item)}
          ><span /></button>
        </div>)}</div> : <div className={styles.coverageEmpty}><ClockCircleIcon aria-hidden="true" /><p>Add a subscription to set its renewal reminders.</p></div>}
      </section>
      <section className={styles.leadTimeCard} aria-labelledby="lead-title">
        <div className={styles.cardHeading}><p>Default behavior</p><h3 id="lead-title">How early should we remind you?</h3></div>
        <div className={styles.leadChoices}>{([1, 3, 7] as const).map((days) => <button key={days} type="button" aria-pressed={settings?.reminderLeadDays === days} disabled={!settings || savingLead} onClick={() => void setLeadDays(days)}>{days} {days === 1 ? 'day' : 'days'}</button>)}</div>
        <p>We’ll send one WhatsApp reminder each day during the lead time you choose.</p>
      </section>
    </div>
  </section>;
}

export function ConnectionsPanel() {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
  const [number, setNumber] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextSettings, nextGmailConnections] = await Promise.all([getSettings(), getGmailConnections()]);
      setSettings(nextSettings); setGmailConnections(nextGmailConnections); setError('');
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load connections.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (settings?.latestTest?.status !== 'pending' && settings?.latestTest?.status !== 'sending') return;
    const poll = setInterval(() => void refresh(), 2_000);
    return () => clearInterval(poll);
  }, [refresh, settings?.latestTest?.status]);

  const connect = async (targetNumber = number) => {
    if (saving) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/connections/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ number: targetNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to connect WhatsApp.');
      setNumber(''); setEditing(false);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to connect WhatsApp.'); }
    finally { setSaving(false); }
  };
  const status = settings?.latestTest;

  return <section className={styles.connectionsPage} aria-labelledby="connections-title">
    <div className={styles.remindersHeading}><p className={styles.sectionLabel}>Connections</p><h2 id="connections-title">Where reminders arrive.</h2></div>
    {error ? <p className={styles.scanWarning} role="alert">{error}</p> : null}
    <div className={styles.connectionCards}>
    <article className={styles.gmailCard}>
      <span className={styles.gmailIcon} aria-hidden="true"><Image src="/gmail-logo.svg" alt="" width={28} height={28} /></span>
      <h3>Gmail</h3>
      {gmailConnections.length ? <>
        <p>These inboxes have been scanned and are monitored for future subscription emails.</p>
        <div className={styles.gmailAccounts}>{gmailConnections.map((connection) => <div className={styles.gmailAccount} key={connection.email}>
          <strong>{connection.email}</strong>
          <span>{connection.status === 'active' || connection.status === 'polling' ? 'Scanning complete · Monitoring new emails' : 'Connection needs attention'}</span>
        </div>)}</div>
        <a className={styles.connectButton} href="/auth/google/connect">Connect another Gmail</a>
      </> : <>
        <p>Connect an inbox to extract subscriptions and monitor future emails. This does not change your SubTrack login.</p>
        <a className={styles.connectButton} href="/auth/google/connect">Connect Gmail</a>
      </>}
    </article>
    <article className={styles.whatsappCard}>
      <span className={styles.whatsappIcon} aria-hidden="true"><FaWhatsapp /></span>
      <h3>WhatsApp</h3>
      {settings?.whatsappNumber && !editing ? <>
        <p className={styles.connectedNumber}>{settings.whatsappNumber}</p>
        <p>Used only for renewal reminders you enable.</p>
        {status ? <p className={styles.connectionStatus} role="status">{status.status === 'sent' ? 'Confirmation accepted by WhatsApp.' : status.status === 'failed' ? `WhatsApp rejected the confirmation${status.lastError ? `: ${status.lastError}` : '.'}` : status.status === 'pending' || status.status === 'sending' ? 'Confirmation scheduled—sending shortly.' : ''}</p> : null}
        <div className={styles.connectionActions}>
          <button className={styles.connectButton} type="button" disabled={saving} onClick={() => void connect(settings.whatsappNumber || '')}>{saving ? 'Scheduling…' : 'Send confirmation again'}</button>
          <button className={styles.secondaryButton} type="button" disabled={saving} onClick={() => { setNumber(settings.whatsappNumber || ''); setEditing(true); }}>Manage number</button>
        </div>
      </> : <>
        <p>Enter a number with its country code. A WhatsApp template confirmation will be sent 10 seconds after you confirm.</p>
        <label className={styles.phoneField}><span>WhatsApp number</span><input inputMode="tel" autoComplete="tel" placeholder="+92 300 1234567" value={number} onChange={(event) => setNumber(event.target.value)} /></label>
        {!settings?.whatsappConfigured ? <p className={styles.connectionStatus}>WhatsApp delivery is not configured on this server.</p> : null}
        <p className={styles.testModeNote}>In Meta test mode, this number must also be added to the app’s allowed recipient list.</p>
        <div className={styles.connectionActions}>{editing ? <button className={styles.secondaryButton} type="button" onClick={() => { setEditing(false); setNumber(''); }}>Cancel</button> : null}<button className={styles.connectButton} type="button" disabled={saving || !number.trim() || !settings?.whatsappConfigured} onClick={() => void connect()}>{saving ? 'Confirming…' : 'Confirm number'}</button></div>
      </>}
    </article>
    </div>
  </section>;
}
