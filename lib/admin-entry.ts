export function adminReturnTo(requested = '/admin') {
  if (requested === '/admin' || requested === '/admin/dashboard')
    return '/admin';
  return /^\/admin\/[a-z0-9-]+$/.test(requested) ? requested : '/admin';
}

export function adminEntryPath(requested = '/admin') {
  const target = adminReturnTo(requested);
  return target === '/admin'
    ? '/admin'
    : `/admin?returnTo=${encodeURIComponent(target)}`;
}
