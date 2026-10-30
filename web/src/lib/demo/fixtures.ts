// Sample data for demo mode. Divisions and teams are the real 2027 setup
// (FR-3.2); people, events and tasks are invented. Dates are relative to
// today so the demo always looks current.
import archiveSpeakers from '../data/archive-speakers.json';
import type {
  Announcement, CalendarItem, Division, EventField, Invite, Member, Notification, Partner, Section, Speaker,
  Task, TaskComment, Team, TxEvent,
} from '../types';

const DAY = 86400_000;
const at = (days: number, hour = 18, minute = 0) => {
  const d = new Date(Date.now() + days * DAY);
  // Cairo is UTC+2/+3; using UTC−3h keeps sample times sensible in Cairo.
  d.setUTCHours(hour - 3, minute, 0, 0);
  return d.toISOString();
};

export const divisions: Division[] = [
  { id: 'd-talks', name: 'Talks', kind: 'talks' },
  { id: 'd-ops', name: 'Operations', kind: 'operations' },
  { id: 'd-od', name: 'Organizational Development', kind: 'org_development' },
  { id: 'd-mc', name: 'Marketing & Coordination', kind: 'marketing' },
];

export const teams: Team[] = [
  { id: 't-coach', name: 'Coaching', kind: 'coaching', division_id: 'd-talks' },
  { id: 't-rnp', name: 'Research and Production', kind: 'research_production', division_id: 'd-talks' },
  { id: 't-lnp', name: 'Logistics and Planning', kind: 'logistics_planning', division_id: 'd-ops' },
  { id: 't-part', name: 'Partnerships', kind: 'partnerships', division_id: 'd-ops' },
  { id: 't-ae', name: "Associates' Experience", kind: 'associates_experience', division_id: 'd-od' },
  { id: 't-ad', name: "Associates' Development", kind: 'associates_development', division_id: 'd-od' },
  { id: 't-cc', name: 'Campaigns and Copyrights', kind: 'campaigns_copyrights', division_id: 'd-mc' },
  { id: 't-md', name: 'Media and Design', kind: 'media_design', division_id: 'd-mc' },
];

const team = (id: string) => teams.find((t) => t.id === id)!;
const div = (id: string) => divisions.find((d) => d.id === id)!;

function m(user_id: string, name: string, role: Member['role'], teamId: string | null, divisionId: string | null): Member {
  const t = teamId ? team(teamId) : null;
  const d = divisionId ? div(divisionId) : t ? div(t.division_id) : null;
  return { user_id, name, photo_url: null, role, team_id: t?.id ?? null, team: t?.name ?? null, division_id: d?.id ?? null, division: d?.name ?? null, division_kind: d?.kind ?? null };
}

export const members: Member[] = [
  m('u-chair', 'Nour Hassan', 'chairman', null, null),
  m('u-cur-talks', 'Laila Mansour', 'curator', null, 'd-talks'),
  m('u-cur-ops', 'Hamza El-Sayed', 'curator', null, 'd-ops'),
  m('u-cur-od', 'Mariam Fawzy', 'curator', null, 'd-od'),
  m('u-cur-mc', 'Youssef Adel', 'curator', null, 'd-mc'),
  m('u-ex-coach', 'Salma Hany', 'executive', 't-coach', null),
  m('u-ex-rnp', 'Omar Khaled', 'executive', 't-rnp', null),
  m('u-ex-lnp', 'Karim Nabil', 'executive', 't-lnp', null),
  m('u-ex-part', 'Farida Samir', 'executive', 't-part', null),
  m('u-ex-ae', 'Ali Tarek', 'executive', 't-ae', null),
  m('u-ex-ad', 'Habiba Ashraf', 'executive', 't-ad', null),
  m('u-ex-cc', 'Seif Emad', 'executive', 't-cc', null),
  m('u-ex-md', 'Nada Sherif', 'executive', 't-md', null),
  m('u-as-md1', 'Aya Mostafa', 'associate', 't-md', null),
  m('u-as-md2', 'Bilal Hamdy', 'associate', 't-md', null),
  m('u-as-md3', 'Celine Ramy', 'associate', 't-md', null),
  m('u-as-lnp1', 'Ziad Ibrahim', 'associate', 't-lnp', null),
  m('u-as-lnp2', 'Jana Wael', 'associate', 't-lnp', null),
  m('u-as-coach1', 'Malak Ehab', 'associate', 't-coach', null),
  m('u-as-cc1', 'Hussein Galal', 'associate', 't-cc', null),
  m('u-as-part1', 'Rana Magdy', 'associate', 't-part', null),
];

// The people the demo role picker offers.
export const personas = [
  { user_id: 'u-chair', label: 'Chairman', hint: 'Sees everything' },
  { user_id: 'u-cur-ops', label: 'Operations Curator', hint: 'Runs events, tickets and check-in' },
  { user_id: 'u-cur-mc', label: 'Marketing Curator', hint: 'Whole Marketing & Coordination division' },
  { user_id: 'u-ex-md', label: 'Media & Design Executive', hint: 'Own team: tasks, attendance, requests' },
  { user_id: 'u-ex-lnp', label: 'L&P Executive', hint: 'Cash outs, fatoras, expense forms, memos' },
  { user_id: 'u-ex-part', label: 'Partnerships Executive', hint: 'Bank deposits and sponsors' },
  { user_id: 'u-as-md1', label: 'Media & Design Associate', hint: 'Own tasks and team calendar' },
  { user_id: 'u-as-lnp1', label: 'L&P Associate', hint: 'Can scan tickets at the door' },
];

export const emailOf = (userId: string) =>
  `${members.find((x) => x.user_id === userId)?.name.toLowerCase().replace(/[^a-z]+/g, '.') ?? 'member'}@student.guc.edu.eg`;

export const events: TxEvent[] = [
  {
    id: 'e-whitespace', type: 'main_event', title: 'Whitespace', slug: 'whitespace',
    description: 'TEDxGUC Whitespace. An independently organized TEDx event at the German University in Cairo. Official event listing: https://www.ted.com/tedx/events/56129',
    agenda: [], starts_at: '2023-10-08T21:00:00Z', ends_at: null,
    venue: 'German University in Cairo, New Cairo, Egypt', capacity: null,
    registration_opens_at: null, registration_closes_at: null, license_status: 'licensed', is_public: true, status: 'completed', ticket_prefix: 'TX23',
  },
  {
    id: 'e-pillars-of-everything', type: 'salon', title: 'Pillars Of Everything', slug: 'pillars-of-everything',
    description: 'TEDxGUC Salon: Pillars Of Everything. An independently organized TEDx Salon at the German University in Cairo. Official event listing: https://www.ted.com/tedx/events/63917',
    agenda: [], starts_at: '2025-05-09T21:00:00Z', ends_at: null,
    venue: 'German University in Cairo, New Cairo, Egypt', capacity: null,
    registration_opens_at: null, registration_closes_at: null, license_status: 'licensed', is_public: true, status: 'completed', ticket_prefix: 'SAL25',
  },
  {
    id: 'e-glitch', type: 'main_event', title: 'Glitch', slug: 'glitch',
    description: 'TEDxGUC Glitch. An independently organized TEDx event at the German University in Cairo. Official event listing: https://www.ted.com/tedx/events/59932',
    agenda: [], starts_at: '2024-09-27T21:00:00Z', ends_at: null,
    venue: 'German University in Cairo, New Cairo, Egypt', capacity: null,
    registration_opens_at: null, registration_closes_at: null, license_status: 'licensed', is_public: true, status: 'completed', ticket_prefix: 'TX24',
  },
  {
    id: 'e-under-construction', type: 'main_event', title: 'Under Construction', slug: 'under-construction',
    description: 'TEDxGUC Under Construction. A day of independently organized talks at the German University in Cairo. Official event listing: https://www.ted.com/tedx/events/65988',
    agenda: [], starts_at: '2025-09-27T13:00:00Z', ends_at: '2025-09-27T18:00:00Z',
    venue: 'German University in Cairo, New Cairo, Egypt', capacity: null,
    registration_opens_at: null, registration_closes_at: null, license_status: 'licensed', is_public: true, status: 'completed', ticket_prefix: 'TX25',
  },
  {
    id: 'e-main27', type: 'main_event', title: 'Loose Ends', slug: 'loose-ends',
    description: 'Our 2027 Main Event: a day of talks about the threads we leave untied, and the ones worth pulling. Eight speakers, one stage, and a lot of conversations in between.',
    agenda: [
      { time: '9:30 am', title: 'Doors open, coffee' },
      { time: '10:30 am', title: 'Session one: Unfinished', speaker: 'Dr. Rania Aziz, Mazen Fathy' },
      { time: '12:30 pm', title: 'Lunch and partner booths' },
      { time: '2:00 pm', title: 'Session two: Tangled', speaker: 'Heba Lotfy, Adham Salah' },
      { time: '4:30 pm', title: 'Session three: Tied together' },
      { time: '6:00 pm', title: 'Closing' },
    ],
    starts_at: at(20, 9, 30), ends_at: at(20, 18, 30), venue: 'GUC Main Hall, New Cairo', capacity: 1200,
    registration_opens_at: at(-10), registration_closes_at: at(19, 23, 0), license_status: 'licensed', is_public: true, status: 'published', ticket_prefix: 'TX27',
  },
  {
    id: 'e-salon1', type: 'salon', title: 'Small Talks', slug: 'small-talks',
    description: 'An evening salon: three short talks and an open conversation in a small room. Seats are limited.',
    agenda: [{ time: '6:00 pm', title: 'Talks' }, { time: '7:15 pm', title: 'Open conversation' }],
    starts_at: at(48, 18), ends_at: at(48, 20, 30), venue: 'GUC Building C, Auditorium C1', capacity: 3,
    registration_opens_at: at(-2), registration_closes_at: null, license_status: 'licensed', is_public: true, status: 'published', ticket_prefix: 'SAL27',
  },
  {
    id: 'e-workshop', type: 'workshop', title: 'Speaker coaching day', slug: null,
    description: 'Internal: rehearsal day for confirmed speakers.', agenda: [],
    starts_at: at(9, 11), ends_at: at(9, 16), venue: 'GUC Building D', capacity: null,
    registration_opens_at: null, registration_closes_at: null, license_status: 'not_required', is_public: false, status: 'published', ticket_prefix: 'TX',
  },
  {
    id: 'e-main26', type: 'main_event', title: 'Ripple', slug: 'ripple',
    description: 'The 2026 Main Event about small actions and the waves they make.', agenda: [],
    starts_at: at(-230, 9, 30), ends_at: at(-230, 18), venue: 'GUC Main Hall', capacity: 1100,
    registration_opens_at: null, registration_closes_at: null, license_status: 'licensed', is_public: true, status: 'completed', ticket_prefix: 'TX26',
  },
  {
    id: 'e-salon26', type: 'salon', title: 'Echo', slug: 'echo',
    description: 'A 2026 salon about the ideas that keep coming back.', agenda: [],
    starts_at: at(-300, 18), ends_at: at(-300, 21), venue: 'GUC Building C', capacity: 150,
    registration_opens_at: null, registration_closes_at: null, license_status: 'licensed', is_public: true, status: 'completed', ticket_prefix: 'SAL26',
  },
];

export const eventFields: EventField[] = [
  { id: 'f-uni', event_id: 'e-main27', position: 1, label: 'University', kind: 'select', required: true, options: ['GUC', 'AUC', 'Cairo University', 'Ain Shams', 'Other'] },
  { id: 'f-heard', event_id: 'e-main27', position: 2, label: 'How did you hear about us?', kind: 'text', required: false, options: [] },
];

export const speakers: Speaker[] = [
  ...archiveSpeakers.map((s, i) => ({ id: 'archive-speaker-' + i, event_id: 'e-' + s.slug, name: s.name, bio: s.bio, photo_url: null, talk_title: s.talk_title, talk_url: null })),
  { id: 's1', event_id: 'e-main27', name: 'Dr. Rania Aziz', bio: 'Neuroscientist studying how unfinished tasks stay on our minds.', photo_url: null, talk_title: 'The itch of the unfinished', talk_url: null },
  { id: 's2', event_id: 'e-main27', name: 'Mazen Fathy', bio: 'Architect who restores abandoned buildings in Downtown Cairo.', photo_url: null, talk_title: 'Buildings that wait', talk_url: null },
  { id: 's3', event_id: 'e-main27', name: 'Heba Lotfy', bio: 'Founder of a repair café network across Egypt.', photo_url: null, talk_title: 'Fix it, don’t replace it', talk_url: null },
  { id: 's4', event_id: 'e-main27', name: 'Adham Salah', bio: 'GUC alumnus and documentary filmmaker.', photo_url: null, talk_title: 'Endings we didn’t film', talk_url: null },
  { id: 's5', event_id: 'e-main26', name: 'Dina Farouk', bio: 'Climate researcher.', photo_url: null, talk_title: 'One degree', talk_url: null },
];

export const partners: Partner[] = [
  { id: 'p1', company: 'Nile Bank', tier: 'Main', logo_url: null, website: null },
  { id: 'p2', company: 'Cairo Coffee Co.', tier: 'Gold', logo_url: null, website: null },
  { id: 'p3', company: 'Delta Print', tier: 'Gold', logo_url: null, website: null },
  { id: 'p4', company: 'Zamalek Books', tier: 'Silver', logo_url: null, website: null },
  { id: 'p5', company: 'Sky Telecom', tier: 'Silver', logo_url: null, website: null },
  { id: 'p6', company: 'Green Ride', tier: 'Community', logo_url: null, website: null },
];

export const sections: Record<string, Section> = {
  about: {
    key: 'about', title: 'About TEDxGUC',
    body: { text: 'TEDxGUC is the TEDx chapter at the German University in Cairo, run by students since 2013. Every season a new board brings speakers, ideas and hundreds of guests together in one hall.' },
  },
  tedx: {
    key: 'tedx', title: 'TED and TEDx',
    body: { text: 'TED is a nonprofit devoted to ideas worth spreading. TEDx events are independently organized under a free license from TED, bringing the TED format to local communities. TEDxGUC follows TED’s rules: no selling from the stage, no politics or religion agendas, and every talk is free to watch.' },
  },
  faq: {
    key: 'faq', title: 'FAQ',
    body: {
      items: [
        { q: 'Are tickets free?', a: 'Yes. Tickets are free; seats are limited, so register early.' },
        { q: 'Do I need an account?', a: 'No. Register with your name and email; your ticket arrives by email with a private link.' },
        { q: 'I lost my ticket.', a: 'Open the event page and use “Lost your ticket?”. We’ll email it again.' },
        { q: 'Can I join the team?', a: 'We recruit at the start of each season. Watch the Join the team page and our Instagram.' },
      ],
    },
  },
};

const iso = (days: number, hour?: number) => at(days, hour ?? 23, 0);

export const tasks: Task[] = [
  { id: 'k1', team_id: 't-md', title: 'Speaker reveal carousel #3', description: 'Three slides, one per speaker. Use the brand kit template.', created_by: 'u-ex-md', deadline: iso(2), priority: 'high', status: 'in_progress', requested_by_team_id: null, decline_reason: null, completed_at: null, created_at: iso(-3), assignees: ['u-as-md1'] },
  { id: 'k2', team_id: 't-md', title: 'Event-day photo shot list', description: null, created_by: 'u-ex-md', deadline: iso(-1), priority: 'normal', status: 'todo', requested_by_team_id: null, decline_reason: null, completed_at: null, created_at: iso(-6), assignees: ['u-as-md1', 'u-as-md2'] },
  { id: 'k3', team_id: 't-md', title: 'Countdown stories (10 to 1)', description: 'Instagram stories for the last ten days.', created_by: 'u-ex-md', deadline: iso(8), priority: 'normal', status: 'todo', requested_by_team_id: null, decline_reason: null, completed_at: null, created_at: iso(-1), assignees: ['u-as-md2'] },
  { id: 'k4', team_id: 't-md', title: 'Badge design for associates', description: null, created_by: 'u-ex-md', deadline: iso(5), priority: 'low', status: 'in_review', requested_by_team_id: null, decline_reason: null, completed_at: null, created_at: iso(-8), assignees: ['u-as-md3'] },
  { id: 'k5', team_id: 't-md', title: 'Recap reel from Ripple', description: null, created_by: 'u-ex-md', deadline: iso(-12), priority: 'normal', status: 'done', requested_by_team_id: null, decline_reason: null, completed_at: iso(-11), created_at: iso(-20), assignees: ['u-as-md1'] },
  { id: 'k6', team_id: 't-lnp', title: 'Confirm stage & LED wall quote', description: 'Two quotes minimum; send to the Operations Curator.', created_by: 'u-ex-lnp', deadline: iso(-2), priority: 'urgent', status: 'in_progress', requested_by_team_id: null, decline_reason: null, completed_at: null, created_at: iso(-7), assignees: ['u-as-lnp1'] },
  { id: 'k7', team_id: 't-lnp', title: 'Print 200 flyers', description: 'Requested by Marketing & Coordination for the GUC campus drop.', created_by: 'u-cur-mc', deadline: iso(6), priority: 'normal', status: 'requested', requested_by_team_id: 't-md', decline_reason: null, completed_at: null, created_at: iso(-1), assignees: [] },
  { id: 'k8', team_id: 't-lnp', title: 'Ushering plan draft', description: null, created_by: 'u-ex-lnp', deadline: iso(10), priority: 'normal', status: 'todo', requested_by_team_id: null, decline_reason: null, completed_at: null, created_at: iso(-2), assignees: ['u-as-lnp2'] },
  { id: 'k9', team_id: 't-coach', title: 'Speaker 4 rehearsal notes', description: null, created_by: 'u-ex-coach', deadline: iso(4), priority: 'normal', status: 'in_review', requested_by_team_id: null, decline_reason: null, completed_at: null, created_at: iso(-4), assignees: ['u-as-coach1'] },
  { id: 'k10', team_id: 't-cc', title: 'Copy for the ticket confirmation email', description: null, created_by: 'u-ex-cc', deadline: iso(3), priority: 'high', status: 'todo', requested_by_team_id: null, decline_reason: null, completed_at: null, created_at: iso(-2), assignees: ['u-as-cc1'] },
];

export const comments: TaskComment[] = [
  { id: 'c1', task_id: 'k1', user_id: 'u-ex-md', body: 'Use the red X crop for the speaker photos.', created_at: iso(-2, 14) },
  { id: 'c2', task_id: 'k1', user_id: 'u-as-md1', body: 'First two slides are in the drive. Third tonight.', created_at: iso(-1, 20) },
];

type Entry = CalendarItem & { created_by: string; description?: string };
export const calendarEntries: Entry[] = [
  { source: 'entry', id: 'cal1', title: 'General assembly', starts_at: at(3, 17), ends_at: at(3, 19), all_day: false, location: 'GUC Building B, B5.01', online_url: null, team_id: null, visibility: 'club', linked_type: null, linked_id: null, created_by: 'u-chair' },
  { source: 'entry', id: 'cal2', title: 'Media & Design weekly', starts_at: at(1, 16), ends_at: at(1, 17), all_day: false, location: null, online_url: 'https://meet.google.com/', team_id: 't-md', visibility: 'team', linked_type: null, linked_id: null, created_by: 'u-ex-md' },
  { source: 'entry', id: 'cal3', title: 'L&P venue walk-through', starts_at: at(6, 12), ends_at: at(6, 14), all_day: false, location: 'GUC Main Hall', online_url: null, team_id: 't-lnp', visibility: 'team', linked_type: null, linked_id: null, created_by: 'u-ex-lnp' },
  { source: 'entry', id: 'cal4', title: 'Open day at the TEDxGUC booth', starts_at: at(12, 12), ends_at: at(12, 16), all_day: false, location: 'GUC Food Court', online_url: null, team_id: null, visibility: 'public', linked_type: null, linked_id: null, created_by: 'u-cur-mc' },
  { source: 'entry', id: 'cal5', title: 'Media & Design weekly', starts_at: at(8, 16), ends_at: at(8, 17), all_day: false, location: null, online_url: 'https://meet.google.com/', team_id: 't-md', visibility: 'team', linked_type: null, linked_id: null, created_by: 'u-ex-md' },
];

export const announcements: Announcement[] = [
  { id: 'a1', author_id: 'u-chair', audience_type: 'all', division_id: null, team_id: null, audience_role: null, title: 'Loose Ends is 20 days away', body: 'Registration passed 600 guests this week. From Sunday, every team has a daily stand-up until the event. Check your team calendar.', pinned: true, needs_confirmation: true, created_at: iso(-1, 10), read_by_me: false },
  { id: 'a2', author_id: 'u-ex-md', audience_type: 'team', division_id: null, team_id: 't-md', audience_role: null, title: 'Shoot on Friday', body: 'Bring your cameras and the two softboxes from the storage room. Call time 2 pm.', pinned: false, needs_confirmation: false, created_at: iso(-2, 18), read_by_me: false },
  { id: 'a3', author_id: 'u-cur-ops', audience_type: 'division', division_id: 'd-ops', team_id: null, audience_role: null, title: 'Supplier list is final', body: 'The approved supplier list is in the Operations folder. No purchases outside it without asking me first.', pinned: false, needs_confirmation: false, created_at: iso(-4, 12), read_by_me: false },
  { id: 'a4', author_id: 'u-chair', audience_type: 'role', division_id: null, team_id: null, audience_role: 'executive', title: 'Executives: monthly ratings open', body: 'Rate your associates by Thursday. It takes five minutes per person.', pinned: false, needs_confirmation: false, created_at: iso(-5, 9), read_by_me: false },
];

export const notifications: Record<string, Notification[]> = {
  'u-as-md1': [
    { id: 'n1', type: 'task_assigned', title: 'New task: Speaker reveal carousel #3', body: null, link: '/portal/tasks?task=k1', read_at: null, created_at: iso(-3, 12) },
    { id: 'n2', type: 'announcement', title: 'Shoot on Friday', body: 'Bring your cameras…', link: '/portal/news', read_at: null, created_at: iso(-2, 18) },
  ],
  'u-ex-lnp': [
    { id: 'n3', type: 'task_request', title: 'New request from another team: Print 200 flyers', body: null, link: '/portal/tasks?task=k7', read_at: null, created_at: iso(-1, 11) },
  ],
};

export const invites: Invite[] = [
  { id: 'i1', email: 'new.associate@student.guc.edu.eg', role: 'associate', team_id: 't-md', division_id: 'd-mc', expires_at: iso(5), accepted_at: null, revoked_at: null, created_at: iso(-2) },
];

// Seeded guests so the dashboard, registrations list and door have data.
const firstNames = ['Amira', 'Bassel', 'Dalia', 'Eyad', 'Farah', 'Ghada', 'Hady', 'Iman', 'Khaled', 'Lina', 'Mona', 'Nader', 'Ola', 'Peter', 'Reem', 'Sherif', 'Tamer', 'Yara'];
const lastNames = ['Amin', 'Badr', 'Darwish', 'Ezzat', 'Fouad', 'Gaber', 'Helmy', 'Kamal', 'Lotfy', 'Mahmoud'];
export const seededGuests = Array.from({ length: 36 }, (_, i) => {
  const name = `${firstNames[i % firstNames.length]} ${lastNames[(i * 7) % lastNames.length]}`;
  return {
    id: `r${i + 1}`,
    event_id: 'e-main27',
    guest_name: name,
    guest_email: `${name.toLowerCase().replace(' ', '.')}${i}@example.com`,
    guest_phone: `+20 10${String(10000000 + i * 7919).slice(0, 8)}`,
    guest_type: i % 11 === 0 ? 'vip' : 'attendee',
    status: 'registered' as const,
    ticket_no: `TX27-${String(i + 1).padStart(4, '0')}`,
    ticket_code: `demo${String(i + 1).padStart(4, '0')}`,
    status_token: `demotoken${i + 1}`,
    answers: { 'f-uni': i % 3 ? 'GUC' : 'AUC' },
    checked_in_at: null as string | null,
    created_at: iso(-10 + (i % 9), 12),
  };
});
