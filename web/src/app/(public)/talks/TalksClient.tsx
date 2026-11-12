'use client';
/* eslint-disable @next/next/no-img-element */
// Talks: every talk grouped by event. A YouTube talk plays right here; the rest link out.
import { ArrowUpRight, Play, Search, X, Youtube } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageTitle, SectionHeading, TxLabel } from '@/components/Brand';
import { DataNotice } from '@/components/public/DataNotice';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { YOUTUBE_URL } from '@/lib/env';
import { filterSpeakers } from '@/lib/public-discovery';
import type { Speaker } from '@/lib/types';
import { usePublicData } from '@/lib/usePublicData';

// The video id of a YouTube link (watch, youtu.be, shorts, embed, live).
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/);
      return m?.[1] ?? null;
    }
  } catch { /* not a URL */ }
  return null;
}

export default function TalksClient() {
  const { data, error, loading, reload } = usePublicData(async () => {
    const [speakers, events] = await Promise.all([api.listSpeakers(), api.listEvents('all')]); return { speakers, events };
  });
  const [query, setQuery] = useState('');
  const [eventId, setEventId] = useState('');
  const [playing, setPlaying] = useState<Speaker | null>(null);
  const rows = filterSpeakers(data?.speakers ?? [], query, eventId);
  const events = useMemo(() => (data?.events ?? []).filter((e) => data?.speakers.some((s) => s.event_id === e.id)), [data]);
  const groups = events.map((event) => ({ event, talks: rows.filter((s) => s.event_id === event.id) })).filter((g) => g.talks.length);
  const others = rows.filter((s) => !events.some((e) => e.id === s.event_id));
  const videos = (data?.speakers ?? []).filter((s) => s.talk_url).length;
  const reset = () => { setQuery(''); setEventId(''); };

  return <div className="public-container public-discovery">
    <div className="public-page-intro"><PageTitle label="Talks" title="Watch the talks." /><p>Every talk from the TEDxGUC stage, grouped by event. Press play to watch here, or open it on YouTube.</p></div>

    <a className="talks-yt" href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer">
      <span className="talks-yt__icon"><Youtube aria-hidden="true" /></span>
      <span className="grid gap-s1"><span className="tx-label">On YouTube</span><b>Find every TEDxGUC talk on the TEDx Talks channel</b></span>
      <ArrowUpRight className="talks-yt__arrow" aria-hidden="true" />
    </a>

    <div className="public-discovery__tools">
      <label className="public-search"><span className="sr-only">Search talks or speakers</span><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a talk or a speaker" /></label>
      <label className="public-select"><span className="sr-only">Filter talks by event</span><select value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">All events</option>{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
    </div>
    {error && <DataNotice message={error} retry={reload} loading={loading} />}
    {!data && loading ? <div className="talks-grid" aria-busy="true" aria-label="Loading talks"><Skeleton h={280} /><Skeleton h={280} /><Skeleton h={280} /></div> : data && <>
      <div className="public-results"><p role="status" aria-live="polite">{rows.length} {rows.length === 1 ? 'talk' : 'talks'}{query.trim() ? ' matching your search' : videos ? `, ${videos} with video` : ''}</p>{(query || eventId) && <button type="button" onClick={reset}><X size={14} aria-hidden="true" />Clear filters</button>}</div>
      {!rows.length && <EmptyState title={query || eventId ? 'No matching talks.' : 'Talks are on their way.'} action={(query || eventId) ? <Button variant="secondary" onClick={reset}>Clear filters</Button> : undefined}>{query || eventId ? 'Try a different name, topic or event.' : 'Talks appear here after each event.'}</EmptyState>}
      {groups.map(({ event, talks }) => <section className="public-speaker-section" key={event.id} aria-labelledby={'event-' + event.id}>
        <div><TxLabel>{new Date(event.starts_at).getFullYear()} · {talks.length} {talks.length === 1 ? 'talk' : 'talks'}</TxLabel><SectionHeading as="h2"><span id={'event-' + event.id}>{event.title}</span></SectionHeading></div>
        <div className="talks-grid">{talks.map((s) => <TalkCard key={s.id} talk={s} onPlay={() => setPlaying(s)} />)}</div>
      </section>)}
      {!!others.length && <section className="public-speaker-section" aria-label="More talks"><div className="talks-grid">{others.map((s) => <TalkCard key={s.id} talk={s} onPlay={() => setPlaying(s)} />)}</div></section>}
    </>}
    {playing && <Player talk={playing} onClose={() => setPlaying(null)} />}
  </div>;
}

function TalkCard({ talk, onPlay }: { talk: Speaker; onPlay: () => void }) {
  const id = youtubeId(talk.talk_url);
  const thumb = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : talk.photo_url;
  const body = <>
    <div className="talk-card__media">
      {thumb ? <img src={thumb} alt="" loading="lazy" decoding="async" /> : <span className="talk-card__initials" aria-hidden="true">{talk.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</span>}
      {talk.talk_url ? <span className="talk-card__play" aria-hidden="true"><Play fill="currentColor" /></span> : <span className="talk-card__soon">Video coming soon</span>}
    </div>
    <div className="talk-card__body">
      <strong>{talk.talk_title || talk.name}</strong>
      <span className="talk-card__speaker">{talk.talk_title ? talk.name : 'TEDxGUC speaker'}</span>
      {talk.bio && <p>{talk.bio}</p>}
    </div>
  </>;
  if (id) return <button type="button" className="talk-card" onClick={onPlay} aria-label={`Play ${talk.talk_title ?? 'the talk'} by ${talk.name}`}>{body}</button>;
  if (talk.talk_url) return <a className="talk-card" href={talk.talk_url} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${talk.talk_title ?? 'the talk'} by ${talk.name} (opens in a new tab)`}>{body}</a>;
  return <div className="talk-card talk-card--novideo">{body}</div>;
}

function Player({ talk, onClose }: { talk: Speaker; onClose: () => void }) {
  const id = youtubeId(talk.talk_url)!;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    const o = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = o; };
  }, [onClose]);
  return <div className="talk-player" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="talk-player__box" role="dialog" aria-modal="true" aria-label={`${talk.talk_title ?? 'Talk'} by ${talk.name}`}>
      <div className="talk-player__video"><iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={`${talk.talk_title ?? 'Talk'} by ${talk.name}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
      <div className="talk-player__bar">
        <div className="grid gap-s1"><b className="talk-player__title">{talk.talk_title ?? talk.name}</b><span className="text-body-sm text-ink-3">{talk.name}</span></div>
        <div className="flex gap-s2 items-center">
          <a className="tx-btn tx-btn--secondary tx-btn--sm" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer"><Youtube size={16} aria-hidden="true" />Open on YouTube</a>
          <button type="button" className="tx-iconbtn" onClick={onClose} aria-label="Close" autoFocus><X aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  </div>;
}
