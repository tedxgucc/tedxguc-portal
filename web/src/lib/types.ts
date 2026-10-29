// Shapes of the data the screens use. They mirror the database tables in
// supabase/migrations (Phase 1).

export type Role = 'chairman' | 'curator' | 'executive' | 'associate';
export type DivisionKind = 'talks' | 'operations' | 'org_development' | 'marketing' | 'other';
export type TeamKind =
  | 'coaching' | 'research_production' | 'logistics_planning' | 'partnerships'
  | 'associates_experience' | 'associates_development' | 'campaigns_copyrights' | 'media_design' | 'other';

export type Division = { id: string; name: string; kind: DivisionKind };
export type Team = { id: string; name: string; kind: TeamKind; division_id: string };

export type Me = {
  id: string;
  name: string;
  email: string;
  photo_url: string | null;
  role: Role | null; // null = alumni / no role this season
  team_id: string | null;
  team_ids?: string[];
  team_name: string | null;
  team_kind: TeamKind | null;
  division_id: string | null;
  division_name: string | null;
  division_kind: DivisionKind | null;
};

export type Member = {
  user_id: string;
  name: string;
  photo_url: string | null;
  role: Role;
  team_id: string | null;
  team_ids?: string[];
  team: string | null;
  division_id: string | null;
  division: string | null;
  division_kind: DivisionKind | null;
};

export type EventType = 'main_event' | 'salon' | 'workshop' | 'other';
export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled';
export type LicenseStatus = 'pending' | 'licensed' | 'not_required';

export type AgendaItem = { time: string; title: string; speaker?: string };

export type TxEvent = {
  id: string;
  type: EventType;
  title: string;
  slug: string | null;
  description: string | null;
  agenda: AgendaItem[];
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  capacity: number | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  license_status: LicenseStatus;
  is_public: boolean;
  status: EventStatus;
  ticket_prefix: string;
  /** Cover photo shown on the site and in the portal. */
  cover_url?: string | null;
};

export type EventField = {
  id: string;
  event_id: string;
  position: number;
  label: string;
  kind: 'text' | 'textarea' | 'select' | 'checkbox' | 'number';
  required: boolean;
  options: string[];
};

export type Speaker = {
  id: string;
  event_id: string | null;
  name: string;
  bio: string | null;
  photo_url: string | null;
  talk_title: string | null;
  talk_url: string | null;
};

export type Partner = { id: string; company: string; tier: string | null; logo_url: string | null; website: string | null };
export type Section = { key: string; title: string; body: { text?: string; items?: { q: string; a: string }[] } };
export type BoardMember = { name: string; photo_url: string | null; role: Role; division: string | null; team: string | null };

export type RegistrationStatus = 'registered' | 'waitlisted' | 'cancelled';
export type RegisterResult = {
  status: RegistrationStatus;
  ticket_no: string | null;
  waitlist_position: number | null;
  status_token: string;
};
export type TicketView = {
  registration_id: string;
  status: RegistrationStatus;
  guest_name: string;
  guest_type: string;
  ticket_no: string | null;
  ticket_code: string | null;
  checked_in_at: string | null;
  waitlist_position: number | null;
  event: { id: string; title: string; starts_at: string; ends_at: string | null; venue: string | null };
};

export type TaskStatus = 'requested' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'declined';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type Task = {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  created_by: string;
  deadline: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  requested_by_team_id: string | null;
  decline_reason: string | null;
  completed_at: string | null;
  created_at: string;
  assignees: string[];
};
export type TaskComment = { id: string; task_id: string; user_id: string; body: string; created_at: string };

export type CalendarVisibility = 'club' | 'team' | 'public';
export type CalendarItem = {
  source: 'entry' | 'event' | 'task_deadline' | 'meeting';
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  online_url: string | null;
  team_id: string | null;
  visibility: CalendarVisibility;
  linked_type: string | null;
  linked_id: string | null;
};

export type AudienceType = 'all' | 'division' | 'team' | 'role';
export type Announcement = {
  publish_at?: string;
  expires_at?: string | null;
  id: string;
  author_id: string;
  audience_type: AudienceType;
  division_id: string | null;
  team_id: string | null;
  audience_role: Role | null;
  title: string;
  body: string;
  pinned: boolean;
  needs_confirmation: boolean;
  created_at: string;
  read_by_me: boolean;
  /** Photo for the announcement billboard. */
  image_url?: string | null;
};

export type Notification = { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };

export type CheckInResultKind = 'ok' | 'already_checked_in' | 'not_found' | 'cancelled' | 'waitlisted';
export type CheckInResult = {
  result: CheckInResultKind;
  registration_id: string | null;
  guest_name: string | null;
  guest_type: string | null;
  ticket_no: string | null;
  checked_in_at: string | null;
  index?: number;
};
export type ManifestRow = { registration_id: string; ticket_code_hash: string; guest_name: string; ticket_no: string; guest_type: string; checked_in_at: string | null };
export type EventStats = { capacity: number | null; registered: number; waitlisted: number; cancelled: number; checked_in: number };
export type RegistrationRow = { id: string; guest_name: string; guest_email: string; guest_phone: string | null; guest_type: string; answers: Record<string, string>; status: RegistrationStatus; ticket_no: string | null; checked_in_at: string | null; created_at: string };
export type SearchRow = { registration_id: string; guest_name: string; email_hint: string; ticket_no: string | null; guest_type: string; status: RegistrationStatus; checked_in_at: string | null };

export type Invite = { id: string; email: string; role: Role; team_id: string | null; division_id: string | null; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string };

// ----- Meetings & attendance (Phase 2, FR-7) -----
export type MeetingType = 'team_meeting' | 'board_meeting' | 'workshop' | 'general_assembly' | 'event' | 'session';
export type AttendanceStatus = 'attended' | 'absent' | 'late' | 'excused';
export type Meeting = {
  id: string;
  type: MeetingType;
  title: string;
  team_id: string | null;
  division_id: string | null;
  starts_at: string;
  ends_at: string | null;
  slot: string | null;
  location: string | null;
  online_url: string | null;
  agenda: string | null;
  minutes: string | null;
  created_by: string | null;
};
export type RollRow = { user_id: string; name: string; photo_url: string | null; team: string | null; status: AttendanceStatus | null; via: string | null; note: string | null; can_edit: boolean };
export type MySession = { n: number; meeting_id: string; title: string; type: MeetingType; starts_at: string; slot: string | null; status: AttendanceStatus; note: string | null };
export type AttendanceSummary = {
  overall_level: number;
  types: { type: MeetingType; attended: number; late: number; absent: number; excused: number; level: number }[];
};
export type Excuse = { id: string; meeting_id: string; user_id: string; note: string; attachment_path: string | null; status: 'pending' | 'accepted' | 'rejected'; created_at: string };
export type RateRow = { user_id: string; name: string; team: string | null; sessions: number; attended: number; late: number; absent: number; excused: number; rate: number | null; level: number };

// ----- Finance (Phase 2, FR-12) -----
export type TxnKind = 'cash_out' | 'bank_deposit' | 'sponsorship' | 'package_sale' | 'refund' | 'opening_balance' | 'bank_out';
export type PayMethod = 'cash' | 'bank' | 'instapay' | 'telda';
export type MoneyAccount = 'cash' | 'bank' | 'telda';
export type Transaction = {
  id: string;
  doc_number: string | null;
  kind: TxnKind;
  direction: 'in' | 'out';
  method: PayMethod;
  account: MoneyAccount;
  amount_gross: number;
  vat_amount: number;
  amount_net: number;
  item: string | null;
  supplier: string | null;
  description: string | null;
  team_id: string | null;
  event_id: string | null;
  expense_request_id: string | null;
  sponsorship_id: string | null;
  occurred_on: string;
  fatora_path: string | null;
  expense_form_path: string | null;
  memo_path: string | null;
  status: 'approved' | 'void';
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
};
export type ExpenseStatus = 'submitted' | 'awaiting_chairman' | 'approved' | 'rejected' | 'purchased' | 'cancelled';
export type ExpenseRequest = {
  id: string;
  team_id: string;
  event_id: string | null;
  requested_by: string;
  item: string;
  amount_egp: number;
  reason: string | null;
  status: ExpenseStatus;
  reject_reason: string | null;
  transaction_id: string | null;
  created_at: string;
};
export type Sponsorship = { id: string; sponsor_name: string; tier: string | null; amount_egp: number; contract_path: string | null; status: 'pending' | 'approved' | 'rejected'; notes: string | null; created_at: string };
export type Balances = { bank: number; telda: number; cash: number; vat_collected: number; cash_outs_missing_fatora: number; pending_sponsorships: number };
export type BudgetStatus = { budget: number | null; spent: number; approved_not_bought: number; pending: number; remaining: number | null };
export type Reconciliation = { month: string; account: MoneyAccount; statement_balance: number; book_balance: number; difference: number };

// ----- Recruitment (Phase 2, FR-4) -----
export type CycleKind = 'associates' | 'board';
export type Cycle = { id: string; name: string; kind: CycleKind; opens_at: string; closes_at: string; rejections_released_at: string | null };
export type Question = { id: string; label: string; kind: 'text' | 'textarea' | 'url'; required: boolean };
export type Position = { id: string; cycle_id: string; team_id: string; seats: number | null; description: string | null; questions: Question[]; is_open: boolean };
export type Stage = 'applied' | 'screened' | 'interview' | 'accepted' | 'rejected' | 'withdrawn';
export type Application = {
  id: string; cycle_id: string; applicant_name: string; applicant_email: string; applicant_phone: string | null;
  team_choices: string[]; answers: Record<string, string>; cv_path: string | null; stage: Stage;
  accepted_team_id: string | null; created_at: string;
  referred_team_ids?: string[];
};
export type ApplicationReferral = { id: string; application_id: string; from_team_id: string; to_team_id: string; referred_by: string; notes: string; status: 'pending' | 'accepted' | 'closed'; created_at: string };
export type ApplicationDecisionContext = { interview_completed: boolean; acceptable_team_ids: string[]; referrals: ApplicationReferral[] };
export type SlotView = { slot_id: string; starts_at: string; ends_at: string; location: string | null; team: string };
export type ApplicationView = {
  application_id: string; applicant_name: string; cycle: string;
  stage: 'received' | 'in_review' | 'interview' | 'accepted' | 'not_selected' | 'withdrawn';
  teams: string[]; interview: SlotView | null; open_slots: SlotView[] | null;
};
export type InterviewSlot = { id: string; cycle_id: string; team_id: string; starts_at: string; ends_at: string; location: string | null; interviewer_ids: string[]; application_id: string | null };
export type InterviewScore = { id: string; application_id: string; interviewer_id: string; score: number; notes: string | null };
export type BoardPlan = {
  id: string; cycle_id: string; user_id: string; target_role: 'executive' | 'curator'; team_id: string | null; division_id: string | null;
  answers: Record<string, string>; status: 'draft' | 'submitted'; submitted_at: string | null; score: number | null; reviewer_notes: string | null;
};

// ----- Files (Phase 2, FR-9) -----
export type FileScope = 'club' | 'division' | 'team' | 'board';
export type LibFile = {
  id: string; scope: FileScope; division_id: string | null; team_id: string | null; folder: string; name: string;
  storage_path: string; mime_type: string | null; size_bytes: number | null; is_handover: boolean; uploaded_by: string; created_at: string;
};
export type HandoverRow = { user_id: string; name: string; role: Role; division: string | null; team: string | null; handover_files: number; last_upload: string | null };

// ----- Packages (Phase 2, FR-16) -----
export type OrderMethod = 'instapay' | 'telda' | 'cash';
export type OrderStatus = 'pending_proof' | 'pending_approval' | 'awaiting_cash' | 'approved' | 'delivered' | 'rejected' | 'expired' | 'cancelled' | 'refunded';
// Google-Forms-style questions for sign-ups (packages, trips, anything).
export type FormQuestionKind = 'short' | 'paragraph' | 'choice' | 'checkboxes' | 'dropdown' | 'number' | 'date' | 'phone';
export type FormQuestion = { id: string; label: string; kind: FormQuestionKind; required: boolean; options: string[] };
export type FormAnswer = string | string[];
export type SignUpKind = 'package' | 'trip' | 'other';
export type Package = {
  kind: SignUpKind; questions: FormQuestion[];
  id: string; name: string; photo_url: string | null; contents: string[]; description: string | null; price_egp: number; stock: number;
  max_per_order: number; opens_at: string | null; closes_at: string | null; is_active: boolean; pickup_info: string | null; allows_delivery: boolean;
  stock_left: number;
};
export type Order = {
  user_id?: string | null; answers?: Record<string, FormAnswer>;
  id: string; order_no: string; package_id: string; buyer_name: string; buyer_email: string; buyer_phone: string; quantity: number;
  total_egp: number; method: OrderMethod; fulfilment: 'pickup' | 'delivery'; delivery_address: string | null; proof_path: string | null;
  payment_reference: string | null; status: OrderStatus; hold_expires_at: string | null; reject_reason: string | null;
  approved_by: string | null; delivered_at: string | null; created_at: string;
};
export type OrderPlaced = { order_no: string; status: OrderStatus; total_egp: number; payment_link: string | null; hold_expires_at: string | null; status_token: string };
export type OrderView = {
  order_no: string; status: OrderStatus; package: string; quantity: number; total_egp: number; method: OrderMethod; hold_expires_at: string | null;
  reject_reason: string | null; fulfilment: string; pickup_info: string | null; pickup_code: string | null; payment_link: string | null;
};
export type SalesRow = { package_id: string; package: string; method: OrderMethod; orders: number; units: number; total_egp: number };
