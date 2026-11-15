import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
const description = 'Meet TEDxGUC before associates recruitment: what TEDx is, what every team does, and which day you will come.';
export const metadata: Metadata = { title: 'Orientation', description, ...(siteUrl('/orientation') ? { alternates: { canonical: siteUrl('/orientation') } } : {}), openGraph: { title: 'Orientation · TEDxGUC', description }, twitter: { title: 'Orientation · TEDxGUC', description } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
