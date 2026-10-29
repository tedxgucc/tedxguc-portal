import type {
  Announcement, AudienceType, BoardMember, CalendarItem, CalendarVisibility, CheckInResult, Division, EventField,
  EventStats, Invite, ManifestRow, Me, Member, Notification, Partner, RegisterResult, RegistrationRow, Role,
  SearchRow, Section, Speaker, Task, TaskComment, TaskPriority, TaskStatus, Team, TicketView, TxEvent,
} from '../types';

// Errors carry a short code from the database (e.g. "already_registered")
// and a sentence people can read.
export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export type RegisterInput = {
  event_id: string;
  name: string;
  email: string;
  phone?: string;
  answers: Record<string, string>;
  consent: boolean;
  turnstile_token?: string;
};

export type InquiryInput = {
  kind: 'partner' | 'contact';
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  consent: boolean;
  turnstile_token?: string;
};

export type NewTask = {
  team_id: string;
  title: string;
  description?: string;
  deadline?: string | null;
  priority: TaskPriority;
  assignees: string[];
  requested_by_team_id?: string | null;
};

export type TaskPatch = Partial<Pick<Task, 'title' | 'description' | 'deadline' | 'priority' | 'status' | 'decline_reason'>>;

export type NewCalendarEntry = {
  visibility: CalendarVisibility;
  team_id: string | null;
  title: string;
  description?: string;
  starts_at: string;
  ends_at?: string | null;
  all_day?: boolean;
  location?: string;
  online_url?: string;
};

export type NewAnnouncement = {
  publish_at?: string;
  expires_at?: string | null;
  audience_type: AudienceType;
  division_id?: string | null;
  team_id?: string | null;
  audience_role?: Role | null;
  title: string;
  body: string;
  pinned?: boolean;
  needs_confirmation?: boolean;
  image_url?: string | null;
};

export type EventInput = Omit<TxEvent, 'id'> & { id?: string };

export type OfflineScan = { ticket_code: string; scanned_at: string; device_id: string };

export interface Api {
  // ----- Public site -----
  listEvents(scope: 'upcoming' | 'past' | 'all'): Promise<TxEvent[]>;
  getEventBySlug(slug: string): Promise<TxEvent | null>;
  getEventFields(eventId: string): Promise<EventField[]>;
  listSpeakers(eventId?: string): Promise<Speaker[]>;
  listPartners(): Promise<Partner[]>;
  getSections(keys: string[]): Promise<Record<string, Section>>;
  getBoard(): Promise<BoardMember[]>;
  publicCalendar(from: string, to: string): Promise<CalendarItem[]>;
  register(input: RegisterInput): Promise<RegisterResult>;
  getTicket(token: string): Promise<TicketView | null>;
  cancelTicket(token: string): Promise<void>;
  resendTicket(eventId: string, email: string, turnstileToken?: string): Promise<void>;
  sendInquiry(input: InquiryInput): Promise<void>;

  // ----- Accounts -----
  getMe(): Promise<Me | null>;
  signInWithGoogle(): Promise<void>;
  /** Invited people set their own password the first time. Returns false if Supabase still wants an email confirmation. */
  signUpWithEmail(email: string, password: string): Promise<boolean>;
  signInWithEmail(email: string, password: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(everywhere?: boolean): Promise<void>;
  updateProfile(patch: { name?: string; major?: string | null; semester?: number | null; phone?: string | null; photo_url?: string | null }): Promise<void>;
  /** Upload my profile photo; returns its address. */
  uploadAvatar(file: File): Promise<string>;
  /** Change my password while logged in (no email needed). */
  changePassword(password: string): Promise<void>;
  rotateCalendarToken(): Promise<string>;

  // ----- Structure -----
  listDivisions(): Promise<Division[]>;
  listTeams(): Promise<Team[]>;
  listMembers(): Promise<Member[]>;
  addTeamMember(teamId: string, userId: string): Promise<void>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  listInvites(): Promise<Invite[]>;
  createInvite(input: { email: string; role: Role; team_id?: string | null; division_id?: string | null }): Promise<void>;
  revokeInvite(id: string): Promise<void>;

  // ----- Tasks -----
  listTasks(): Promise<Task[]>;
  createTask(input: NewTask): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  setAssignees(taskId: string, userIds: string[]): Promise<void>;
  listComments(taskId: string): Promise<TaskComment[]>;
  addComment(taskId: string, body: string, mentions: string[]): Promise<void>;

  // ----- Calendar & news -----
  calendarFeed(from: string, to: string, teamId?: string | null): Promise<CalendarItem[]>;
  createCalendarEntry(input: NewCalendarEntry): Promise<void>;
  deleteCalendarEntry(id: string): Promise<void>;
  listAnnouncements(): Promise<Announcement[]>;
  postAnnouncement(input: NewAnnouncement): Promise<void>;
  updateAnnouncement(id: string, patch: Pick<NewAnnouncement, 'title' | 'body' | 'pinned' | 'needs_confirmation' | 'image_url' | 'publish_at' | 'expires_at'>): Promise<void>;
  deleteAnnouncement(id: string): Promise<void>;
  announcementConfirmations(id: string): Promise<{ user_id: string; name: string; read_at: string | null }[]>;
  confirmRead(id: string): Promise<void>;
  listNotifications(): Promise<Notification[]>;
  markNotificationsRead(): Promise<void>;

  // ----- Events admin & door -----
  listAllEvents(): Promise<TxEvent[]>;
  saveEvent(input: EventInput): Promise<TxEvent>;
  listRegistrations(eventId: string): Promise<RegistrationRow[]>;
  eventStats(eventId: string): Promise<EventStats>;
  checkIn(eventId: string, code: string, deviceId: string): Promise<CheckInResult>;
  checkInById(registrationId: string, deviceId: string): Promise<CheckInResult>;
  searchRegistrations(eventId: string, q: string): Promise<SearchRow[]>;
  getManifest(eventId: string): Promise<ManifestRow[]>;
  syncOffline(eventId: string, scans: OfflineScan[]): Promise<CheckInResult[]>;
}
