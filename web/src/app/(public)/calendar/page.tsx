'use client';
// Public calendar: upcoming public events only, even for signed-in members.
import { useCallback } from 'react';
import { PageTitle } from '@/components/Brand';
import { CalendarView } from '@/components/CalendarView';
import { api } from '@/lib/api';

export default function PublicCalendarPage() {
  const load = useCallback((from: string, to: string) => api.publicCalendar(from, to), []);
  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7">
      <PageTitle label="Calendar" title="What’s on" />
      <p className="text-ink-2 mb-s5">Upcoming public events.</p>
      <CalendarView load={load} publicMode />
    </div>
  );
}
