import { one } from '@/db/queries';
import type { Actor } from './auth';

export async function businessOwnerEmails(): Promise<string[]> {
  const owners = await one<{ value: string }>(
    'SELECT value FROM settings WHERE key=?',
    'owners',
  );
  if (owners) {
    const value: unknown = JSON.parse(owners.value);
    if (
      !Array.isArray(value) ||
      !value.length ||
      !value.every((email) => typeof email === 'string')
    )
      throw new Error('La configuración de dueños debe revisarse.');
    return value.map((email) => email.trim().toLowerCase());
  }
  const owner = await one<{ value: string }>(
    'SELECT value FROM settings WHERE key=?',
    'owner',
  );
  return owner ? [owner.value.trim().toLowerCase()] : [];
}

export async function isBusinessOwner(actor: Actor) {
  return (
    actor.role === 'ADMIN' &&
    actor.active === 1 &&
    (await businessOwnerEmails()).includes(actor.email.toLowerCase())
  );
}
