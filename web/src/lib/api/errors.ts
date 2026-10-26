import { ApiError } from './types';

// Database error codes → microcopy in the design system's voice
// (short, no exclamation marks, says how to fix it).
const messages: Record<string, string> = {
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
  only_creator_or_executive_marks_done: 'Only your executive can mark this done. Move it to review instead.',
  only_managers_edit_task_details: 'Only your executive can change the task details.',
  only_receiving_team_accepts_requests: 'The other team accepts or declines this request.',
  assignee_not_in_team: 'Pick people from the task’s team.',
  team_not_in_active_season: 'That team is from another season.',
  network: "That didn't send. Check your connection and try again.",
};

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const raw = (err as { message?: string; code?: string })?.message ?? '';
  const code = raw.startsWith('missing_field') ? 'missing_field'
    : raw.includes('row-level security') || (err as { code?: string })?.code === '42501' ? 'not_allowed'
    : raw.includes('Failed to fetch') || raw.includes('NetworkError') ? 'network'
    : raw;
  return new ApiError(code || 'unknown', messages[code] ?? (raw || 'Something went wrong. Try again.'));
}

export function friendly(code: string, fallback?: string): string {
  return messages[code] ?? fallback ?? 'Something went wrong. Try again.';
}
