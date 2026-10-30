'use client';
/* eslint-disable @next/next/no-img-element */
import { ArrowUpRight, Play } from 'lucide-react';
import { useState } from 'react';
import { initials } from '@/lib/format';
import { safeExternalUrl } from '@/lib/public-discovery';
import type { Speaker } from '@/lib/types';
import { Modal } from '@/components/ui';

export function SpeakerCard({ speaker, preview = false }: { speaker: Speaker; preview?: boolean }) {
  const [open, setOpen] = useState(false);
  const talk = safeExternalUrl(speaker.talk_url);
  const photo = <div className="public-speaker__photo tx-media">
    {speaker.photo_url ? <img src={speaker.photo_url} alt="" width={512} height={512} loading="lazy" decoding="async" /> : <span className="public-speaker__placeholder" aria-hidden="true">{initials(speaker.name)}</span>}
    {preview && <span className="home-speaker-preview"><span className="tx-label">{talk ? 'Watch the talk' : 'Meet the speaker'}</span><strong>{speaker.talk_title || speaker.name}</strong><span>{speaker.bio}</span></span>}
    <span className="public-speaker__cue" aria-hidden="true"><ArrowUpRight size={24} /></span>
  </div>;
  return <>
    <article className={'public-speaker' + (preview ? ' is-preview' : '')}>
      {talk ? <a href={talk} target="_blank" rel="noopener noreferrer" className="public-speaker__open" aria-label={'Watch the talk by ' + speaker.name + ' (opens in a new tab)'}>{photo}</a> : <button type="button" className="public-speaker__open" onClick={() => setOpen(true)} aria-label={'Meet ' + speaker.name}>{photo}</button>}
      <button type="button" className="public-speaker__open" onClick={() => setOpen(true)} aria-label={'Meet ' + speaker.name}>
        <div className="public-speaker__body"><span className="tx-label">Speaker</span><h3>{speaker.name}</h3>{speaker.talk_title && <p className="text-body-sm text-ink-2">{speaker.talk_title}</p>}<span className="public-speaker__more">Meet the speaker<ArrowUpRight size={15} aria-hidden="true" /></span></div>
      </button>
      {talk && <a href={talk} className="public-speaker__watch" target="_blank" rel="noopener noreferrer"><Play size={14} aria-hidden="true" />Watch the talk<span className="sr-only"> by {speaker.name} (opens in a new tab)</span></a>}
    </article>
    <Modal open={open} title={speaker.name} onClose={() => setOpen(false)}>
      <div className="grid gap-s4">
        {speaker.photo_url && <img src={speaker.photo_url} alt={speaker.name} width={512} height={512} className="public-speaker__portrait" loading="lazy" />}
        {speaker.talk_title && <h3 className="h3 uppercase">{speaker.talk_title}</h3>}
        <p className="text-ink-2 whitespace-pre-line">{speaker.bio || 'More about this speaker will be announced soon.'}</p>
        {talk && <a href={talk} target="_blank" rel="noopener noreferrer" className="tx-btn tx-btn--primary justify-self-start"><Play size={18} aria-hidden="true" />Watch the talk<ArrowUpRight size={18} aria-hidden="true" /></a>}
      </div>
    </Modal>
  </>;
}
