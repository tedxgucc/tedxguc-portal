'use client';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { PageTitle, SectionHeading } from '@/components/Brand';
import { SpeakerCard } from '@/components/SpeakerCard';
import { DataNotice } from '@/components/public/DataNotice';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { filterSpeakers } from '@/lib/public-discovery';
import { usePublicData } from '@/lib/usePublicData';

export default function SpeakersPage() {
  const { data, error, loading, reload } = usePublicData(async () => {
    const [speakers, events] = await Promise.all([api.listSpeakers(), api.listEvents('all')]); return { speakers, events };
  });
  const [query, setQuery] = useState('');
  const [eventId, setEventId] = useState('');
  const rows = filterSpeakers(data?.speakers ?? [], query, eventId);
  const events = (data?.events ?? []).filter((e) => data?.speakers.some((s) => s.event_id === e.id));
  const groups = events.map((event) => ({ event, speakers: rows.filter((s) => s.event_id === event.id) })).filter((g) => g.speakers.length);
  const others = rows.filter((s) => !events.some((e) => e.id === s.event_id));
  const reset = () => { setQuery(''); setEventId(''); };
  return <div className="public-container public-discovery">
    <div className="public-page-intro"><PageTitle label="Meet the voices" title="People. Perspectives. Possibilities." /><p>Discover the people behind the ideas. Open a speaker profile, find a talk, and keep the conversation going.</p></div>
    <div className="public-discovery__tools">
      <label className="public-search"><span className="sr-only">Search speakers, talks or biographies</span><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a name or an idea" /></label>
      <label className="public-select"><span className="sr-only">Filter speakers by event</span><select value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">All events</option>{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
    </div>
    {error && <DataNotice message={error} retry={reload} loading={loading} />}
    {!data && loading ? <div className="public-speaker-grid" aria-busy="true" aria-label="Loading speakers"><Skeleton h={360} /><Skeleton h={360} /><Skeleton h={360} /></div> : data && <>
      <div className="public-results"><p role="status" aria-live="polite">{rows.length} {rows.length === 1 ? 'speaker' : 'speakers'}{query.trim() ? ' matching your search' : ' to discover'}</p>{(query || eventId) && <button type="button" onClick={reset}><X size={14} aria-hidden="true" />Clear filters</button>}</div>
      {!rows.length && <EmptyState title={query || eventId ? 'No matching voices.' : 'New voices, coming soon.'} action={(query || eventId) ? <Button variant="secondary" onClick={reset}>Clear filters</Button> : undefined}>{query || eventId ? 'Try a different name, topic or event.' : 'Speakers are announced as each event takes shape.'}</EmptyState>}
      {groups.map(({ event, speakers }) => <section className="public-speaker-section" key={event.id} aria-labelledby={'event-' + event.id}><SectionHeading as="h2"><span id={'event-' + event.id}>{event.title}</span></SectionHeading><div className="public-speaker-grid">{speakers.map((s) => <SpeakerCard key={s.id} speaker={s} />)}</div></section>)}
      {!!others.length && <section className="public-speaker-section" aria-label="More speakers"><div className="public-speaker-grid">{others.map((s) => <SpeakerCard key={s.id} speaker={s} />)}</div></section>}
    </>}
  </div>;
}
