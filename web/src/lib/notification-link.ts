// Translate database notification routes to the static portal pages.
export function notificationPage(link: string): string {
  if (!link.startsWith('/portal/') || link.includes('\\')) return '/portal/notifications';
  const [, , area, id] = link.split('/');
  switch (area) {
    case 'announcements': return '/portal/news';
    case 'meetings': return id ? `/portal/meetings/view?id=${encodeURIComponent(id)}` : '/portal/meetings';
    case 'attendance': return '/portal/meetings';
    case 'expenses': return '/portal/finance';
    case 'orders': return '/portal/packages';
    case 'recruitment': return '/portal/recruitment';
    case 'tasks': return '/portal/tasks';
    case 'events': return id && id !== 'view' ? `/portal/events/view?id=${encodeURIComponent(id)}` : link;
    default: return link;
  }
}
