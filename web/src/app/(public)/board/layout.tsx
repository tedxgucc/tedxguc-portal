import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
export const metadata: Metadata = { title: "Board", description: "Meet the Chairman, Curators and Executives leading TEDxGUC.", ...(siteUrl('/board') ? { alternates: { canonical: siteUrl('/board') } } : {}), openGraph: { title: "Board · TEDxGUC", description: "Meet the Chairman, Curators and Executives leading TEDxGUC." }, twitter: { title: "Board · TEDxGUC", description: "Meet the Chairman, Curators and Executives leading TEDxGUC." } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
