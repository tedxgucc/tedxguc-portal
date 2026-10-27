'use client';
// Pickup scanner for members the sign-up managers added (and Operations).
import { PageTitle } from '@/components/Brand';
import { Pickup } from '@/components/portal/Pickup';
import { usePortal } from '@/components/portal/PortalContext';
import { EmptyState } from '@/components/ui';

export default function PickupPage() {
  const { pickupScanner } = usePortal();
  if (!pickupScanner) return <EmptyState title="For pickup scanners">Ask a sign-up manager to add you to pickup.</EmptyState>;
  return <><PageTitle label="Sign-ups" title="Pickup scanner" /><Pickup /></>;
}
