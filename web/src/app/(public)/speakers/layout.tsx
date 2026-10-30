import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
export const metadata: Metadata = { title: "Speakers", description: "Meet TEDxGUC speakers, discover their ideas and watch their talks.", ...(siteUrl('/speakers') ? { alternates: { canonical: siteUrl('/speakers') } } : {}), openGraph: { title: "Speakers / TEDxGUC", description: "Meet TEDxGUC speakers, discover their ideas and watch their talks." } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
