'use client';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  Landmark,
  PackageCheck,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import {
  storeApi,
  storeMoney,
  useStoreCart,
  storeAttribution,
  storeSessionId,
  trackStore,
} from '@/lib/store-client';

type Order = Record<string, any>;
type CheckoutQuote = {
  subtotal: number;
  transferDiscount: number;
  couponDiscount: number;
  discount: number;
  shipping: { amount: number; name: string; days: string };
  total: number;
  appliedDiscounts: { promotionName: string }[];
};
export default function Checkout() {
  const { cart, subtotal, clear, update } = useStoreCart();
  const [payment, setPayment] = useState<'transfer' | 'card'>('transfer');
  const [shippingMethod, setShippingMethod] = useState<
    'correo-argentino-home' | 'pickup'
  >('correo-argentino-home');
  const [postalCode, setPostalCode] = useState('');
  const [pricing, setPricing] = useState<CheckoutQuote | null>(null);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const idempotency = useRef(crypto.randomUUID());
  const accessToken = useRef(crypto.randomUUID());
  useEffect(() => {
    storeApi('store-account')
      .then(setSession)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (cart.length)
      trackStore('begin_checkout', {
        value: subtotal,
        cart: cart.map(
          ({ id, productName, slug, color, size, price, quantity }) => ({
            variantId: id,
            productName,
            slug,
            color,
            size,
            price,
            quantity,
          }),
        ),
      });
  }, [cart, subtotal]);
  useEffect(() => {
    if (
      !cart.length ||
      (shippingMethod !== 'pickup' &&
        postalCode.replace(/\D/g, '').length !== 4)
    ) {
      setPricing(null);
      setPricingBusy(false);
      return;
    }
    setPricingBusy(true);
    const controller = new AbortController();
    const t = setTimeout(
      () =>
        storeApi<CheckoutQuote>('store-checkout-quote', {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({
            items: cart.map((item) => ({
              variantId: item.id,
              quantity: item.quantity,
            })),
            couponCode: appliedCouponCode,
            paymentMethod: payment,
            shippingMethod,
            postalCode: shippingMethod === 'pickup' ? '1000' : postalCode,
          }),
        })
          .then((result) => {
            setPricing(result);
            setError('');
          })
          .catch((e) => {
            if (controller.signal.aborted) return;
            setPricing(null);
            setError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setPricingBusy(false);
          }),
      250,
    );
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [postalCode, payment, shippingMethod, cart, appliedCouponCode]);
  const shipping = pricing?.shipping ?? null;
  const transferDiscount =
    pricing?.transferDiscount ??
    (payment === 'transfer' ? Math.floor(subtotal * 0.1) : 0);
  const couponDiscount = pricing?.couponDiscount ?? 0;
  const discount = pricing?.discount ?? transferDiscount;
  const total = pricing?.total ?? subtotal - discount;
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const result = await storeApi<Order>('store-checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((item) => ({
            variantId: item.id,
            quantity: item.quantity,
          })),
          email: form.get('email'),
          customerName: form.get('customerName'),
          phone: form.get('phone'),
          document: form.get('document') || '',
          paymentMethod: payment,
          shippingMethod,
          postalCode: shippingMethod === 'pickup' ? '1000' : postalCode,
          address:
            shippingMethod === 'pickup'
              ? 'Retiro en local'
              : form.get('address'),
          addressExtra:
            shippingMethod === 'pickup' ? '' : form.get('addressExtra') || '',
          city: shippingMethod === 'pickup' ? 'Buenos Aires' : form.get('city'),
          province: shippingMethod === 'pickup' ? 'CABA' : form.get('province'),
          notes: form.get('notes') || '',
          idempotencyKey: idempotency.current,
          accessToken: accessToken.current,
          couponCode: appliedCouponCode,
          attribution: storeAttribution(),
          sessionId: storeSessionId(),
          saveAddress: form.get('saveAddress') === 'on',
        }),
      });
      setOrder(result);
      if (payment === 'transfer' || !result.paymentUrl) clear();
      sessionStorage.setItem(`fraguan-order-${result.id}`, result.accessToken);
      if (result.paymentUrl) window.location.assign(result.paymentUrl);
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  async function applyCoupon() {
    setError('');
    setCouponMessage('Validando…');
    try {
      const result = await storeApi<CheckoutQuote>('store-checkout-quote', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((item) => ({
            variantId: item.id,
            quantity: item.quantity,
          })),
          couponCode,
          paymentMethod: payment,
          shippingMethod,
          postalCode: shippingMethod === 'pickup' ? '1000' : postalCode,
        }),
      });
      setAppliedCouponCode(couponCode);
      setPricing(result);
      setCouponMessage(
        result.appliedDiscounts.map((item) => item.promotionName).join(' · ') ||
          'Cupón aplicado',
      );
      trackStore('coupon_applied', {
        value: result.couponDiscount,
        metadata: { couponCode },
      });
    } catch (cause: any) {
      setAppliedCouponCode('');
      setCouponMessage('');
      setError(cause.message);
    }
  }
  async function report(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      setOrder(
        await storeApi('store-transfer', {
          method: 'POST',
          body: JSON.stringify({
            orderId: order!.id,
            accessToken: order!.accessToken,
            transactionId: form.get('transactionId'),
          }),
        }),
      );
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  if (order)
    return (
      <div className="store-shell">
        <StoreHeader />
        <main className="store-order-success">
          <div className="store-success-mark">
            <Check />
          </div>
          <span>PEDIDO #{order.orderNumber}</span>
          <h1>
            {payment === 'transfer'
              ? 'Tu stock está reservado.'
              : 'Pedido creado.'}
          </h1>
          {payment === 'transfer' ? (
            <>
              <p>
                Transferí el importe exacto e incluí esta referencia en el
                concepto. Así el sistema identifica automáticamente tu pedido,
                tus prendas y tu cuenta.
              </p>
              <div className="store-transfer-box">
                <small>TOTAL A TRANSFERIR</small>
                <strong>{storeMoney(order.total)}</strong>
                <small>REFERENCIA ÚNICA</small>
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(order.transferReference)
                  }
                >
                  {order.transferReference}
                  <Copy />
                </button>
                <dl>
                  <div>
                    <dt>Alias</dt>
                    <dd>FRAGUAN.TIENDA</dd>
                  </div>
                  <div>
                    <dt>Titular</dt>
                    <dd>FRAGUAN</dd>
                  </div>
                </dl>
              </div>
              <form onSubmit={report} className="store-report-transfer">
                <label>
                  ¿Ya transferiste?
                  <input
                    name="transactionId"
                    required
                    minLength={4}
                    placeholder="Número de operación bancaria"
                  />
                </label>
                <button disabled={busy}>
                  {busy ? 'Registrando…' : 'Avisar transferencia'}{' '}
                  <ArrowRight />
                </button>
              </form>
            </>
          ) : (
            <div className="store-payment-pending">
              <CreditCard />
              <h2>Pago con tarjeta preparado</h2>
              <p>
                Al conectar la pasarela, este paso abrirá el pago seguro y su
                confirmación llegará automáticamente al pedido.
              </p>
            </div>
          )}
          <div className="store-order-next">
            <p>
              <PackageCheck /> Reservamos tus prendas durante 30 minutos.
            </p>
            <p>
              <Truck /> El pedido aparecerá en preparación apenas se confirme el
              pago.
            </p>
          </div>
          <a href="/cuenta">
            Ver mi cuenta <ArrowRight />
          </a>
          <a href={`/pedido/${order.id}`}>
            Seguir este pedido <ArrowRight />
          </a>
        </main>
        <StoreFooter />
      </div>
    );
  if (!cart.length)
    return (
      <div className="store-shell">
        <StoreHeader />
        <main className="store-empty-checkout">
          <h1>Tu carrito está vacío.</h1>
          <a href="/">
            <ArrowLeft /> Volver a la tienda
          </a>
        </main>
        <StoreFooter />
      </div>
    );
  return (
    <div className="store-shell">
      <StoreHeader />
      <main className="store-checkout">
        <a href="/">
          <ArrowLeft /> Seguir comprando
        </a>
        <div className="store-checkout-heading">
          <span>CHECKOUT SEGURO</span>
          <h1>Terminemos tu compra.</h1>
        </div>
        <div className="store-checkout-grid">
          <form onSubmit={submit} className="store-checkout-form">
            <section>
              <div className="store-form-step">
                <span>01</span>
                <div>
                  <h2>Tus datos</h2>
                  <p>
                    {session?.customer
                      ? 'Usamos los datos de tu cuenta.'
                      : 'Podés comprar sin cuenta y registrarte después.'}
                  </p>
                  {!session?.customer && (
                    <a className="store-checkout-login" href="/cuenta">
                      Ingresar para completar más rápido
                    </a>
                  )}
                </div>
              </div>
              <div className="store-fields">
                <label>
                  Nombre y apellido
                  <input
                    name="customerName"
                    autoComplete="name"
                    defaultValue={
                      session?.customer
                        ? `${session.customer.name} ${session.customer.surname}`
                        : ''
                    }
                    required
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={session?.customer?.email || ''}
                    required
                  />
                </label>
                <label>
                  Teléfono
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    defaultValue={session?.customer?.phone || ''}
                    required
                  />
                </label>
                <label>
                  DNI <small>Para identificar la entrega</small>
                  <input
                    name="document"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={20}
                  />
                </label>
              </div>
            </section>
            <section>
              <div className="store-form-step">
                <span>02</span>
                <div>
                  <h2>Entrega</h2>
                  <p>Elegí envío o retiro.</p>
                </div>
              </div>
              <div className="store-choice-row">
                <button
                  type="button"
                  className={
                    shippingMethod === 'correo-argentino-home' ? 'active' : ''
                  }
                  onClick={() => {
                    setShippingMethod('correo-argentino-home');
                    trackStore('add_shipping_info', {
                      metadata: { method: 'correo-argentino-home' },
                    });
                  }}
                >
                  <Truck />
                  <strong>Correo Argentino</strong>
                  <small>A domicilio</small>
                </button>
                <button
                  type="button"
                  className={shippingMethod === 'pickup' ? 'active' : ''}
                  onClick={() => {
                    setShippingMethod('pickup');
                    trackStore('add_shipping_info', {
                      metadata: { method: 'pickup' },
                    });
                  }}
                >
                  <PackageCheck />
                  <strong>Retiro</strong>
                  <small>Sin costo</small>
                </button>
              </div>
              {shippingMethod !== 'pickup' && (
                <div className="store-fields">
                  {!!session?.addresses?.length && (
                    <label className="wide">
                      Dirección guardada
                      <select
                        defaultValue=""
                        onChange={(event) => {
                          const address = session.addresses.find(
                            (item: any) => item.id === event.target.value,
                          );
                          if (!address) return;
                          setPostalCode(address.postalCode);
                          for (const key of [
                            'address',
                            'addressExtra',
                            'city',
                            'province',
                          ]) {
                            const element = document.querySelector(
                              `[name="${key}"]`,
                            ) as HTMLInputElement | HTMLSelectElement | null;
                            if (element)
                              element.value = String(address[key] ?? '');
                          }
                        }}
                      >
                        <option value="">Completar una nueva</option>
                        {session.addresses.map((item: any) => (
                          <option key={item.id} value={item.id}>
                            {item.label} · {item.address}, {item.city}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Código postal
                    <input
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={8}
                      required
                    />
                  </label>
                  <label>
                    Dirección
                    <input
                      name="address"
                      autoComplete="street-address"
                      placeholder="Calle y número"
                      required
                    />
                  </label>
                  <label>
                    Piso / departamento <small>Opcional</small>
                    <input name="addressExtra" autoComplete="address-line2" />
                  </label>
                  <label>
                    Ciudad
                    <input name="city" autoComplete="address-level2" required />
                  </label>
                  <label>
                    Provincia
                    <select
                      name="province"
                      autoComplete="address-level1"
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Seleccionar
                      </option>
                      {[
                        'Buenos Aires',
                        'CABA',
                        'Catamarca',
                        'Chaco',
                        'Chubut',
                        'Córdoba',
                        'Corrientes',
                        'Entre Ríos',
                        'Formosa',
                        'Jujuy',
                        'La Pampa',
                        'La Rioja',
                        'Mendoza',
                        'Misiones',
                        'Neuquén',
                        'Río Negro',
                        'Salta',
                        'San Juan',
                        'San Luis',
                        'Santa Cruz',
                        'Santa Fe',
                        'Santiago del Estero',
                        'Tierra del Fuego',
                        'Tucumán',
                      ].map((province) => (
                        <option key={province}>{province}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {shipping && (
                <p className="store-shipping-result">
                  <Truck />
                  {shipping.name} · {shipping.days}
                  <strong>
                    {shipping.amount ? storeMoney(shipping.amount) : 'Gratis'}
                  </strong>
                </p>
              )}
              {session?.customer && shippingMethod !== 'pickup' && (
                <label className="store-checkout-consent">
                  <input name="saveAddress" type="checkbox" defaultChecked />
                  <span>Guardar esta dirección en Mi FRAGUAN.</span>
                </label>
              )}
            </section>
            <section>
              <div className="store-form-step">
                <span>03</span>
                <div>
                  <h2>Pago</h2>
                  <p>El total se recalcula automáticamente.</p>
                </div>
              </div>
              <div className="store-payment-choice">
                <button
                  type="button"
                  className={payment === 'transfer' ? 'active' : ''}
                  onClick={() => {
                    setPayment('transfer');
                    setAppliedCouponCode('');
                    setCouponCode('');
                    setCouponMessage('');
                    trackStore('add_payment_info', {
                      metadata: { method: 'transfer' },
                    });
                  }}
                >
                  <Landmark />
                  <span>
                    <strong>Transferencia</strong>
                    <small>10% OFF automático</small>
                  </span>
                  <b>{storeMoney(subtotal - discount)}</b>
                </button>
                <button
                  type="button"
                  className={payment === 'card' ? 'active' : ''}
                  onClick={() => {
                    setPayment('card');
                    setAppliedCouponCode('');
                    setCouponCode('');
                    setCouponMessage('');
                    trackStore('add_payment_info', {
                      metadata: { method: 'card' },
                    });
                  }}
                >
                  <CreditCard />
                  <span>
                    <strong>Tarjeta</strong>
                    <small>Crédito o débito</small>
                  </span>
                  <b>{storeMoney(subtotal)}</b>
                </button>
              </div>
            </section>
            <label className="store-notes">
              Notas para el pedido
              <textarea name="notes" rows={3} placeholder="Opcional" />
            </label>
            <label className="store-checkout-consent">
              <input type="checkbox" required />
              <span>
                Confirmo que los datos son correctos y acepto los{' '}
                <a
                  href="/informacion/terminos"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Términos y condiciones
                </a>{' '}
                y la{' '}
                <a
                  href="/informacion/privacidad"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Política de privacidad
                </a>
                .
              </span>
            </label>
            <label className="store-checkout-consent">
              <input
                name="marketingRecovery"
                type="checkbox"
                onChange={(event) => {
                  if (!event.currentTarget.checked) return;
                  localStorage.setItem('fraguan-cookie-consent', 'analytics');
                  const email =
                    (
                      event.currentTarget.form?.elements.namedItem(
                        'email',
                      ) as HTMLInputElement | null
                    )?.value || '';
                  if (email)
                    trackStore('begin_checkout', {
                      consentGranted: true,
                      email,
                      value: subtotal,
                      cart: cart.map(
                        ({
                          id,
                          productName,
                          slug,
                          color,
                          size,
                          price,
                          quantity,
                        }) => ({
                          variantId: id,
                          productName,
                          slug,
                          color,
                          size,
                          price,
                          quantity,
                        }),
                      ),
                    });
                }}
              />
              <span>
                Quiero recibir ayuda por email si dejo esta compra sin terminar.
              </span>
            </label>
            {error && (
              <p className="store-buy-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="store-confirm-order"
              disabled={busy || pricingBusy || !pricing}
            >
              {busy
                ? 'Reservando stock…'
                : payment === 'transfer'
                  ? 'Crear pedido y ver datos'
                  : 'Continuar al pago'}
              <ArrowRight />
            </button>
            <p className="store-secure">
              <ShieldCheck /> Tus prendas se reservan al crear el pedido.
            </p>
          </form>
          <aside className="store-order-summary">
            <h2>Tu pedido</h2>
            {cart.map((item) => (
              <div className="store-summary-item" key={item.id}>
                <span>
                  <strong>{item.productName}</strong>
                  <small>
                    {item.color} · {item.size} · {item.quantity} u.
                  </small>
                </span>
                <span className="store-summary-edit">
                  <button
                    onClick={() => update(item.id, item.quantity - 1)}
                    aria-label="Quitar una unidad"
                  >
                    −
                  </button>
                  <b>{storeMoney(item.price * item.quantity)}</b>
                  <button
                    onClick={() => update(item.id, item.quantity + 1)}
                    aria-label="Agregar una unidad"
                  >
                    +
                  </button>
                </span>
              </div>
            ))}
            <div className="store-coupon">
              <label htmlFor="coupon">¿Tenés un cupón?</label>
              <div>
                <input
                  id="coupon"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setAppliedCouponCode('');
                    setCouponMessage('');
                  }}
                  placeholder="CÓDIGO"
                />
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={
                    !couponCode ||
                    (shippingMethod !== 'pickup' &&
                      postalCode.replace(/\D/g, '').length !== 4)
                  }
                >
                  Aplicar
                </button>
              </div>
              {couponMessage && <small>{couponMessage}</small>}
            </div>
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{storeMoney(subtotal)}</dd>
              </div>
              {transferDiscount > 0 && (
                <div className="discount">
                  <dt>10% transferencia</dt>
                  <dd>−{storeMoney(transferDiscount)}</dd>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className="discount">
                  <dt>Cupón</dt>
                  <dd>−{storeMoney(couponDiscount)}</dd>
                </div>
              )}
              <div>
                <dt>Envío</dt>
                <dd>
                  {shipping
                    ? shipping.amount
                      ? storeMoney(shipping.amount)
                      : 'Gratis'
                    : 'A calcular'}
                </dd>
              </div>
              <div className="total">
                <dt>Total</dt>
                <dd>{storeMoney(total)}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </main>
      <StoreFooter />
    </div>
  );
}
