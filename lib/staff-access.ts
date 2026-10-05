import { one } from '@/db/queries';

// Temporary public staff access, explicitly requested by the owner.
// Customer account authentication remains independent.
export function isOpenStaffAccess() {
  return (
    process.env.FRAGUAN_SURFACE === 'business' &&
    process.env.FRAGUAN_STAFF_OPEN_ACCESS === 'true'
  );
}

export async function openStaffIdentity() {
  if (!isOpenStaffAccess()) return null;
  const owner = await one<{ value: string }>(
    'SELECT value FROM settings WHERE key=?',
    'owner',
  );
  if (!owner) return null;
  const user = await one<{
    id: string;
    email: string;
    name: string;
    active: number;
  }>(
    'SELECT id,email,name,active FROM users WHERE email=?',
    owner.value.trim().toLowerCase(),
  );
  if (!user?.active) return null;
  return {
    userId: user.id,
    email: user.email,
    displayName: user.name,
    fullName: user.name,
  };
}
