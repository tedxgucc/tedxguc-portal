'use client';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { PageTitle } from '@/components/Brand';
import { EventCard } from '@/components/EventCard';
import { DataNotice } from '@/components/public/DataNotice';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { api } from '@/lib/api';
import { filterEvents } from '@/lib/public-discovery';
import { usePublicData } from '@/lib/usePublicData';

const kinds = [{ value: '', label: 'All experiences' }, { value: 'main_event', label: 'Main events' }, { value: 'salon', label: 'Salons' }, { value: 'workshop', label: 'Workshops' }, { value: 'other', label: 'Other events' }];
export default function EventsPage() {
  const { data, error, loading, reload } = usePublicData(async () => {
    const [upcoming, past] = await Promise.all([api.listEvents('upcoming'), api.listEvents('past')]); return { upcoming, past };
  });
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [period, setPeriod] = useState<'upcoming' | 'past'>('upcoming');
  const rows = filterEvents(data?.[period] ?? [], query, kind);
  const reset = () => { setQuery(''); setKind(''); };
  return <div className="public-container public-discovery">
    <div className="public-page-intro"><PageTitle label="Come curious" title="Find your next idea." /><p>One room. Different perspectives. Explore the talks, salons and workshops that bring us together.</p></div>
    <div className="public-discovery__tools">
      <div className="public-tabs" role="group" aria-label="Event period"><button type="button" aria-pressed={period === 'upcoming'} onClick={() => setPeriod('upcoming')}>Coming up{data && <span>{data.upcoming.length}</span>}</button><button type="button" aria-pressed={period === 'past'} onClick={() => setPeriod('past')}>Past events{data && <span>{data.past.length}</span>}</button></div>
      <label className="public-search"><span className="sr-only">Search events by name, description or venue</span><Search size={18} aria-hidden="true" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events or venues" /></label>
    </div>
    <div className="public-filter-row" role="group" aria-label="Event type">{kinds.map((k) => <button type="button" key={k.value} aria-pressed={kind === k.value} onClick={() => setKind(k.value)}>{k.label}</button>)}</div>
    {error && <DataNotice message={error} retry={reload} loading={loading} />}
    {!data && loading ? <div className="public-event-grid" aria-label="Loading events" aria-busy="true"><Skeleton h={380} /><Skeleton h={380} /></div> : data && <>
      <div className="public-results"><p role="status" aria-live="polite">{rows.length} {rows.length === 1 ? 'experience' : 'experiences'}{query.trim() ? ' matching your search' : period === 'upcoming' ? ' coming up' : ' from our archive'}</p>{(query || kind) && <button type="button" onClick={reset}><X size={14} aria-hidden="true" />Clear filters</button>}</div>
      {rows.length ? <div className="public-event-grid">{rows.map((e) => <EventCard key={e.id} event={e} past={period === 'past'} />)}</div> : <EmptyState title={query || kind ? 'No matches yet.' : period === 'upcoming' ? 'The next chapter is taking shape.' : 'Our archive is on its way.'} action={(query || kind) ? <Button variant="secondary" onClick={reset}>Clear filters</Button> : undefined}>{query || kind ? 'Try another name, venue or event type.' : 'Check back soon for the next TEDxGUC experience.'}</EmptyState>}
    </>}
  </div>;
}
