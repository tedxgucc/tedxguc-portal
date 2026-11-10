export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
export const SITE_DESCRIPTION = 'TEDxGUC is the student-run TEDx team at the German University in Cairo. Free talks and salons since 2013.';
export const PUBLIC_ROUTES = ['/', '/events', '/speakers', '/calendar', '/about', '/board', '/join', '/contact', '/privacy'];
export function siteUrl(path = '/') { return SITE_URL ? SITE_URL + (path === '/' ? '/' : path.replace(/\/$/, '') + '/') : ''; }
