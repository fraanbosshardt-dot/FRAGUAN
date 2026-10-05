'use client';
import TarjetaClub from '@/components/fraguan-animaciones/TarjetaClub';
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
import {
  Odometer,
  RollingText,
  CheckoutSteps,
  AnimatedLabel,
  useAnimatedFields,
} from '@/components/store-motion';
import PagoAprobado from '@/components/PagoAprobado';
import {
  StorePaymentTicket,
  useOrderPaymentUpdates,
} from '@/components/store-payment-ticket';
import type { ReceiptOrder } from '@/lib/store-payment-receipt';
import {
  storeApi,
  storeMoney,
  useStoreCart,
  storeAttribution,
  storeSessionId,
  trackStore,
} from '@/lib/store-client';

const STORE_PICKUP_POSTAL_CODE = '2661';

type Order = ReceiptOrder & Record<string, any>;
type CheckoutQuote = {
  subtotal: number;
  transferDiscount: number;
  couponDiscount: number;
  discount: number;
  shipping: { amount: number; name: string; days: string };
  total: number;
  appliedDiscounts: { promotionName: string }[];
};
export default function Checkout({
  passwordAuthEnabled = import.meta.env.DEV,
}: {
  passwordAuthEnabled?: boolean;
}) {
  const { cart, subtotal, clear, update } = useStoreCart();
  const [step, setStep] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [createAccount, setCreateAccount] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState<any>(null);
  const [cardChoice, setCardChoice] = useState<'card' | 'mp'>('card');
  const [payment, setPayment] = useState<'transfer' | 'card'>('transfer');
  const [shippingMethod, setShippingMethod] = useState<
    'correo-argentino-home' | 'pickup'
  >('correo-argentino-home');
  const [postalCode, setPostalCode] = useState('');
  const [pricing, setPricing] = useState<CheckoutQuote | null>(null);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  useOrderPaymentUpdates(order, setOrder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [emailChallenge, setEmailChallenge] = useState('');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationBusy, setVerificationBusy] = useState(false);
  const checkoutForm = useRef<HTMLFormElement>(null);
  useAnimatedFields(checkoutForm);
  const addressAutoFilled = useRef(false);
  const idempotency = useRef(crypto.randomUUID());
  const accessToken = useRef(crypto.randomUUID());
  useEffect(() => {
    storeApi('store-account')
      .then(setSession)
      .catch(() => undefined);
  }, []);
  function fillShippingAddress(address?: Record<string, any>) {
    setPostalCode(address?.postalCode || '');
    for (const key of [
      'country',
      'address',
      'addressExtra',
      'city',
      'province',
    ]) {
      const element = checkoutForm.current?.elements.namedItem(key) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      if (element)
        element.value = String(
          address?.[key] || (key === 'country' ? 'Argentina' : ''),
        );
    }
  }
  useEffect(() => {
    if (shippingMethod !== 'correo-argentino-home') {
      addressAutoFilled.current = false;
      return;
    }
    if (addressAutoFilled.current || !session?.addresses?.length) return;
    const primary =
      session.addresses.find((address: any) => address.isDefault) ||
      session.addresses[0];
    setSelectedAddressId(primary.id);
    fillShippingAddress(primary);
    addressAutoFilled.current = true;
  }, [session, shippingMethod]);
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
            postalCode:
              shippingMethod === 'pickup'
                ? STORE_PICKUP_POSTAL_CODE
                : postalCode,
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
    setConfirmingPayment(true);
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (createAccount && !session?.customer) {
        await storeApi('store-account', {
          method: 'POST',
          body: JSON.stringify({
            action: 'register',
            email: form.get('email'),
            password: form.get('accountPassword'),
            name: form.get('firstName'),
            surname: form.get('surname'),
            phone: form.get('phone'),
            marketingConsent: false,
          }),
        });
        const account = await storeApi('store-account');
        setSession(account);
        setCreatedCustomer(account.customer);
        setCreateAccount(false);
        dispatchEvent(
          new CustomEvent('fraguan-account', { detail: account.customer }),
        );
      }
      const result = await storeApi<Order>('store-checkout', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((item) => ({
            variantId: item.id,
            quantity: item.quantity,
          })),
          email: form.get('email'),
          emailVerificationToken,
          customerName:
            `${(form.get('firstName') as string) || ''} ${(form.get('surname') as string) || ''}`.trim(),
          phone: form.get('phone'),
          document: form.get('document') || '',
          paymentMethod: payment,
          shippingMethod,
          postalCode:
            shippingMethod === 'pickup' ? STORE_PICKUP_POSTAL_CODE : postalCode,
          address:
            shippingMethod === 'pickup'
              ? 'Retiro en local'
              : form.get('address'),
          addressExtra:
            shippingMethod === 'pickup' ? '' : form.get('addressExtra') || '',
          city: shippingMethod === 'pickup' ? 'Isla Verde' : form.get('city'),
          province:
            shippingMethod === 'pickup' ? 'Córdoba' : form.get('province'),
          country: 'Argentina',
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
      setConfirmingPayment(false);
    }
  }
  async function requestEmailCode() {
    const email = (
      checkoutForm.current?.elements.namedItem(
        'email',
      ) as HTMLInputElement | null
    )?.value.trim();
    if (!email || !checkoutForm.current?.elements.namedItem('email')) return;
    const emailInput = checkoutForm.current.elements.namedItem(
      'email',
    ) as HTMLInputElement;
    if (!emailInput.reportValidity()) return;
    setVerificationBusy(true);
    setError('');
    setVerificationMessage('');
    try {
      const result = await storeApi<{
        challenge: string;
        devCode?: string;
      }>('store-email-verification', {
        method: 'POST',
        body: JSON.stringify({ action: 'request', email }),
      });
      setEmailChallenge(result.challenge);
      setEmailVerificationToken('');
      setVerificationCode(result.devCode || '');
      setVerificationMessage(
        result.devCode
          ? `Código local: ${result.devCode}`
          : 'Te enviamos un código de 6 dígitos.',
      );
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setVerificationBusy(false);
    }
  }
  async function verifyEmailCode() {
    const email = (
      checkoutForm.current?.elements.namedItem(
        'email',
      ) as HTMLInputElement | null
    )?.value.trim();
    if (!email || !emailChallenge || !/^\d{6}$/.test(verificationCode)) return;
    setVerificationBusy(true);
    setError('');
    try {
      const result = await storeApi<{ verificationToken: string }>(
        'store-email-verification',
        {
          method: 'POST',
          body: JSON.stringify({
            action: 'verify',
            email,
            challenge: emailChallenge,
            code: verificationCode,
          }),
        },
      );
      setEmailVerificationToken(result.verificationToken);
      setVerificationMessage('Email verificado.');
    } catch (cause: any) {
      setEmailVerificationToken('');
      setError(cause.message);
    } finally {
      setVerificationBusy(false);
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
          postalCode:
            shippingMethod === 'pickup' ? STORE_PICKUP_POSTAL_CODE : postalCode,
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
  function advance() {
    const section = checkoutForm.current?.querySelector(
      '[data-checkout-step="' + step + '"]',
    );
    for (const field of Array.from(
      section?.querySelectorAll('input,select') || [],
    )) {
      if (!(field as HTMLInputElement).reportValidity()) return;
    }
    setError('');
    setStep(step + 1);
  }
  if (confirmingPayment && !order)
    return (
      <div className="store-shell">
        <section className="sec pg">
          <PagoAprobado status="processing" />
          {createdCustomer && (
            <TarjetaClub
              nombre={[createdCustomer.name, createdCustomer.surname]
                .filter(Boolean)
                .join(' ')}
            />
          )}
        </section>
      </div>
    );
  if (order)
    return (
      <div className="store-shell">
        <section className="store-order-success">
          <div className="store-success-mark">
            <Check />
          </div>
          <span>PEDIDO #{order.orderNumber}</span>
          <h1 className="d">¡Gracias por tu compra!</h1>
          {createdCustomer && (
            <TarjetaClub
              nombre={[createdCustomer.name, createdCustomer.surname]
                .filter(Boolean)
                .join(' ')}
            />
          )}
          <StorePaymentTicket
            order={order}
            showPending={
              busy ||
              order.paymentStatus === 'reported' ||
              order.paymentMethod === 'card'
            }
          />
          {order.paymentStatus === 'reported' && (
            <p>
              Recibimos tu aviso de transferencia. Estamos esperando la
              acreditación del pago.
            </p>
          )}
          {order.paymentStatus === 'paid' ? null : payment === 'transfer' &&
            order.paymentStatus !== 'reported' ? (
            <>
              <p>
                Transferí el importe exacto e incluí esta referencia en el
                concepto de la operación.
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
                <AnimatedLabel>
                  ¿Ya transferiste?
                  <input
                    name="transactionId"
                    required
                    minLength={4}
                    maxLength={80}
                    placeholder="Número de operación bancaria"
                  />
                </AnimatedLabel>
                <button disabled={busy}>
                  {busy ? 'Registrando…' : 'Avisar transferencia'}{' '}
                  <ArrowRight />
                </button>
              </form>
            </>
          ) : payment === 'card' ? (
            <div className="store-payment-pending">
              <CreditCard />
              <h2>Pago con tarjeta preparado</h2>
              <p>
                Al conectar la pasarela, este paso abrirá el pago seguro y su
                confirmación llegará automáticamente al pedido.
              </p>
            </div>
          ) : null}
          <div className="store-order-next">
            <p>
              <PackageCheck />{' '}
              {order.paymentStatus === 'paid'
                ? 'Tu pago está confirmado.'
                : 'Reservamos tus prendas durante 30 minutos.'}
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
        </section>
      </div>
    );
  if (!hydrated)
    return (
      <section className="sec lt pg">
        <h1 className="d h1">Pagar</h1>
        <p className="em0" aria-busy="true">
          Cargando tu selección…
        </p>
      </section>
    );
  if (!cart.length)
    return (
      <div className="store-shell">
        <section className="store-empty-checkout">
          <h1>Tu carrito está vacío.</h1>
          <a href="/">
            <ArrowLeft /> Volver a la tienda
          </a>
        </section>
      </div>
    );
  return (
    <div className="store-shell">
      <section className="store-checkout sec lt pg">
        <a href="/">
          <ArrowLeft /> Seguir comprando
        </a>
        <h1 className="d h1">Pagar</h1>
        {createdCustomer && (
          <TarjetaClub
            nombre={[createdCustomer.name, createdCustomer.surname]
              .filter(Boolean)
              .join(' ')}
          />
        )}
        <CheckoutSteps step={step} />
        <div className="store-checkout-grid">
          <form
            ref={checkoutForm}
            onSubmit={(event) => {
              if (step < 3) {
                event.preventDefault();
                advance();
              } else void submit(event);
            }}
            noValidate={step < 3}
            className="store-checkout-form"
            data-step={step}
          >
            <section
              data-checkout-step={1}
              hidden={step !== 1}
              className={step === 1 ? 'store-step-enter' : undefined}
            >
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
                <AnimatedLabel>
                  NOMBRE
                  <input
                    name="firstName"
                    autoComplete="name"
                    defaultValue={session?.customer?.name || ''}
                    maxLength={80}
                    required
                  />
                </AnimatedLabel>
                <AnimatedLabel>
                  APELLIDO
                  <input
                    name="surname"
                    autoComplete="name"
                    defaultValue={session?.customer?.surname || ''}
                    maxLength={80}
                    required
                  />
                </AnimatedLabel>
                <AnimatedLabel className="store-email-control">
                  Email
                  <span>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      defaultValue={session?.customer?.email || ''}
                      maxLength={120}
                      onChange={() => {
                        setEmailChallenge('');
                        setEmailVerificationToken('');
                        setVerificationCode('');
                        setVerificationMessage('');
                      }}
                      required
                    />
                    {!session?.customer && (
                      <button
                        type="button"
                        onClick={requestEmailCode}
                        disabled={verificationBusy}
                      >
                        {emailVerificationToken
                          ? 'Verificado'
                          : 'Enviar código'}
                      </button>
                    )}
                  </span>
                  {!session?.customer &&
                    emailChallenge &&
                    !emailVerificationToken && (
                      <span className="store-email-code">
                        <input
                          aria-label="Código de verificación"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={verificationCode}
                          onChange={(event) =>
                            setVerificationCode(
                              event.target.value.replace(/\D/g, '').slice(0, 6),
                            )
                          }
                          maxLength={6}
                          placeholder="Código de 6 dígitos"
                        />
                        <button
                          type="button"
                          onClick={verifyEmailCode}
                          disabled={
                            verificationBusy || verificationCode.length !== 6
                          }
                        >
                          Verificar
                        </button>
                      </span>
                    )}
                  {!session?.customer && verificationMessage && (
                    <small className={emailVerificationToken ? 'verified' : ''}>
                      {verificationMessage}
                    </small>
                  )}
                </AnimatedLabel>
                <AnimatedLabel>
                  Teléfono
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    defaultValue={session?.customer?.phone || ''}
                    maxLength={25}
                    required
                  />
                </AnimatedLabel>
                <AnimatedLabel>
                  DNI <small>Para identificar la entrega</small>
                  <input
                    name="document"
                    inputMode="numeric"
                    autoComplete="off"
                    pattern="[0-9]{7,11}"
                    maxLength={11}
                    onInput={(event) => {
                      event.currentTarget.value = event.currentTarget.value
                        .replace(/\D/g, '')
                        .slice(0, 11);
                    }}
                  />
                </AnimatedLabel>
              </div>
            </section>
            <section
              data-checkout-step={2}
              hidden={step !== 2}
              className={step === 2 ? 'store-step-enter' : undefined}
            >
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
                  <strong>Envío a domicilio</strong>
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
                  <strong>Retiro en el local</strong>
                  <small>Sin costo</small>
                </button>
              </div>
              {shippingMethod !== 'pickup' && (
                <div className="store-fields">
                  {!!session?.addresses?.length && (
                    <AnimatedLabel className="wide">
                      Dirección guardada
                      <select
                        value={selectedAddressId}
                        onChange={(event) => {
                          setSelectedAddressId(event.target.value);
                          const address = session.addresses.find(
                            (item: any) => item.id === event.target.value,
                          );
                          fillShippingAddress(address);
                        }}
                      >
                        <option value="">Usar otra dirección</option>
                        {session.addresses.map((item: any) => (
                          <option key={item.id} value={item.id}>
                            {item.label} · {item.address}, {item.city}
                          </option>
                        ))}
                      </select>
                      <small>
                        Podés modificar estos datos solo para esta compra.
                      </small>
                    </AnimatedLabel>
                  )}
                  <AnimatedLabel>
                    País
                    <select
                      name="country"
                      autoComplete="country-name"
                      defaultValue="Argentina"
                      required
                    >
                      <option>Argentina</option>
                    </select>
                  </AnimatedLabel>
                  <AnimatedLabel>
                    Código postal
                    <input
                      value={postalCode}
                      onChange={(e) =>
                        setPostalCode(
                          e.target.value.replace(/\D/g, '').slice(0, 4),
                        )
                      }
                      inputMode="numeric"
                      autoComplete="postal-code"
                      pattern="[0-9]{4}"
                      maxLength={4}
                      required
                    />
                  </AnimatedLabel>
                  <AnimatedLabel>
                    Dirección
                    <input
                      name="address"
                      autoComplete="street-address"
                      placeholder="Calle y número"
                      maxLength={100}
                      required
                    />
                  </AnimatedLabel>
                  <AnimatedLabel>
                    Piso / departamento <small>Opcional</small>
                    <input
                      name="addressExtra"
                      autoComplete="address-line2"
                      maxLength={50}
                    />
                  </AnimatedLabel>
                  <AnimatedLabel>
                    Ciudad
                    <input
                      name="city"
                      autoComplete="address-level2"
                      maxLength={60}
                      required
                    />
                  </AnimatedLabel>
                  <AnimatedLabel>
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
                  </AnimatedLabel>
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
                <AnimatedLabel className="store-checkout-consent">
                  <input name="saveAddress" type="checkbox" defaultChecked />
                  <span>Guardar esta dirección en Mi FRAGUAN.</span>
                </AnimatedLabel>
              )}
            </section>
            <section
              data-checkout-step={3}
              hidden={step !== 3}
              className={step === 3 ? 'store-step-enter' : undefined}
            >
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
                    <strong>Transferencia bancaria · 10% OFF</strong>
                    <small>10% OFF automático</small>
                  </span>
                  <b>{storeMoney(subtotal - discount)}</b>
                </button>
                <button
                  type="button"
                  className={
                    payment === 'card' && cardChoice === 'card' ? 'active' : ''
                  }
                  onClick={() => {
                    setPayment('card');
                    setCardChoice('card');
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
                    <strong>Tarjeta de crédito o débito</strong>
                    <small>Crédito o débito</small>
                  </span>
                  <b>{storeMoney(subtotal)}</b>
                </button>

                <button
                  type="button"
                  className={
                    payment === 'card' && cardChoice === 'mp' ? 'active' : ''
                  }
                  onClick={() => {
                    setPayment('card');
                    setCardChoice('mp');
                    setAppliedCouponCode('');
                    setCouponCode('');
                    setCouponMessage('');
                  }}
                >
                  <CreditCard />
                  <span>
                    <strong>Mercado Pago</strong>
                    <small>Dinero en cuenta, tarjetas guardadas</small>
                  </span>
                </button>
                <button type="button" disabled>
                  <Landmark />
                  <span>
                    <strong>Efectivo en el local</strong>
                    <small>
                      {shippingMethod === 'pickup'
                        ? 'Próximamente'
                        : 'Solo con retiro en el local'}
                    </small>
                  </span>
                </button>
              </div>
              {!session?.customer && (
                <>
                  <AnimatedLabel className="design-consent">
                    <input
                      type="checkbox"
                      checked={createAccount}
                      disabled={!passwordAuthEnabled}
                      onChange={(e) => setCreateAccount(e.target.checked)}
                    />
                    Crear mi cuenta con estos datos
                  </AnimatedLabel>
                  {createAccount && (
                    <AnimatedLabel className="fi">
                      CONTRASEÑA (8+)
                      <input
                        name="accountPassword"
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        maxLength={128}
                        required
                      />
                    </AnimatedLabel>
                  )}
                </>
              )}
            </section>
            <AnimatedLabel className="store-notes">
              Notas para el pedido
              <textarea
                name="notes"
                rows={2}
                maxLength={240}
                placeholder="Opcional · máximo 240 caracteres"
              />
            </AnimatedLabel>
            <AnimatedLabel className="store-checkout-consent">
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
            </AnimatedLabel>
            <AnimatedLabel className="store-checkout-consent">
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
            </AnimatedLabel>
            {error && (
              <p className="store-buy-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="store-confirm-order"
              disabled={
                busy ||
                pricingBusy ||
                !pricing ||
                (!session?.customer &&
                  !emailVerificationToken &&
                  !createAccount)
              }
            >
              {busy
                ? 'Reservando stock…'
                : payment === 'transfer'
                  ? 'Crear pedido y ver datos'
                  : 'Continuar al pago'}
              <ArrowRight />
            </button>
            <div className="row design-checkout-actions">
              {step > 1 && (
                <button
                  type="button"
                  className="btn g"
                  onClick={() => {
                    setStep(step - 1);
                    setError('');
                  }}
                >
                  <RollingText>← VOLVER</RollingText>
                </button>
              )}
              {step < 3 && (
                <button type="button" className="btn a" onClick={advance}>
                  <RollingText>CONTINUAR →</RollingText>
                </button>
              )}
            </div>
            <p className="store-secure">
              <ShieldCheck /> Tus prendas se reservan al crear el pedido.
            </p>
          </form>
          <aside className="store-order-summary">
            <h2 className="d">Resumen</h2>
            {cart.map((item) => (
              <div className="store-summary-item" key={item.id}>
                <span>
                  <strong>{item.productName}</strong>
                  <small>
                    {item.color} · {item.size}
                  </small>
                </span>
                <span className="store-summary-edit">
                  <b>
                    <Odometer value={(item.price * item.quantity) / 100} />
                  </b>
                  <span className="store-summary-quantity">
                    <button
                      type="button"
                      onClick={() => update(item.id, item.quantity - 1)}
                      aria-label="Quitar una unidad"
                    >
                      −
                    </button>
                    <strong>{item.quantity}</strong>
                    <button
                      type="button"
                      onClick={() => update(item.id, item.quantity + 1)}
                      aria-label="Agregar una unidad"
                    >
                      +
                    </button>
                  </span>
                </span>
              </div>
            ))}
            <div className="store-coupon">
              <AnimatedLabel htmlFor="coupon">¿Tenés un cupón?</AnimatedLabel>
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
                  maxLength={30}
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
                <dd>
                  <Odometer value={subtotal / 100} />
                </dd>
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
                <dd>
                  <Odometer value={total / 100} />
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    </div>
  );
}
