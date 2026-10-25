'use client';
// Public calendar (FR-15.8): public entries and listed events, no sign-in.
import { useCallback } from 'react';
import { PageTitle } from '@/components/Brand';
import { CalendarView } from '@/components/CalendarView';
import { api } from '@/lib/api';

export default function PublicCalendarPage() {
  const load = useCallback((from: string, to: string) => api.publicCalendar(from, to), []);
  return (
    <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7">
      <PageTitle label="Calendar" title="What’s on" />
      <CalendarView load={load} publicMode />
    </div>
  );
}
