import type { Metadata } from 'next';

// Private card and verify links: keep them out of search engines.
export const metadata: Metadata = { title: 'X Access', robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
