'use client';
// Attendance was removed; one meeting now lives at /portal/meetings/view.
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function Moved() {
  const id = useSearchParams().get('id') ?? '';
  const router = useRouter();
  useEffect(() => { router.replace(id ? `/portal/meetings/view?id=${encodeURIComponent(id)}` : '/portal/meetings'); }, [id, router]);
  return null;
}

export default function MeetingMoved() {
  return <Suspense><Moved /></Suspense>;
}
