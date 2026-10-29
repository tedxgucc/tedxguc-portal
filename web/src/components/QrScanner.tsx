'use client';
// Phone-camera QR scanner (html5-qrcode), used at the event door and for
// meeting check-in. Loads the scanner library only when the camera opens.
import { useEffect, useId, useRef } from 'react';
import { useToast } from './Toast';

export function QrScanner({ active, onCode, once = false }: { active: boolean; onCode: (text: string) => void; once?: boolean }) {
  const id = `tx-scan-${useId().replace(/:/g, '')}`;
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    if (!active || !ref.current) return;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;
    let decoded = false;
    (async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled || !ref.current) return;
      const s = new Html5Qrcode(id, { verbose: false });
      scanner = s;
      try {
        await s.start({ facingMode: 'environment' }, { fps: 12, qrbox: (width, height) => { const size = Math.min(240, Math.floor(Math.min(width, height) * 0.8)); return { width: size, height: size }; } }, (text) => { if (cancelled || (once && decoded)) return; decoded = true; cb.current(text); }, () => {});
        if (cancelled) { await s.stop().catch(() => {}); s.clear(); }
      } catch {
        if (cancelled) return;
        toast('bad', 'Camera not available.', 'Allow camera access, or type the code instead.');
      }
    })();
    return () => {
      cancelled = true;
      scanner?.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [active, id, toast, once]);

  return <div id={id} ref={ref} className={active ? 'w-full overflow-hidden bg-[#000] min-h-[280px]' : 'hidden'} />;
}
