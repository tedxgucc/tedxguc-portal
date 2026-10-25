'use client';
import { PageTitle, SectionHeading, TxLabel } from '@/components/Brand';
import { DivisionSections, SectionText } from '@/components/SiteSections';
import { Avatar } from '@/components/ui';
import { api } from '@/lib/api';
import { PageLoading, useLoad } from '@/lib/useLoad';
import { LICENSE_LINE } from '@/lib/env';
import { roleLabel } from '@/lib/roles';
import { DIVISION_KEYS } from '@/lib/sections';


// FR-1.2: TEDx vs TED, history since 2013, current board. FR-1.8: license line.
export default function AboutPage() {
  const d = useLoad(async () => {
    const [sections, board] = await Promise.all([api.getSections(['about', 'tedx', ...DIVISION_KEYS]), api.getBoard()]);
    return { sections, board };
  });
  if (!d) return <PageLoading />;
  const { sections, board } = d;
  const leads = board.filter((b) => b.role !== 'executive');
  const execs = board.filter((b) => b.role === 'executive');
  return (
    <>
      <section className="tx-watermark is-hero">
        <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 pt-s7 pb-s6">
          <PageTitle label="About" title="Since 2013" />
          <SectionText k="about" initial={sections.about} className="body-lg text-ink-2 max-w-[640px] -mt-s3" fallback={'TEDxGUC is the TEDx chapter at the German University in Cairo, run by students since 2013.'} />
        </div>
      </section>
      <div className="mx-auto max-w-[1200px] px-s4 md:px-s6 grid gap-s7">
        <section className="grid gap-s4 md:grid-cols-2" aria-labelledby="tedx">
          <div className="grid gap-s3 content-start">
            <SectionHeading><span id="tedx">TED and TEDx</span></SectionHeading>
            <SectionText k="tedx" initial={sections.tedx} className="text-ink-2" fallback={'TED is a nonprofit devoted to ideas worth spreading. TEDx events are independently organized under a free license from TED.'} />
            <p className="tx-legal">{LICENSE_LINE}</p>
          </div>
          <ul className="tx-stars body md:pt-s7">
            <li>TED runs the global conference and TED.com</li>
            <li>TEDx events are local, independent and licensed by TED</li>
            <li>Every TEDxGUC talk follows TED’s content rules</li>
          </ul>
        </section>

        <section className="grid gap-s4" aria-labelledby="divisions">
          <SectionHeading><span id="divisions">How we work</span></SectionHeading>
          <DivisionSections initial={Object.fromEntries(DIVISION_KEYS.filter((k) => sections[k]).map((k) => [k, sections[k]]))} />
        </section>

        {board.length > 0 && (
          <section className="grid gap-s5" aria-labelledby="board">
            <div className="grid gap-s2">
              <TxLabel count={board.length}>Current board</TxLabel>
              <SectionHeading><span id="board">The board</span></SectionHeading>
            </div>
            <ul className="grid gap-s2 sm:grid-cols-2 lg:grid-cols-3">
              {leads.map((b) => (
                <li key={b.name} className="tx-card flex items-center gap-s3">
                  <Avatar name={b.name} />
                  <div>
                    <div className="font-semibold">{b.name}</div>
                    <div className="text-body-sm text-ink-2">{roleLabel[b.role]}{b.division ? ` · ${b.division}` : ''}</div>
                  </div>
                </li>
              ))}
            </ul>
            {execs.length > 0 && (
              <ul className="grid gap-s2 sm:grid-cols-2 lg:grid-cols-4">
                {execs.map((b) => (
                  <li key={b.name} className="flex items-center gap-s3 py-s2 border-b border-line">
                    <Avatar name={b.name} small />
                    <div>
                      <div className="text-body-sm font-semibold">{b.name}</div>
                      <div className="text-caption text-ink-3">{b.team}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </>
  );
}
