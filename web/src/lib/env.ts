// Without Supabase settings the app runs in demo mode: sample data, a role
// picker instead of login, and nothing is saved beyond this browser tab.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;

export const LICENSE_LINE = 'This independent TEDx event is operated under license from TED.';
export const INSTAGRAM_URL = 'https://www.instagram.com/tedxguc__/';
export const ALLOWED_DOMAINS = ['student.guc.edu.eg', 'guc.edu.eg'];
