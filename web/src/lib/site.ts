export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
export const SITE_DESCRIPTION = 'Ideas worth spreading at the German University in Cairo. Discover TEDxGUC events, speakers and the people behind them.';
export const PUBLIC_ROUTES = ['/', '/events', '/speakers', '/calendar', '/about', '/board', '/join', '/contact', '/privacy'];
export function siteUrl(path = '/') { return SITE_URL ? SITE_URL + (path === '/' ? '/' : path.replace(/\/$/, '') + '/') : ''; }
