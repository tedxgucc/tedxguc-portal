import { BASE_PATH } from '@/lib/env';
/* eslint-disable @next/next/no-img-element */
// The official TEDxGUC lockup (never redrawn): white on dark, black on light.
// Minimum 96px wide on screen; clear space is handled by the caller's padding.
export function Lockup({ height = 22, className = '' }: { height?: number; className?: string }) {
  const width = Math.round((892 / 143) * height);
  return (
    <span className={`inline-flex ${className}`}>
      <img className="on-dark" src={`${BASE_PATH}/brand/tedxguc-lockup-white.png`} alt="TEDxGUC" width={width} height={height} style={{ height, width: 'auto' }} />
      <img className="on-light" src={`${BASE_PATH}/brand/tedxguc-lockup-black.png`} alt="TEDxGUC" width={width} height={height} style={{ height, width: 'auto' }} />
    </span>
  );
}

// Lockup that always shows white (tickets, the deep-red card).
export function LockupWhite({ height = 18 }: { height?: number }) {
  return <img src={`${BASE_PATH}/brand/tedxguc-lockup-white.png`} alt="TEDxGUC" height={height} style={{ height, width: 'auto' }} />;
}

// The portal X sub-mark: geometric, never the "x" from the TEDx logo.
export function PortalMark({ size = 28, white = false }: { size?: number; white?: boolean }) {
  return <img src={`${BASE_PATH}/brand/portal-mark-${white ? 'white' : 'red'}.svg`} alt="" width={size} height={size} aria-hidden="true" />;
}

// Display the actual TEDx x from the official lockup, without redrawing it.
export function TedxMark({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="385 0 92 90" aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}>
    <image href={BASE_PATH + '/brand/tedxguc-lockup-black.png'} x="0" y="0" width="892" height="143" />
  </svg>;
}

// Page label: "OPERATIONS (04)" with the count in accent-ink.
export function TxLabel({ children, count, className = '' }: { children: React.ReactNode; count?: number | string; className?: string }) {
  return (
    <div className={`tx-label ${className}`}>
      {children}
      {count !== undefined && <> <b>({typeof count === 'number' ? String(count).padStart(2, '0') : count})</b></>}
    </div>
  );
}

// Every page title gets a tx-label above it.
export function PageTitle({ label, count, title, children }: { label: string; count?: number; title: string; children?: React.ReactNode }) {
  return (
    <header className="grid gap-s3 mb-s6">
      <TxLabel count={count}>{label}</TxLabel>
      <div className="flex flex-wrap items-end justify-between gap-s4">
        <h1 className="h1 uppercase">{title}</h1>
        {children}
      </div>
    </header>
  );
}

export function SectionHeading({ children, as: As = 'h2', className = '' }: { children: React.ReactNode; as?: 'h2' | 'h3'; className?: string }) {
  return <As className={`tx-heading ${As === 'h2' ? 'h2' : 'h3'} ${className}`}>{children}</As>;
}
