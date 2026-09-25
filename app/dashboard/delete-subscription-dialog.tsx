'use client';

import { useEffect, useRef, useState } from 'react';
import { CloseCircleIcon, TrashBinMinimalisticIcon } from '@solar-icons/react/linear';
import type { SavedSubscription } from '../../Workers/subscription-store';
import styles from './dashboard.module.css';

export default function DeleteSubscriptionDialog({ subscription, onClose, onDeleted }: {
  subscription: SavedSubscription;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const deletingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);

  const remove = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/subscriptions/${encodeURIComponent(subscription.id)}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Unable to delete the subscription.');
      }
      onDeleted(subscription.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete the subscription.');
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  return (
    <dialog ref={dialog} className={`${styles.manualDialog} ${styles.deleteDialog}`} aria-labelledby="delete-title" onCancel={(event) => { event.preventDefault(); if (!deletingRef.current) onClose(); }}>
      <div className={styles.dialogHeader}><h2 id="delete-title">Delete subscription?</h2><button type="button" className={styles.dialogClose} aria-label="Close confirmation" disabled={deleting} onClick={onClose}><CloseCircleIcon aria-hidden="true" /></button></div>
      <div className={styles.deleteDialogIcon} aria-hidden="true"><TrashBinMinimalisticIcon /></div>
      <p><strong>{subscription.serviceName}</strong> and its scheduled reminders will be permanently removed.</p>
      {error ? <p className={styles.scanWarning} role="alert">{error}</p> : null}
      <div className={styles.reviewActions}><button disabled={deleting} type="button" className={styles.secondaryButton} onClick={onClose}>Keep subscription</button><button disabled={deleting} type="button" className={styles.dangerButton} onClick={() => void remove()}>{deleting ? 'Deleting…' : 'Delete'}</button></div>
    </dialog>
  );
}
