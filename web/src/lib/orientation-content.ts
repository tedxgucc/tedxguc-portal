// What students read before orientation: TEDx in short, and what each team does.
import type { TeamKind } from './types';

export const TEDX_FAQ: { q: string; a: string }[] = [
  { q: 'What is TEDx?', a: 'TED is a non-profit devoted to ideas worth spreading, usually as short talks. TEDx events are organised independently by local communities under a free licence from TED. TEDxGUC is the GUC community’s event.' },
  { q: 'What does TEDxGUC do?', a: 'Each season we find speakers, coach their talks, and put on the main event plus smaller salons and workshops. Students run all of it.' },
  { q: 'What is an associate?', a: 'Associates are the members of each team. You join one team, work with its Executive on real tasks, and learn by doing: no experience needed.' },
  { q: 'What happens at orientation?', a: 'We introduce TEDx and the club, every team explains its work, and you can ask anything.' },
  { q: 'Do I have to come both days?', a: 'No. Both days are the same, so pick the one that suits you.' },
];

export const TEAM_INFO: Record<TeamKind, string> = {
  coaching: 'Works with speakers for weeks to shape, rehearse and polish their talks.',
  research_production: 'Finds and researches speakers and themes, and produces what happens on stage.',
  logistics_planning: 'Plans the day: venue, schedules, equipment, guests and everything on site.',
  partnerships: 'Brings in sponsors and partners and looks after them through the season.',
  associates_experience: 'Keeps members connected: socials, bonding and life inside the club.',
  associates_development: 'Trains members with workshops and helps everyone grow in their role.',
  campaigns_copyrights: 'Writes the words: campaigns, captions, scripts and the club’s voice.',
  media_design: 'Designs the visuals and shoots photo and video for every event.',
  other: '',
};
