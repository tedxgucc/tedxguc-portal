import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
export const metadata: Metadata = { title: "Calendar", description: "See what is coming up on the TEDxGUC public events calendar.", ...(siteUrl('/calendar') ? { alternates: { canonical: siteUrl('/calendar') } } : {}), openGraph: { title: "Calendar / TEDxGUC", description: "See what is coming up on the TEDxGUC public events calendar." } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
