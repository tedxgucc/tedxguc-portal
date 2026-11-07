// SAO paper forms (ported from the SAO Portal project). Here they are only
// filled in and downloaded as a PDF to print and sign by hand.

export type SaoField =
  | { k: string; t: 'text' | 'date' | 'number' | 'textarea'; label: string; ph?: string; half?: boolean; req?: boolean; money?: boolean }
  | { k: string; t: 'radio'; label: string; opts: string[]; other?: boolean; req?: boolean }
  | { k: string; t: 'speakers'; label: string; n: number }
  | { t: 'heading'; label: string };

export type SaoForm = {
  key: string; name: string; cat: 'Events' | 'Sponsorship' | 'Finance'; blurb: string;
  fields: SaoField[]; services?: string[]; attachments?: string[]; rules: string[];
  memo?: boolean; signatures: string[];
};

export const SERVICE_GROUPS: Record<string, { label: string; items: string[]; other?: boolean }> = {
  it: { label: 'IT Service', items: ['Projector', 'Microphones', 'Speakers'], other: true },
  marketing: { label: 'Marketing Service', items: ['MPC Coverage', 'ON SPOT Mail', 'Flyer Distribution', 'Posters in Boxes'] },
  printing: { label: 'Printing Service', items: ['Banners', 'Posters', 'Flyers'] },
  technical: { label: 'Technical Service', items: ['Electricity', 'AC/ON'] },
  technicalBooth: { label: 'Technical Service', items: ['Electricity', 'Furniture team'] },
  furnitureBooth: { label: 'Furniture Service', items: ['Chairs "2"', 'Table "1"', 'Counter "1"', 'Booth'], other: true },
  furnitureCeremony: { label: 'Furniture Service', items: ['Chairs', 'Tables', 'Podium', 'Carpet'] },
  logistics: { label: 'Logistics "by the AWG"', items: ['Cloth', 'Banners', 'Posters', 'Speakers', 'Screen'], other: true },
  logisticsCeremony: { label: 'Logistics "by the AWG"', items: ['Trophies', 'Certificates', 'Banners', 'Cloth', 'Posters'], other: true },
  agreed: { label: 'Agreed Service', items: ['ONSPOT', 'Social Media', 'Booth'], other: true },
  sponsorTech: { label: 'Technical Service', items: ['Electricity'] },
  materials: { label: 'Marketing Materials', items: ['Banners', 'Posters', 'Flyers'] },
  logSponsor: { label: 'Logistics "by the Sponsors"', items: ['Laptop', 'Desk/Podium'], other: true },
  logFnb: { label: 'Logistics "by the Sponsors"', items: ['Truck', 'Refrigerator', 'Grill', 'Coffee Machine', 'Display Refrigerator'], other: true },
};

const EVENT_SIGS = ['Office Review', 'Academic Advisor', 'Youth Welfare Director', 'GUC Vice President'];
const eventHead = (place: 'venue' | 'booth'): SaoField[] => [
  { k: 'eventName', t: 'text', label: 'Event Name', req: true, half: true },
  place === 'booth' ? { k: 'boothNo', t: 'text', label: 'Booth No.', req: true, half: true } : { k: 'venue', t: 'text', label: 'Venue', req: true, half: true },
  { k: 'startDate', t: 'date', label: 'Start Date', req: true, half: true },
  { k: 'endDate', t: 'date', label: 'End Date', req: true, half: true },
];
const desc: SaoField = { k: 'description', t: 'textarea', label: 'Event Description', ph: 'Describe the event and your objectives', req: true };
const slot: SaoField = { k: 'slot', t: 'radio', label: 'Event Slot', opts: ['Normal Hours', 'After Hours'], req: true };
const marketingPlan: SaoField = { k: 'marketingPlan', t: 'textarea', label: 'Marketing Plan', req: true };
const EVENT_RULES = [
  'Submit at least 10 working days before the event.',
  'ON SPOT mail, posters and flyers: hand in a hard copy and send a soft copy by mail 10 working days before.',
  'No publicity, sponsor contact or printing before SAO approval.',
  'Anything that costs money needs an Expense Approval.',
];
const SPONSOR_BANNED = 'Not allowed as sponsors: alcohol, energy drinks, power supplements, tobacco, medical service providers, political or religious groups, and competing educational institutions.';
const sponsorFields: SaoField[] = [
  { k: 'sponsorName', t: 'text', label: 'Sponsor Name', req: true, half: true },
  { k: 'category', t: 'text', label: 'Sponsor Category', ph: 'The sponsor industry', req: true, half: true },
  { k: 'boothNo', t: 'text', label: 'Booth No.', req: true, half: true },
  { k: 'agreedFees', t: 'number', label: 'Agreed Fees (EGP)', req: true, half: true, money: true },
  { k: 'startDate', t: 'date', label: 'Start Date', req: true, half: true },
  { k: 'endDate', t: 'date', label: 'End Date', req: true, half: true },
  { k: 'sponsorDescription', t: 'textarea', label: 'Sponsor Description', ph: 'The sponsor products and services', req: true },
  { k: 'boothType', t: 'radio', label: 'Sponsor Booth', opts: ['GUC Booth', 'Private Booth/Truck'], req: true },
];

export const SAO_FORMS: SaoForm[] = [
  { key: 'general', name: 'General Event Approval', cat: 'Events', blurb: 'Any regular club event on campus.',
    rules: [...EVENT_RULES, 'Venue and booth must be assigned 10 days before the event.'],
    fields: [...eventHead('venue'), marketingPlan, { k: 'eventManager', t: 'text', label: 'Event Manager', req: true }, desc, slot,
      { k: 'activities', t: 'textarea', label: 'Event Activities', ph: 'The event agenda', req: true }],
    services: ['it', 'marketing', 'printing', 'technical', 'logistics'], signatures: EVENT_SIGS },
  { key: 'entertainment', name: 'Entertainment Event Approval', cat: 'Events', blurb: 'Concerts, parties, performances and shows.',
    rules: [...EVENT_RULES, 'The venue must be approved by the SAO and Health & Safety.', 'Any performance must be approved by SCAD, and the script reviewed by the SAO.'],
    fields: [...eventHead('venue'), marketingPlan, { k: 'eventManager', t: 'text', label: 'Event Manager', req: true }, desc, slot,
      { k: 'activities', t: 'textarea', label: 'Event Activities', ph: 'The event agenda', req: true }],
    attachments: ['Performance script (if any)', 'SCAD approval of the performance (if any)'],
    services: ['it', 'marketing', 'printing', 'technical', 'logistics'], signatures: EVENT_SIGS },
  { key: 'educational', name: 'Educational Approval', cat: 'Events', blurb: 'Trainings, workshops, conferences, webinars, talks.',
    rules: [...EVENT_RULES, 'The L&D form must be approved by SCAD first - attach it.', 'Send the speakers list to the SAO at the start of the semester.'],
    fields: [...eventHead('venue'), { k: 'speakers', t: 'speakers', label: 'Speakers', n: 3 }, desc, slot,
      { k: 'content', t: 'textarea', label: 'Event Content', ph: "The speakers' talks", req: true },
      { k: 'eventType', t: 'radio', label: 'Event Type', opts: ['Training', 'Workshop', 'Conference', 'Webinar', 'Public Talk', 'Others'], other: true, req: true }],
    attachments: ['SCAD Approval (L&D form)'],
    services: ['it', 'marketing', 'printing', 'technical'], signatures: EVENT_SIGS },
  { key: 'sports', name: 'Sports Approval', cat: 'Events', blurb: 'Leagues, tournaments and sports days.',
    rules: [...EVENT_RULES, 'The Sports Club and Sports Department must review and sign first.', 'Book the Sports Center at least 2 weeks ahead.'],
    fields: [...eventHead('venue'), desc, slot,
      { k: 'plan', t: 'textarea', label: 'Event Plan', ph: 'The event rules and structure', req: true },
      { k: 'eventType', t: 'radio', label: 'Event Type', opts: ['Football', 'Fitness', 'Tennis', 'Volleyball', 'Basketball', 'Others'], other: true, req: true }],
    attachments: ['Sports Club review (signed)', 'Sports Department review (signed)'],
    services: ['it', 'marketing', 'printing', 'technical'], signatures: EVENT_SIGS },
  { key: 'ceremony', name: 'Opening / Closing Approval', cat: 'Events', blurb: 'Club opening and closing ceremonies.',
    rules: [...EVENT_RULES, 'Reserve the venue by mail at least 10 working days before.', 'Food entering campus must be approved by the GUC Clinic.'],
    fields: [...eventHead('venue'),
      { k: 'cateringPlan', t: 'textarea', label: 'Catering Plan', req: true },
      { k: 'entertainmentPlan', t: 'textarea', label: 'Entertainment Plan', req: true }, desc, slot,
      { k: 'timeline', t: 'textarea', label: 'Event Timeline', req: true }],
    attachments: ['GUC Clinic approval (if food is served)'],
    services: ['it', 'furnitureCeremony', 'printing', 'technical', 'logisticsCeremony'], signatures: EVENT_SIGS },
  { key: 'recruitment', name: 'Recruitment Approval', cat: 'Events', blurb: 'Recruiting new members.',
    rules: [...EVENT_RULES, 'No more than two booths for recruitment.'],
    fields: [...eventHead('booth'), marketingPlan,
      { k: 'boardTraining', t: 'textarea', label: 'Board Training', ph: 'Trainings given to your board', req: true }, desc,
      { k: 'location', t: 'radio', label: 'Event Location', opts: ['On Campus', 'Online'], req: true },
      { k: 'recruitmentPlan', t: 'textarea', label: 'Recruitment Plan', ph: 'Interviewees, members needed, marketing tools', req: true }],
    services: ['furnitureBooth', 'marketing', 'printing', 'technicalBooth', 'logistics'], signatures: EVENT_SIGS },
  { key: 'booth', name: 'Marketing Booth Approval', cat: 'Events', blurb: 'A booth to promote the club or an event.',
    rules: [...EVENT_RULES, 'No more than two booths.'],
    fields: [...eventHead('booth'), marketingPlan, { k: 'boothManager', t: 'text', label: 'Booth Manager', req: true }, desc, slot,
      { k: 'activities', t: 'textarea', label: 'Event Activities', ph: 'The booth activities', req: true }],
    services: ['furnitureBooth', 'marketing', 'printing', 'technicalBooth', 'logistics'], signatures: EVENT_SIGS },
  { key: 'sponsorAgreement', name: 'Sponsorship Agreement', cat: 'Sponsorship', blurb: 'All sponsors except food & drinks.',
    rules: ['Submit at least 10 working days before the sponsor launches, with the printed ON SPOT design.', 'Electricity: max 6 kW in total and 1.5 kW per device.', 'Fees are paid by the sponsor to the GUC Cashier in B4 only.', SPONSOR_BANNED],
    fields: sponsorFields, attachments: ['Commercial registration', 'Tax ID', 'ON SPOT mail design', 'SCAD approval (if academic content)'],
    services: ['agreed', 'marketing', 'sponsorTech', 'materials', 'logSponsor'], signatures: EVENT_SIGS },
  { key: 'fnbAgreement', name: 'Food & Beverages Sponsorship Agreement', cat: 'Sponsorship', blurb: 'Food & drink sponsors.',
    rules: ['Submit at least 10 working days before the sponsor launches.', 'The GUC Clinic approves the products first.', 'Max 6 kW total, 1.5 kW per device.', 'Fixed fees only - no profit-sharing.', SPONSOR_BANNED],
    fields: sponsorFields, attachments: ['Commercial registration', 'Tax ID', 'ON SPOT mail design'],
    services: ['agreed', 'marketing', 'sponsorTech', 'materials', 'logFnb'], signatures: ['GUC Clinic', ...EVENT_SIGS] },
  { key: 'expense', name: 'Expense Approval', cat: 'Finance', blurb: 'Spending money from the club account. Comes with a memo.', memo: true,
    rules: ['Comes with a memo, printed as page 2.', 'Attach if you have them: stamped tax invoice, tax card, tax registration, commercial register.', 'Loans must be settled with all documents within one month.'],
    fields: [
      { k: 'requestedDate', t: 'date', label: 'Requested Date', req: true, half: true },
      { k: 'requestedBy', t: 'text', label: 'Requested by', req: true, half: true },
      { k: 'academicAdvisor', t: 'text', label: 'Academic Advisor', half: true },
      { k: 'amount', t: 'number', label: 'Request Amount (EGP)', req: true, half: true, money: true },
      { k: 'justification', t: 'textarea', label: 'Justification', req: true },
      { t: 'heading', label: 'Memo' },
      { k: 'memoTo', t: 'text', label: 'To', half: true },
      { k: 'memoSubject', t: 'text', label: 'Subject', req: true, half: true, ph: 'e.g. Printing banners for the Main Event' },
      { k: 'memoBody', t: 'textarea', label: 'Memo text', req: true },
    ],
    signatures: ['Requested by', 'Academic Advisor', 'Youth Welfare Director', 'GUC Vice President'] },
];

export const SAO_CLUB = 'TEDxGUC';
export const SAO_ADVISOR = 'Dr. Manar Mansour';
export const SAO_OFFICE = 'Student Activities Office';
