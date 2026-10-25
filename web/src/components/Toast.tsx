'use client';
// One toast at a time; successes leave after 4 s, errors stay until closed
// (design system: Toast).
import { Check, CircleAlert, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Kind = 'ok' | 'bad' | 'warn';
type ToastData = { id: number; kind: Kind; title: string; detail?: string };
const Ctx = createContext<(kind: Kind, title: string, detail?: string) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const show = useCallback((kind: Kind, title: string, detail?: string) => setToast({ id: Date.now(), kind, title, detail }), []);

  useEffect(() => {
    if (!toast || toast.kind === 'bad') return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const Icon = toast?.kind === 'ok' ? Check : toast?.kind === 'warn' ? TriangleAlert : CircleAlert;
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="fixed inset-x-0 bottom-[88px] z-toast flex justify-center px-s4 pointer-events-none lg:inset-x-auto lg:bottom-auto lg:right-s6 lg:top-s5" aria-live="polite">
        {toast && (
          <div key={toast.id} role={toast.kind === 'bad' ? 'alert' : 'status'} className={`tx-toast tx-toast--${toast.kind} pointer-events-auto w-full`}>
            <Icon aria-hidden="true" />
            <div>
              <div className="tx-toast__t">{toast.title}</div>
              {toast.detail && <div className="tx-toast__d">{toast.detail}</div>}
            </div>
            <button className="tx-iconbtn -m-s2" style={{ width: 36, height: 36 }} onClick={() => setToast(null)} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
