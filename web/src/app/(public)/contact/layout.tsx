import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
export const metadata: Metadata = { title: "Contact", description: "Contact TEDxGUC and find answers to common questions about events and the team.", ...(siteUrl('/contact') ? { alternates: { canonical: siteUrl('/contact') } } : {}), openGraph: { title: "Contact / TEDxGUC", description: "Contact TEDxGUC and find answers to common questions about events and the team." } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
