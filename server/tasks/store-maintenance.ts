import { defineTask } from 'nitro/task';
import { runOrderEmailQueue } from '../../lib/order-email-outbox';
import { runPriceCampaigns } from '../../lib/store-price-campaigns';
export default defineTask({
  meta: {
    name: 'store-maintenance',
    description: 'Emails de pedidos y precios de campañas temporales',
  },
  async run() {
    const results = await Promise.allSettled([
      runOrderEmailQueue(),
      runPriceCampaigns(),
    ]);
    return {
      result: results.map((r) =>
        r.status === 'fulfilled'
          ? r.value
          : { error: 'Revisar mantenimiento de tienda.' },
      ),
    };
  },
});
