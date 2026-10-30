import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
export const metadata: Metadata = { title: "Join the team", description: "Explore open TEDxGUC roles and apply to join the organizing team.", ...(siteUrl('/join') ? { alternates: { canonical: siteUrl('/join') } } : {}), openGraph: { title: "Join the team / TEDxGUC", description: "Explore open TEDxGUC roles and apply to join the organizing team." } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
