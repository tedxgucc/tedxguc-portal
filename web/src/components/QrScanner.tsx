'use client';
// Phone-camera QR scanner (html5-qrcode), used at the event door and for
// meeting check-in. Loads the scanner library only when the camera opens.
import { useEffect, useId, useRef } from 'react';
import { useToast } from './Toast';

export function QrScanner({ active, onCode }: { active: boolean; onCode: (text: string) => void }) {
  const id = `tx-scan-${useId().replace(/:/g, '')}`;
  const ref = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const cb = useRef(onCode);
  cb.current = onCode;

  useEffect(() => {
    if (!active || !ref.current) return;
    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;
    (async () => {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (cancelled || !ref.current) return;
      const s = new Html5Qrcode(id, { verbose: false });
      scanner = s;
      try {
        await s.start({ facingMode: 'environment' }, { fps: 12, qrbox: { width: 240, height: 240 } }, (text) => cb.current(text), () => {});
      } catch {
        toast('bad', 'Camera not available.', 'Allow camera access, or type the code instead.');
      }
    })();
    return () => {
      cancelled = true;
      scanner?.stop().then(() => scanner?.clear()).catch(() => {});
    };
  }, [active, id, toast]);

  return <div id={id} ref={ref} className={active ? 'w-full overflow-hidden bg-[#000] min-h-[280px]' : 'hidden'} />;
}
