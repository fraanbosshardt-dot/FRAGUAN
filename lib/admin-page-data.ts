import { headers } from 'next/headers';
import { GET } from '@/app/api/[resource]/route';
import { argentinaDay } from './business-date';

// Use the same read handlers and permissions as the interactive panel. No
// separate crawler view, extra privileges, or second copy of the SQL queries.
export async function adminPageData(section: string) {
  const incoming = await headers();
  async function read(resource: string) {
    const response = await GET(
      new Request(`http://admin.internal/api/${resource}`, {
        headers: { cookie: incoming.get('cookie') ?? '' },
      }),
      { params: Promise.resolve({ resource: resource.split('?')[0] }) },
    );
    const data = (await response.json()) as Record<string, any>;
    if (!response.ok)
      throw new Error(data.error || 'No se pudieron cargar los datos.');
    return data;
  }
  const today = argentinaDay();
  const resource =
    section === 'reports'
      ? `reports?from=${today.slice(0, 7)}-01&to=${today}`
      : ['products', 'suppliers'].includes(section)
        ? `${section}?includeArchived=1`
        : section;
  const session = await read('session');
  try {
    const [data, plans] = await Promise.all([
      read(resource),
      section === 'financial-calendar' ? read('financial-plans') : null,
    ]);
    return { session, data, plans, error: '' };
  } catch (error) {
    return {
      session,
      data: null,
      plans: null,
      error:
        error instanceof Error
          ? error.message
          : 'No se pudieron cargar los datos.',
    };
  }
}
