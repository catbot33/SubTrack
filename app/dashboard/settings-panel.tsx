'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BellIcon, CloseCircleIcon, EyeIcon, Logout2Icon, PenNewSquareIcon, TrashBinMinimalisticIcon, UserCircleIcon } from '@solar-icons/react/linear';
import styles from './dashboard.module.css';

type Profile = { name: string; email: string; avatar?: string };
type SettingsData = { profile: Profile; monitoringPaused: boolean; subscriptions: number; remindersOn: number; gmailConnections: number };
type ConfirmAction = 'subscriptions' | 'account';

function ConfirmationDialog({ action, busy, onClose, onConfirm }: { action: ConfirmAction; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); return () => ref.current?.close(); }, []);
  const account = action === 'account';
  return <dialog ref={ref} className={`${styles.manualDialog} ${styles.deleteDialog}`} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={styles.dialogHeader}><h2>{account ? 'Delete your account?' : 'Delete all subscriptions?'}</h2><button className={styles.dialogClose} type="button" disabled={busy} aria-label="Close confirmation" onClick={onClose}><CloseCircleIcon aria-hidden="true" /></button></div>
    <div className={styles.deleteDialogIcon} aria-hidden="true"><TrashBinMinimalisticIcon /></div>
    <p>{account ? 'This permanently removes your profile, subscriptions, Gmail connections, review items, and reminder history.' : 'Every saved subscription and its scheduled reminders will be permanently removed. Your account and connections will remain.'}</p>
    <div className={styles.reviewActions}><button className={styles.secondaryButton} type="button" disabled={busy} onClick={onClose}>Cancel</button><button className={styles.dangerButton} type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Deleting…' : account ? 'Delete account' : 'Delete subscriptions'}</button></div>
  </dialog>;
}

export default function SettingsPanel({ user, onProfileChange, onSubscriptionsCleared, onNotify }: {
  user: Profile;
  onProfileChange: (profile: Profile) => void;
  onSubscriptionsCleared: () => void;
  onNotify: (message: string, error?: boolean) => void;
}) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [busy, setBusy] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [nameDraft, setNameDraft] = useState(user.name);
  const [avatarDraft, setAvatarDraft] = useState(user.avatar || '');
  const photoInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/settings/account', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load settings.');
    setData(body);
    setNameDraft(body.profile.name);
    setAvatarDraft(body.profile.avatar || '');
    onProfileChange(body.profile);
  }, [onProfileChange]);

  useEffect(() => { void refresh().catch((cause) => onNotify(cause instanceof Error ? cause.message : 'Unable to load settings.', true)); }, [refresh, onNotify]);

  const update = async (key: string, path: string, body: unknown, success: string) => {
    if (busy) return;
    setBusy(key);
    try {
      const response = await fetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save the setting.');
      await refresh();
      onNotify(success);
    } catch (cause) { onNotify(cause instanceof Error ? cause.message : 'Unable to save the setting.', true); }
    finally { setBusy(''); }
  };

  const remove = async (action: ConfirmAction) => {
    if (busy) return;
    setBusy(action);
    try {
      const response = await fetch(action === 'account' ? '/api/settings/account' : '/api/settings/subscriptions', { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Unable to delete the selected data.');
      }
      if (action === 'account') { window.location.assign('/'); return; }
      onSubscriptionsCleared();
      setConfirmAction(null);
      await refresh();
      onNotify('All subscriptions deleted.');
    } catch (cause) { onNotify(cause instanceof Error ? cause.message : 'Unable to delete the selected data.', true); }
    finally { setBusy(''); }
  };

  const remindersEnabled = Boolean(data?.subscriptions && data.remindersOn === data.subscriptions);
  const choosePhoto = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { onNotify('Choose a JPG, PNG, or WebP image.', true); return; }
    if (file.size > 10 * 1024 * 1024) { onNotify('Choose an image smaller than 10 MB.', true); return; }
    try {
      const objectUrl = URL.createObjectURL(file);
      const image = new window.Image();
      image.src = objectUrl;
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unable to read that image.')); });
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to prepare that image.');
      context.drawImage(image, (image.naturalWidth - size) / 2, (image.naturalHeight - size) / 2, size, size, 0, 0, 256, 256);
      URL.revokeObjectURL(objectUrl);
      setAvatarDraft(canvas.toDataURL('image/webp', 0.86));
    } catch (cause) { onNotify(cause instanceof Error ? cause.message : 'Unable to prepare that image.', true); }
  };
  return <section className={styles.settingsPage} aria-labelledby="settings-title">
    <div className={styles.remindersHeading}><p className={styles.sectionLabel}>Settings</p><h2 id="settings-title">Your account, your control.</h2></div>
    <div className={styles.settingsGrid}>
      <section className={styles.settingsCard} aria-labelledby="profile-settings-title">
        <div className={styles.settingsCardHeading}><span><UserCircleIcon aria-hidden="true" /></span><div><h3 id="profile-settings-title">Profile</h3><p>Shown inside your SubTrack workspace.</p></div></div>
        <form className={styles.settingsForm} onSubmit={(event) => { event.preventDefault(); void update('profile', '/api/settings/profile', { name: nameDraft, avatar: avatarDraft }, 'Profile updated.'); }}>
          <div className={styles.profilePhotoControl}>
            <div className={styles.profilePreview}>{avatarDraft ? <img src={avatarDraft} alt="Selected profile" /> : <span>{(data?.profile.name || user.name).slice(0, 1).toUpperCase()}</span>}</div>
            <button className={styles.secondaryButton} type="button" disabled={Boolean(busy)} onClick={() => photoInput.current?.click()}>Change profile photo</button>
            <input ref={photoInput} className={styles.srOnly} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void choosePhoto(event.target.files?.[0])} />
          </div>
          <label><span>Display name</span><input name="name" required maxLength={80} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} /></label>
          <div className={styles.profileIdentity}><span>Signed in with</span><strong>{data?.profile.email || user.email}</strong></div>
          <button className={styles.confirmButton} type="submit" disabled={!data || Boolean(busy)}><PenNewSquareIcon aria-hidden="true" />{busy === 'profile' ? 'Saving…' : 'Save profile'}</button>
        </form>
      </section>

      <section className={styles.settingsCard} aria-labelledby="notification-settings-title">
        <div className={styles.settingsCardHeading}><span><BellIcon aria-hidden="true" /></span><div><h3 id="notification-settings-title">Notifications</h3><p>Control WhatsApp renewal reminders together.</p></div></div>
        <div className={styles.settingRow}><div><strong>All renewal reminders</strong><small>{data ? `${data.remindersOn} of ${data.subscriptions} enabled` : 'Loading…'}</small></div><button className={remindersEnabled ? styles.toggleOn : styles.toggleOff} role="switch" aria-checked={remindersEnabled} disabled={!data || Boolean(busy)} onClick={() => void update('reminders', '/api/settings/reminders', { enabled: !remindersEnabled }, remindersEnabled ? 'All reminders turned off.' : 'All reminders turned on.')}><span /></button></div>
      </section>

      <section className={styles.settingsCard} aria-labelledby="monitoring-settings-title">
        <div className={styles.settingsCardHeading}><span><EyeIcon aria-hidden="true" /></span><div><h3 id="monitoring-settings-title">Live monitoring</h3><p>Pause or continue checking connected Gmail inboxes.</p></div></div>
        <div className={styles.settingRow}><div><strong>{data?.monitoringPaused ? 'Monitoring is on hold' : 'Monitoring is active'}</strong><small>{data ? `${data.gmailConnections} Gmail ${data.gmailConnections === 1 ? 'connection' : 'connections'}` : 'Loading…'}</small></div><button className={styles.secondaryButton} type="button" disabled={!data || Boolean(busy)} onClick={() => void update('monitoring', '/api/settings/monitoring', { paused: !data?.monitoringPaused }, data?.monitoringPaused ? 'Live monitoring continued.' : 'Live monitoring paused.')}>{busy === 'monitoring' ? 'Saving…' : data?.monitoringPaused ? 'Continue' : 'Pause'}</button></div>
      </section>

      <section className={`${styles.settingsCard} ${styles.dangerZone}`} aria-labelledby="data-settings-title">
        <div className={styles.settingsCardHeading}><span><TrashBinMinimalisticIcon aria-hidden="true" /></span><div><h3 id="data-settings-title">Data and account</h3><p>Permanent actions require confirmation.</p></div></div>
        <div className={styles.dangerRow}><div><strong>Delete all subscriptions</strong><small>Keep your account and connections.</small></div><button className={styles.outlineDangerButton} type="button" onClick={() => setConfirmAction('subscriptions')}>Delete all</button></div>
        <div className={styles.dangerRow}><div><strong>Delete account</strong><small>Remove your account and all associated data.</small></div><button className={styles.outlineDangerButton} type="button" onClick={() => setConfirmAction('account')}>Delete account</button></div>
        <a className={styles.settingsSignOut} href="/auth/logout"><Logout2Icon aria-hidden="true" />Sign out of this device</a>
      </section>
    </div>
    {confirmAction ? <ConfirmationDialog action={confirmAction} busy={busy === confirmAction} onClose={() => setConfirmAction(null)} onConfirm={() => void remove(confirmAction)} /> : null}
  </section>;
}
