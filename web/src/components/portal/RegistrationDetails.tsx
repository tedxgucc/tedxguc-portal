import type { RegistrationRow } from '@/lib/types';

export function RegistrationDetails({ registration: r }: { registration: RegistrationRow }) {
  if (!r.answers?.guest_category) return null;
  const a = r.answers;
  const details = [
    ['GUCian', a.gucian],
    [a.gucian === 'Yes' ? 'GUC ID' : 'National ID', a.gucian === 'Yes' ? a.guc_id : a.national_id],
    ['Phone', r.guest_phone],
    ['Guest category', a.guest_category],
    ['Heard about us', a.referral_source === 'Other' ? `Other: ${a.referral_other}` : a.referral_source],
  ];
  return <details className="mt-s2 text-body-sm font-normal">
    <summary className="cursor-pointer tx-link">Registration details</summary>
    <dl className="grid gap-s2 mt-s2">
      {details.map(([label, value]) => <div key={label}><dt className="text-caption text-ink-3">{label}</dt><dd className="m-0 break-words">{value || '—'}</dd></div>)}
    </dl>
  </details>;
}
