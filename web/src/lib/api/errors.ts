import { ApiError } from './types';

// Database error codes → microcopy in the design system's voice
// (short, no exclamation marks, says how to fix it).
const messages: Record<string, string> = {
  void_the_bank_out: 'This cash came from a bank out. Void that bank out instead: both sides go together.',
  withdrawal_locked: 'A bank-to-cash withdrawal can’t be edited. Void it and record it again.',
  cannot_reset_yourself: 'Change your own password from your profile.',
  no_invite: 'This member has no active invite, so they can’t set a new password from the login page. Invite them again first.',
  orientation_not_found: 'We could not find that orientation day.',
  orientation_over: 'That orientation day has already passed.',
  invalid_guc_id: 'Enter your GUC ID, like 58-12345.',
  not_gucian: 'Orientation is for GUC students. Use your GUC student email (…@student.guc.edu.eg).',
  invalid_orientation_teams: 'Pick one to three teams.',
  already_signed_up: 'This GUC ID or email is already signed up for orientation.',
  orientation_full: 'That day is full. Pick the other day.',
  round_has_records: 'This round has applications or board plans and cannot be deleted. Close the round by editing its closing date instead.',
  event_not_open: 'Registration for this event is closed.',
  already_registered: 'This email already has a ticket. Use "Lost your ticket?" to get it again.',
  invalid_email: 'Enter a valid email address.',
  invalid_name: 'Enter your name.',
  missing_field: 'Answer the required questions.',
  consent_required: 'Tick the privacy box to continue.',
  captcha_required: 'Complete the security check.',
  captcha_failed: 'The security check failed. Try again.',
  too_many_requests: 'Too many tries. Wait a few minutes and try again.',
  not_found: "We couldn't find that.",
  already_cancelled: 'This ticket was already cancelled.',
  already_checked_in: 'This ticket was already used at the door.',
  not_allowed: "This one's for the board. Ask your curator if you need access.",
  already_in_team: 'This member already belongs to that team.',
  not_in_team: 'This member no longer belongs to that team. Refresh the roster.',
  interview_time_conflict: 'An interview already overlaps these hours. Adjust the time range; existing bookings are kept.',
  invalid_interview_time: 'Choose a future interview time with an end after its start.',
  invalid_availability: 'Check your availability settings and try again.',
  team_full: 'That team is full for this round. Pick another team as your first choice; you can still keep it as your second preference.',
  already_applied: 'This email or phone number has already been used in this recruitment round.',
  interview_not_completed: 'Wait until the scheduled interview has finished before making this decision.',
  already_referred: 'This applicant has already been referred to that team.',
  existing_invite_conflict: 'This applicant already has a portal invite for a different role or team. Ask the Chairman to review it.',
  referral_notes_too_long: 'Keep referral notes under 2,000 characters.',
  only_creator_or_executive_marks_done: 'Only your executive can mark this done. Move it to review instead.',
  only_managers_edit_task_details: 'Only your executive can change the task details.',
  only_receiving_team_accepts_requests: 'The other team accepts or declines this request.',
  assignee_not_allowed: 'Choose an eligible person for your role and the selected team.',
  assignee_not_in_team: 'Pick people from the task’s team.',
  team_not_in_active_season: 'That team is from another season.',
  network: "That didn't send. Check your connection and try again.",
};

// Database check rules (by constraint name) in plain words.
const checks: Record<string, string> = {
  events_check: 'The end time is before the start time. Check the dates: an event that runs past midnight ends on the next day.',
  events_check1: 'Registration must close after it opens.',
  events_check2: 'Main Events and Salons need a TEDx license before they can be public.',
  events_capacity_check: 'Capacity must be more than 0, or empty for no limit.',
  events_slug_check: 'The web address can only use lowercase letters, numbers and dashes.',
  events_ticket_prefix_check: 'The ticket prefix can only use capital letters and numbers (up to 10).',
};

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const raw = (err as { message?: string; code?: string })?.message ?? '';
  const constraint = raw.match(/violates check constraint "([^"]+)"/)?.[1];
  if (constraint) return new ApiError('invalid_value', checks[constraint] ?? 'One of the values is not allowed. Check the dates and numbers and try again.');
  const code = raw.startsWith('missing_field') ? 'missing_field'
    : raw.includes('row-level security') || (err as { code?: string })?.code === '42501' ? 'not_allowed'
    : raw.includes('Failed to fetch') || raw.includes('NetworkError') ? 'network'
    : raw;
  return new ApiError(code || 'unknown', messages[code] ?? (raw || 'Something went wrong. Try again.'));
}

export function friendly(code: string, fallback?: string): string {
  return messages[code] ?? fallback ?? 'Something went wrong. Try again.';
}
