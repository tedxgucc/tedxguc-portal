'use client';
// The card the account pages share (emailed links, choosing a password), in the
// same style as the sign-in page.
import { LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { Lockup, TedxMark } from '@/components/Brand';
import { ThemeToggle } from '@/components/ThemeToggle';
import '@/app/login/login.css';

export function AuthCard({ tag, title, intro, children }: { tag: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="portal-login">
      <header className="login-header">
        <Link href="/" aria-label="TEDxGUC home"><Lockup height={24} /></Link>
        <div className="login-header-actions"><ThemeToggle /></div>
      </header>
      <main className="login-main" style={{ gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'center' }}>
        <section className="login-access" aria-labelledby="auth-title" style={{ width: '100%', maxWidth: 480 }}>
          <div className="login-card">
            <div className="login-card-top"><TedxMark size={34} /><span><LockKeyhole size={12} />{tag}</span></div>
            <h2 id="auth-title">{title}</h2>
            {intro && <p className="login-card-intro">{intro}</p>}
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
