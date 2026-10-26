// Fixed fields on every application (stored in answers).
export const GUC_MAJORS = [
  'Engineering (MET)', 'Engineering (IET)', 'Engineering (Mechatronics)', 'Engineering (Civil)', 'Engineering (Architecture)',
  'Engineering (Materials)', 'Engineering (Design and Production)', 'Business Informatics', 'Management Technology',
  'Pharmacy and Biotechnology', 'Applied Arts and Sciences', 'Law and Legal Studies', 'Dentistry', 'Other',
];
export const FIXED_ANSWER_KEYS = ['guc_id', 'major'];

// Match the database's identity key: Egyptian local/mobile country-code
// variants and ordinary punctuation all identify the same phone number.
export function applicationPhoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^0-9]/g, '').replace(/^00/, '');
  if (/^201[0125][0-9]{8}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^1[0125][0-9]{8}$/.test(digits)) return `0${digits}`;
  return digits || null;
}
