import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
// Private page: never indexed. Shared links show a ticket preview, not another event's poster.
const image = SITE_URL ? [{ url: SITE_URL + '/brand/og-ticket.jpg', width: 1200, height: 630, alt: 'Your TEDxGUC ticket' }] : undefined;
export const metadata: Metadata = {
  title: 'Your ticket',
  robots: { index: false, follow: false },
  openGraph: { title: 'Your TEDxGUC ticket', description: 'Open to see the QR code for the door.', ...(image ? { images: image } : {}) },
  twitter: { card: 'summary_large_image', title: 'Your TEDxGUC ticket', description: 'Open to see the QR code for the door.', ...(image ? { images: [image[0].url] } : {}) },
};
export default function PrivateLayout({ children }: { children: React.ReactNode }) { return children; }
