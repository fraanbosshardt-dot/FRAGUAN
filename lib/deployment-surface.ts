// The public store deployment shares business logic with the local workspace,
// but does not serve staff pages or staff API endpoints.
export function isStoreOnlyDeployment() {
  return process.env.FRAGUAN_SURFACE === 'store';
}

export function isStaffPath(pathname: string) {
  let path: string;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  const firstSegment = path.split('/')[1];
  if (
    ['pos', 'admin', 'admin-access', 'acceso', 'signin-with-chatgpt',
      'signout-with-chatgpt', 'callback'].includes(firstSegment)
  ) return true;
  if (firstSegment === 'api') {
    const resource = path.split('/')[2] ?? '';
    return !resource.startsWith('store-') && resource !== 'webhooks';
  }
  return false;
}
