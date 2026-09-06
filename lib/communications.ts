import { Actor, requirePermission } from './auth';
import { rows } from '@/db/queries';
export async function communicationSuggestions(a: Actor) {
  requirePermission(a, 'communications');
  requirePermission(a, 'customer-intelligence');
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());
  const cutoff = new Date(
    Date.parse(`${today}T12:00:00Z`) - 90 * 86400000,
  ).toISOString();
  const birthdays = await rows<{
    id: string;
    name: string;
    surname: string;
    phone: string;
  }>(
    "SELECT id,name,surname,COALESCE(NULLIF(whatsapp,''),phone) AS phone FROM customers WHERE active=1 AND substr(birthday,6,5)=? ORDER BY name,surname",
    today.slice(5),
  );
  const inactive = await rows<{
    id: string;
    name: string;
    surname: string;
    phone: string;
    lastPurchase: string;
  }>(
    "SELECT c.id,c.name,c.surname,COALESCE(NULLIF(c.whatsapp,''),c.phone) AS phone,MAX(s.createdAt) AS lastPurchase FROM customers c JOIN sales s ON s.customerId=c.id AND s.status IN ('confirmed','partially_refunded') WHERE c.active=1 GROUP BY c.id HAVING MAX(s.createdAt)<? ORDER BY lastPurchase LIMIT 100",
    cutoff,
  );
  return {
    today,
    drafts: [
      ...birthdays.map((c) => ({
        id: `birthday:${c.id}:${today}`,
        customer: `${c.name} ${c.surname}`,
        phone: c.phone,
        kind: 'Cumpleaños',
        message: `¡Feliz cumpleaños, ${c.name}! Te deseamos un gran día desde FRAGUAN. Consultanos por los beneficios de cumpleaños disponibles para vos.`,
      })),
      ...inactive.map((c) => ({
        id: `reactivation:${c.id}:${today}`,
        customer: `${c.name} ${c.surname}`,
        phone: c.phone,
        kind: 'Reactivación',
        message: `Hola ${c.name}, ¿cómo estás? Te saludamos desde FRAGUAN. Cuando quieras, podemos ayudarte a encontrar prendas y talles para vos.`,
      })),
    ],
  };
}
