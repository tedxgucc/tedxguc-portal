'use client';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
import type { TxEvent } from '@/lib/types';

export function DeleteEventButton({ event, onDeleted }: { event: TxEvent; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const remove = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { await api.deleteEvent(event.id); setOpen(false); toast('ok', 'Event deleted.'); onDeleted(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete the event. Please try again.'); }
    finally { setBusy(false); }
  };
  return <>
    <Button small variant="danger" onClick={() => { setError(null); setOpen(true); }}><Trash2 size={16} aria-hidden="true" />Delete event</Button>
    <Modal open={open} title={'Delete ' + event.title + '?'} onClose={() => { if (!busy) setOpen(false); }} actions={<><Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Keep event</Button><Button variant="danger" loading={busy} onClick={remove}>Delete event</Button></>}>
      <p>This permanently removes the event from the public site and portal, including its setup and staff assignments. Speaker profiles are kept.</p>
      <p className="text-body-sm text-ink-2 mt-s3">Events with ticket registrations or linked financial records cannot be deleted. Cancel or hide those events using Edit instead.</p>
      {error && <p className="text-bad mt-s3" role="alert">{error}</p>}
    </Modal>
  </>;
}
