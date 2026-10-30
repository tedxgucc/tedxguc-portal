import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
export const metadata: Metadata = { title: "Board", description: "Meet the Chairman, four Curators and eight Executives leading TEDxGUC.", ...(siteUrl('/board') ? { alternates: { canonical: siteUrl('/board') } } : {}), openGraph: { title: "Board / TEDxGUC", description: "Meet the Chairman, four Curators and eight Executives leading TEDxGUC." } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
