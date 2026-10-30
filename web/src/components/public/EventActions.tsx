'use client';
import { CalendarPlus, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { BASE_PATH } from '@/lib/env';
import { eventCalendar } from '@/lib/public-calendar';
import type { TxEvent } from '@/lib/types';
export function EventActions({ event }: { event: TxEvent }) {
  const [message, setMessage] = useState('');
  const [fallback, setFallback] = useState('');
  const url = () => new URL(BASE_PATH + '/event/?s=' + encodeURIComponent(event.slug ?? ''), window.location.origin).href;
  const share = async () => {
    const link = url(); setMessage(''); setFallback('');
    try {
      if (navigator.share) { await navigator.share({ title: event.title, text: 'Join me at TEDxGUC.', url: link }); return; }
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(link); setMessage('Event link copied.'); }
      else { setFallback(link); setMessage('Copy this link to share the event.'); }
    } catch (e) { if ((e as Error).name !== 'AbortError') { setFallback(link); setMessage('Copy this link to share the event.'); } }
  };
  const calendar = () => {
    try {
      const data = eventCalendar(event, url());
      const href = URL.createObjectURL(new Blob([data], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a'); a.href = href; a.download = (event.slug || 'tedxguc-event').replace(/[^a-z0-9_-]/gi, '-') + '.ics';
      document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      setMessage('Calendar file downloaded. Open it to add the event.');
    } catch { setMessage('The calendar file could not be created. Please try again.'); }
  };
  return <div className="public-event-actions"><Button small variant="secondary" onClick={calendar}><CalendarPlus size={16} aria-hidden="true" />Add to calendar</Button><Button small variant="secondary" onClick={share}><Share2 size={16} aria-hidden="true" />Share event</Button><p className="public-event-action-status" role="status" aria-live="polite">{message}</p>{fallback && <label className="w-full text-body-sm">Event link<input readOnly value={fallback} className="tx-input w-full mt-s2" onFocus={(e) => e.target.select()} /></label>}</div>;
}
