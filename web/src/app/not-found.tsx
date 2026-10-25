import Link from 'next/link';
import { Lockup } from '@/components/Brand';

export default function NotFound() {
  return (
    <div className="min-h-dvh grid grid-rows-[auto_1fr_auto]">
      <header className="flex items-center px-s4 md:px-s6 h-[64px] border-b border-line">
        <Link href="/" aria-label="TEDxGUC home"><Lockup height={22} /></Link>
      </header>
      <main className="tx-watermark is-hero grid place-items-center px-s4 py-s8 text-center">
        <div className="grid gap-s4 justify-items-center">
          <div className="tx-label">Error <b>(404)</b></div>
          <h1 className="display uppercase tx-red">Loose end</h1>
          <p className="body-lg text-ink-2 max-w-[440px]">This page doesn’t exist, or it moved.</p>
          <Link href="/" className="tx-btn tx-btn--primary">Back home</Link>
        </div>
      </main>
      <div className="tx-bottombar" />
    </div>
  );
}
