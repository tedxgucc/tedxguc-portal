import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Join the team' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
