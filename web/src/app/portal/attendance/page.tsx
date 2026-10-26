'use client';
// Attendance was removed; meetings live at /portal/meetings. Old links land here.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AttendanceMoved() {
  const router = useRouter();
  useEffect(() => { router.replace('/portal/meetings'); }, [router]);
  return null;
}
