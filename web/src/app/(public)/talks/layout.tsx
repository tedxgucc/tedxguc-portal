import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
const d = 'Watch every TEDxGUC talk, grouped by event, and find them on YouTube.';
export const metadata: Metadata = { title: 'Talks', description: d, ...(siteUrl('/talks') ? { alternates: { canonical: siteUrl('/talks') } } : {}), openGraph: { title: 'Talks · TEDxGUC', description: d }, twitter: { title: 'Talks · TEDxGUC', description: d } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
