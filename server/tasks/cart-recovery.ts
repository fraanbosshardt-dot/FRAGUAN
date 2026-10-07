import { defineTask } from 'nitro/task';
import { runCartRecovery } from '../../lib/cart-recovery';

export default defineTask({
  meta: {
    name: 'cart-recovery',
    description: 'Recordatorios de carrito con consentimiento verificado',
  },
  async run() {
    const result = await runCartRecovery();
    return { result };
  },
});
