import type { Metadata } from 'next';
import { PageTitle } from '@/components/Brand';

export const metadata: Metadata = { title: 'Privacy notice' };

// FR-1.10: what is stored, why, how long, how to ask for deletion.
// Plain wording for now; have the board review it before launch.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[720px] px-s4 md:px-s6 pt-s7 grid gap-s5">
      <PageTitle label="Privacy" title="Your data" />
      <section className="grid gap-s2">
        <h2 className="h4">What we keep</h2>
        <p className="text-ink-2">When you register, apply, order or write to us, we keep your name, email, phone (if you give it) and your answers to the form.</p>
      </section>
      <section className="grid gap-s2">
        <h2 className="h4">Why</h2>
        <p className="text-ink-2">To send your ticket or reply, check you in at the door, and contact you about that event or application. We never sell it or share it with sponsors.</p>
      </section>
      <section className="grid gap-s2">
        <h2 className="h4">Who sees it</h2>
        <p className="text-ink-2">Only the TEDxGUC board members who run that event or recruitment round.</p>
      </section>
      <section className="grid gap-s2">
        <h2 className="h4">How long</h2>
        <p className="text-ink-2">Event registrations for the season they belong to. Job applications are deleted six months after the round closes, unless you join the team.</p>
      </section>
      <section className="grid gap-s2">
        <h2 className="h4">Deleting it</h2>
        <p className="text-ink-2">Write to us from the contact page and we’ll delete your data within 30 days.</p>
      </section>
    </div>
  );
}
