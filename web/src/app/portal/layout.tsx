import type { Metadata } from 'next';
import PortalFrame from '@/components/portal/PortalFrame';
export const metadata: Metadata = { title: 'Member portal', robots: { index: false, follow: false } };
export default function PortalLayout({ children }: { children: React.ReactNode }) { return <PortalFrame>{children}</PortalFrame>; }
