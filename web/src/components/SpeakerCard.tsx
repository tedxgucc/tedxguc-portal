/* eslint-disable @next/next/no-img-element */
import { PlayCircle } from 'lucide-react';
import { initials } from '@/lib/format';
import type { Speaker } from '@/lib/types';

export function SpeakerCard({ speaker }: { speaker: Speaker }) {
  return (
    <article className="tx-card grid gap-s3 content-start">
      <div className="aspect-square bg-surface-3 grid place-items-center overflow-hidden">
        {speaker.photo_url
          ? <img src={speaker.photo_url} alt={`Photo of ${speaker.name}`} className="w-full h-full object-cover" />
          : <span className="stat text-ink-3" aria-hidden="true">{initials(speaker.name)}</span>}
      </div>
      <h3 className="h4">{speaker.name}</h3>
      {speaker.talk_title && <p className="text-body-sm font-semibold">“{speaker.talk_title}”</p>}
      {speaker.bio && <p className="text-body-sm text-ink-2">{speaker.bio}</p>}
      {speaker.talk_url && (
        <a href={speaker.talk_url} className="tx-link text-body-sm inline-flex items-center gap-s1" target="_blank" rel="noopener noreferrer">
          <PlayCircle size={16} aria-hidden="true" />Watch the talk
        </a>
      )}
    </article>
  );
}
