import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
export const metadata: Metadata = { title: "Events", description: "Explore upcoming TEDxGUC events, salons and workshops, and revisit past experiences.", ...(siteUrl('/events') ? { alternates: { canonical: siteUrl('/events') } } : {}), openGraph: { title: "Events / TEDxGUC", description: "Explore upcoming TEDxGUC events, salons and workshops, and revisit past experiences." } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
