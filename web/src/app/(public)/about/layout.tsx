import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site';
export const metadata: Metadata = { title: "About", description: "Get to know TEDxGUC, independently organized at the German University in Cairo since 2013.", ...(siteUrl('/about') ? { alternates: { canonical: siteUrl('/about') } } : {}), openGraph: { title: "About / TEDxGUC", description: "Get to know TEDxGUC, independently organized at the German University in Cairo since 2013." } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
