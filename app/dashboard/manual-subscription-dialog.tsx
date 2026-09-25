'use client';

import { useEffect, useRef, useState } from 'react';
import { CloseCircleIcon } from '@solar-icons/react/linear';
import type { SavedSubscription } from '../../Workers/subscription-store';
import styles from './dashboard.module.css';

export default function ManualSubscriptionDialog({ onClose, onSaved, subscription }: {
  onClose: () => void;
  onSaved: (subscription: SavedSubscription) => void;
  subscription?: SavedSubscription;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef('');
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    requestId.current ||= crypto.randomUUID();
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);
  const editing = Boolean(subscription);
  return (
    <dialog ref={dialog} className={styles.manualDialog} aria-labelledby="manual-title" onCancel={(event) => { event.preventDefault(); if (!savingRef.current) onClose(); }}>
      <div className={styles.dialogHeader}><h2 id="manual-title">{editing ? 'Edit subscription' : 'Add a subscription'}</h2><button type="button" className={styles.dialogClose} aria-label="Close form" disabled={saving} onClick={onClose}><CloseCircleIcon aria-hidden="true" /></button></div>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (savingRef.current) return;
        const form = event.currentTarget;
        const input = Object.fromEntries(new FormData(form));
        if (!String(input.serviceName || '').trim()) { setError('Enter a merchant name.'); return; }
        savingRef.current = true;
        setSaving(true);
        setError('');
        try {
          const response = await fetch(editing ? `/api/subscriptions/${encodeURIComponent(subscription!.id)}` : '/api/subscriptions', {
            method: editing ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editing ? input : { ...input, requestId: requestId.current }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Unable to save. Please retry.');
          onSaved(data.subscription);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Unable to save. Please retry.');
        } finally { savingRef.current = false; setSaving(false); }
      }}>
        <fieldset disabled={saving} className={styles.manualFields}>
          <label><span>Merchant name</span><input name="serviceName" autoFocus required maxLength={160} defaultValue={subscription?.serviceName} placeholder="e.g. Netflix" autoComplete="off" /></label>
          <label><span>Frequency</span><select name="billingFrequency" required defaultValue={subscription?.billingFrequency || ''}><option value="" disabled>Select frequency</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annually">Yearly</option></select></label>
          <label><span>Next renewal date</span><input name="renewalOrEndDate" type="date" required min="1900-01-01" max="9999-12-31" defaultValue={subscription?.renewalOrEndDate} /></label>
          <label><span>Cost <small>(optional)</small></span><input name="amount" maxLength={80} defaultValue={subscription?.amount} placeholder="e.g. USD 12.99" autoComplete="off" /></label>
        </fieldset>
        {error ? <p className={styles.scanWarning} role="alert">{error}</p> : null}
        <div className={styles.reviewActions}><button disabled={saving} type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button><button disabled={saving} type="submit" className={styles.confirmButton}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add subscription'}</button></div>
      </form>
    </dialog>
  );
}
