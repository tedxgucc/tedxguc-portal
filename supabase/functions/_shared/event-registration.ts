// Main Event Registration PDF, with the ID-front photo question omitted.
// Shared by the public form, demo API and server function.
export const GUEST_CATEGORIES = ['Attendee', "Speaker's Family", 'Ex-Board', 'Board Member Family', 'Sponsor'] as const;
export const REFERRAL_SOURCES = ['University', 'TEDxGUC Instagram', "Speaker's Platforms", 'Other'] as const;

export function ticketTier(guestType?: string | null): 'Regular' | 'VIP' {
  return !guestType || guestType === 'attendee' ? 'Regular' : 'VIP';
}

export function guestTypeFor(category: string): 'attendee' | 'vip' {
  return category === 'Attendee' ? 'attendee' : 'vip';
}

type RegistrationData = { name?: unknown; email?: unknown; phone?: unknown; answers?: unknown };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function registrationErrors(input: RegistrationData): Record<string, string> {
  const errors: Record<string, string> = {};
  const answers = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers) ? input.answers as Record<string, unknown> : {};
  if (!text(input.name) || text(input.name).length > 120) errors.name = 'Enter your full name (up to 120 characters).';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text(input.email)) || text(input.email).length > 254) errors.email = 'Enter a valid personal email address.';
  const phone = text(input.phone);
  if (!/^[+\d\s().-]+$/.test(phone) || !/^\d{7,15}$/.test(phone.replace(/\D/g, '')) || phone.length > 30) errors.phone = 'Enter a valid phone number.';
  if (!['Yes', 'No'].includes(text(answers.gucian))) errors.gucian = 'Choose whether you are a GUCian.';
  if (text(answers.gucian) === 'Yes' && (!text(answers.guc_id) || text(answers.guc_id).length > 50)) errors.guc_id = 'Enter your GUC ID (up to 50 characters).';
  if (text(answers.gucian) === 'No' && (!text(answers.national_id) || text(answers.national_id).length > 50)) errors.national_id = 'Enter your national ID number (up to 50 characters).';
  if (!(GUEST_CATEGORIES as readonly string[]).includes(text(answers.guest_category))) errors.guest_category = 'Choose your guest type.';
  if (!(REFERRAL_SOURCES as readonly string[]).includes(text(answers.referral_source))) errors.referral_source = 'Choose how you heard about TEDxGUC.';
  if (text(answers.referral_source) === 'Other' && (!text(answers.referral_other) || text(answers.referral_other).length > 500)) errors.referral_other = 'Tell us how you heard about TEDxGUC (up to 500 characters).';
  if (Object.keys(answers).length > 100 || Object.values(answers).some((v) => typeof v !== 'string' || v.length > 4000)) errors.answers = 'Some form answers are too long or invalid.';
  return errors;
}

export function cleanRegistrationAnswers(answers: Record<string, string>): Record<string, string> {
  const clean = Object.fromEntries(Object.entries(answers).map(([key, value]) => [key, value.trim()]));
  // Do not retain values from a branch the guest changed away from.
  if (clean.gucian !== 'Yes') delete clean.guc_id;
  if (clean.gucian !== 'No') delete clean.national_id;
  if (clean.referral_source !== 'Other') delete clean.referral_other;
  return clean;
}
