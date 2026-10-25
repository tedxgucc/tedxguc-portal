import { DEMO } from '@/lib/env';

// A slim strip so nobody mistakes demo data for the real thing.
export function DemoBanner() {
  if (!DEMO) return null;
  return (
    <div className="bg-surface-2 text-ink-2 text-caption text-center px-s4 py-s2 border-b border-line">
      Demo mode: sample data, nothing is saved. Connect Supabase to go live.
    </div>
  );
}
