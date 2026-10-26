'use client';
// Pick and upload one photo, with a preview.
import { ImagePlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui';
import { adminApi } from '@/lib/api/admin';

export function PhotoPicker({ url, onChange, label, folder, round }: { url: string | null; onChange: (u: string | null) => void; label: string; folder: 'events' | 'speakers' | 'announcements' | 'partners'; round?: boolean }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await adminApi.uploadImage(f, folder)); } catch (e) { toast('bad', 'Photo not added.', (e as Error).message); } finally { setBusy(false); }
  };
  const size = round ? 'w-[96px] h-[96px]' : 'w-full aspect-[16/9]';
  return (
    <div className="grid gap-s2">
      <span className="tx-label">{label}</span>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <div className={`relative ${size} bg-surface-2 border border-dashed border-line-strong overflow-hidden grid place-items-center ${round ? 'rounded-full' : ''}`}>
        {url ? <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" /> /* eslint-disable-line @next/next/no-img-element */
          : <button type="button" onClick={() => ref.current?.click()} className="grid justify-items-center gap-s1 text-ink-3 bg-transparent border-0 cursor-pointer p-s3" disabled={busy}>
              <ImagePlus aria-hidden="true" />{!round && <span className="text-caption">{busy ? 'Uploading…' : 'Add a photo'}</span>}
            </button>}
      </div>
      {url && (
        <div className="flex gap-s2">
          <Button type="button" small variant="ghost" onClick={() => ref.current?.click()} loading={busy}>Change</Button>
          <Button type="button" small variant="ghost" onClick={() => onChange(null)}>Remove</Button>
        </div>
      )}
    </div>
  );
}
