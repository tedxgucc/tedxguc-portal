import type { Announcement } from './types';
export function announcementLive(a: Announcement, now = Date.now()) {
  return (!a.publish_at || Date.parse(a.publish_at) <= now) && (!a.expires_at || Date.parse(a.expires_at) > now);
}
