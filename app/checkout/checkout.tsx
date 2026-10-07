'use client';
import './checkout-proposal.css';
import StoreReservation, {
  useReservationExpired,
} from '@/components/store-reservation';
import { CheckoutPanel } from '@/components/checkout-panel';
import { GoogleSignIn } from '@/components/google-sign-in';
import { FREE_SHIPPING_MINIMUM_MINOR } from '@/lib/store-shipping-policy';
import BarraEnvioGratis from '@/components/fraguan-animaciones/BarraEnvioGratis';
import TarjetaClub from '@/components/fraguan-animaciones/TarjetaClub';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  CreditCard,
  PackageCheck,
  Truck,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  Odometer,
  RollingText,
  CheckoutSteps,
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
function CheckoutField({
  children,
  className = '',
  ...props
}: React.ComponentProps<'label'>) {
  return (
    <label className={'cp-field ' + className} {...props}>
      {children}
    </label>
  );
}
const recipientAutocomplete = {
  firstName: 'given-name',
  surname: 'family-name',
};

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
  const [completed, setCompleted] = useState([false, false, false]);
  const [contactSummary, setContactSummary] = useState('');
  const [recoveryConsent, setRecoveryConsent] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [deliverySummary, setDeliverySummary] = useState('');
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
  const { expired: reservationExpired } = useReservationExpired(order);
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
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    if (recoveryConsent && !session?.customer && !emailVerificationToken) {
      setRecoveryMessage(
        'Verificá tu email en Contacto para recibir recordatorios.',
      );
      return;
    }
    const timer = setTimeout(() => {
      void storeApi('store-recovery', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          sessionId: storeSessionId(),
          consent: recoveryConsent,
          email: contactSummary,
          emailVerificationToken,
          items: cart.map((x) => ({ variantId: x.id, quantity: x.quantity })),
        }),
      })
        .then(() =>
          setRecoveryMessage(
            recoveryConsent
              ? 'Podés darte de baja desde cualquier recordatorio.'
              : '',
          ),
        )
        .catch((cause) => {
          if (!controller.signal.aborted)
            setRecoveryMessage(
              cause.message || 'No pudimos guardar tu preferencia.',
            );
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    hydrated,
    recoveryConsent,
    contactSummary,
    emailVerificationToken,
    session?.customer,
    cart,
  ]);
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
    setPricing(null);
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
            if (controller.signal.aborted) return;
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
    if (busy || pricingBusy || !pricing) return;
    if (createAccount && !passwordAuthEnabled && !session?.customer) {
      setError(
        'Continuá con Google para crear tu cuenta, o desmarcá esa opción para comprar como invitado.',
      );
      return;
    }
    for (const number of [1, 2, 3]) if (!validateStep(number)) return;
    setConfirmingPayment(true);
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (createAccount && !session?.customer && passwordAuthEnabled) {
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
  function openStep(number: number) {
    setStep(number);
    requestAnimationFrame(() => {
      const panel = checkoutForm.current?.querySelector<HTMLElement>(
        '[data-checkout-step="' + number + '"]',
      );
      panel?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      panel?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'start',
      });
    });
  }
  function validateStep(number: number) {
    const section = checkoutForm.current?.querySelector(
      '[data-checkout-step="' + number + '"]',
    );
    for (const field of Array.from(
      section?.querySelectorAll('input,select,textarea') || [],
    )) {
      const input = field as HTMLInputElement;
      if (input.willValidate && !input.checkValidity()) {
        openStep(number);
        requestAnimationFrame(() => input.reportValidity());
        return false;
      }
    }
    return true;
  }
  function advance() {
    if (!validateStep(step)) return;
    const form = new FormData(checkoutForm.current!);
    const value = (key: string) => {
      const entry = form.get(key);
      return typeof entry === 'string' ? entry : '';
    };
    setContactSummary(value('email'));
    setDeliverySummary(
      [
        value('firstName') + ' ' + value('surname'),
        shippingMethod === 'pickup'
          ? 'Retiro en el local'
          : value('address') + ', ' + value('city') + ' (' + postalCode + ')',
      ].join(' · '),
    );
    setCompleted((current) =>
      current.map((done, index) => (index === step - 1 ? true : done)),
    );
    openStep(Math.min(3, step + 1));
  }
  function choosePayment(method: 'transfer' | 'card') {
    setPayment(method);
    setAppliedCouponCode('');
    setCouponCode('');
    setCouponMessage('');
    trackStore('add_payment_info', { metadata: { method } });
  }
  if (order)
    return (
      <div className="store-shell">
        <section className="store-order-success">
          <div className="store-success-mark">
            <Check />
          </div>
          <span>PEDIDO #{order.orderNumber}</span>
          <h1 className="d">¡Gracias por tu compra!</h1>
          <StoreReservation order={order} />
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
              (order.paymentMethod === 'card' && !reservationExpired)
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
              {!reservationExpired && (
                <p>
                  Transferí el importe exacto e incluí esta referencia en el
                  concepto de la operación.
                </p>
              )}
              {!reservationExpired && (
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
              )}
              <form onSubmit={report} className="store-report-transfer">
                <CheckoutField>
                  ¿Ya transferiste?
                  <input
                    name="transactionId"
                    required
                    minLength={4}
                    maxLength={80}
                    placeholder="Número de operación bancaria"
                  />
                </CheckoutField>
                <button disabled={busy}>
                  {busy ? 'Registrando…' : 'Avisar transferencia'}{' '}
                  <ArrowRight />
                </button>
              </form>
            </>
          ) : payment === 'card' && !reservationExpired ? (
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
                : reservationExpired
                  ? 'La reserva de tus prendas venció.'
                  : 'Tus prendas están reservadas mientras completás el pago.'}
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
    <section className="checkout-proposal">
      <h1 className="fg-sr-only">Finalizar tu compra</h1>
      {confirmingPayment && (
        <section
          className="cp-processing"
          aria-label="Procesando tu pedido"
          aria-live="polite"
        >
          <PagoAprobado status="processing" />
          {createdCustomer && (
            <TarjetaClub
              nombre={[createdCustomer.name, createdCustomer.surname]
                .filter(Boolean)
                .join(' ')}
            />
          )}
        </section>
      )}
      <div className="cp-layout" hidden={confirmingPayment}>
        <form
          ref={checkoutForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (step < 3) advance();
            else void submit(event);
          }}
          noValidate
          className="cp-form"
        >
          <CheckoutSteps step={step} labels={['Contacto', 'Entrega', 'Pago']} />
          <CheckoutPanel
            number={1}
            title="CONTACTO"
            open={step === 1}
            completed={completed[0]}
            summary={contactSummary}
            onEdit={() => openStep(1)}
          >
            <div className="cp-email">
              <div className="cp-email-row">
                <CheckoutField>
                  Email
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
                </CheckoutField>
                {!session?.customer && (
                  <button
                    type="button"
                    onClick={requestEmailCode}
                    disabled={verificationBusy}
                  >
                    {emailVerificationToken ? 'Verificado' : 'Enviar código'}
                  </button>
                )}
              </div>
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
            </div>

            <p className="cp-muted cp-contact-note">
              {session?.customer ? (
                'Usamos los datos de tu cuenta.'
              ) : (
                <>
                  Comprás sin crear cuenta. ¿Ya tenés una?{' '}
                  <a href="/cuenta">Ingresar →</a> y tus datos se completan
                  solos.
                </>
              )}
            </p>
            <button type="button" className="cp-go" onClick={advance}>
              <RollingText>CONTINUAR</RollingText>
            </button>
          </CheckoutPanel>
          <CheckoutPanel
            number={2}
            title="ENTREGA"
            open={step === 2}
            completed={completed[1]}
            summary={deliverySummary}
            onEdit={() => openStep(2)}
          >
            <fieldset className="cp-options">
              <legend className="fg-sr-only">Método de entrega</legend>
              {(['correo-argentino-home', 'pickup'] as const).map((method) => (
                <label className="cp-option" key={method}>
                  <input
                    type="radio"
                    name="deliveryChoice"
                    value={method}
                    checked={shippingMethod === method}
                    onChange={() => {
                      setShippingMethod(method);
                      trackStore('add_shipping_info', { metadata: { method } });
                    }}
                  />
                  <span className="cp-dot" aria-hidden="true" />
                  <span>
                    <strong>
                      {method === 'pickup'
                        ? 'Retiro en el local'
                        : 'Envío a domicilio'}
                    </strong>
                    <small>
                      {method === 'pickup' ? 'Sin cargo' : 'A todo el país'}
                    </small>
                  </span>
                  <b>
                    {method === 'pickup'
                      ? 'Gratis'
                      : shippingMethod === method && shipping
                        ? shipping.amount
                          ? storeMoney(shipping.amount)
                          : 'Gratis'
                        : 'A calcular'}
                  </b>
                </label>
              ))}
            </fieldset>
            <div className="store-fields cp-recipient">
              <CheckoutField>
                Nombre
                <input
                  name="firstName"
                  type="text"
                  autoComplete={recipientAutocomplete.firstName}
                  defaultValue={session?.customer?.name || ''}
                  maxLength={80}
                  required
                />
              </CheckoutField>
              <CheckoutField>
                Apellido
                <input
                  name="surname"
                  type="text"
                  autoComplete={recipientAutocomplete.surname}
                  defaultValue={session?.customer?.surname || ''}
                  maxLength={80}
                  required
                />
              </CheckoutField>

              <CheckoutField>
                Teléfono
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={session?.customer?.phone || ''}
                  maxLength={25}
                  required
                />
              </CheckoutField>
              <CheckoutField>
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
              </CheckoutField>
            </div>
            <fieldset
              className="store-fields cp-address"
              hidden={shippingMethod === 'pickup'}
              disabled={shippingMethod === 'pickup'}
            >
              {!!session?.addresses?.length && (
                <CheckoutField className="wide">
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
                </CheckoutField>
              )}
              <input type="hidden" name="country" value="Argentina" />
              <CheckoutField>
                Código postal
                <input
                  name="postalCode"
                  value={postalCode}
                  onChange={(e) =>
                    setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  required
                />
              </CheckoutField>
              <CheckoutField>
                Dirección
                <input
                  name="address"
                  autoComplete="street-address"
                  placeholder="Calle y número"
                  maxLength={100}
                  required
                />
              </CheckoutField>
              <CheckoutField>
                Piso / departamento <small>Opcional</small>
                <input
                  name="addressExtra"
                  autoComplete="address-line2"
                  maxLength={50}
                />
              </CheckoutField>
              <CheckoutField>
                Ciudad
                <input
                  name="city"
                  autoComplete="address-level2"
                  maxLength={60}
                  required
                />
              </CheckoutField>
              <CheckoutField>
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
              </CheckoutField>
            </fieldset>
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
              <CheckoutField className="store-checkout-consent">
                <input name="saveAddress" type="checkbox" defaultChecked />
                <span>Guardar esta dirección en Mi FRAGUAN.</span>
              </CheckoutField>
            )}
            <button type="button" className="cp-go" onClick={advance}>
              <RollingText>CONTINUAR AL PAGO</RollingText>
            </button>
          </CheckoutPanel>
          <CheckoutPanel
            number={3}
            title="PAGO"
            open={step === 3}
            completed={false}
            summary=""
            onEdit={() => openStep(3)}
          >
            <p className="cp-muted">
              Tus prendas se reservan al crear el pedido.
            </p>
            <fieldset className="cp-options">
              <legend className="fg-sr-only">Medio de pago</legend>
              <label className="cp-option">
                <input
                  type="radio"
                  name="paymentChoice"
                  value="transfer"
                  checked={payment === 'transfer'}
                  onChange={() => choosePayment('transfer')}
                />
                <span className="cp-dot" aria-hidden="true" />
                <span>
                  <strong>Transferencia bancaria</strong>
                  <small>
                    10% OFF automático · ahorrás{' '}
                    {storeMoney(Math.floor(subtotal * 0.1))}
                  </small>
                </span>
                <span className="cp-tag">10% OFF</span>
              </label>
              <label className="cp-option">
                <input
                  type="radio"
                  name="paymentChoice"
                  value="card"
                  checked={payment === 'card'}
                  onChange={() => choosePayment('card')}
                />
                <span className="cp-dot" aria-hidden="true" />
                <span>
                  <strong>Tarjeta de crédito o débito</strong>
                  <small>Continuás en el pago seguro de Mercado Pago.</small>
                </span>
              </label>
            </fieldset>
            <details className="cp-optional">
              <summary>¿Tenés un código de descuento?</summary>{' '}
              <div className="store-coupon">
                <CheckoutField htmlFor="coupon">¿Tenés un cupón?</CheckoutField>
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
            </details>
            <details className="cp-optional">
              <summary>Agregar notas al pedido (opcional)</summary>
              <textarea
                name="notes"
                rows={3}
                maxLength={240}
                aria-label="Notas para el pedido"
                placeholder="Máximo 240 caracteres"
              />
            </details>
            {!session?.customer && (
              <>
                <CheckoutField className="design-consent">
                  <input
                    type="checkbox"
                    checked={createAccount}
                    disabled={!passwordAuthEnabled && !session?.googleClientId}
                    onChange={(e) => setCreateAccount(e.target.checked)}
                  />
                  <span>
                    <strong>Crear mi cuenta con estos datos</strong>
                    <small className="cp-account-help">
                      {passwordAuthEnabled
                        ? 'Guardá tus pedidos y datos para tu próxima compra.'
                        : session?.googleClientId
                          ? 'Continuá con Google para crear tu cuenta sin perder los datos de esta compra.'
                          : 'Podés continuar como invitado y verificar tu email en Contacto.'}
                    </small>
                  </span>
                </CheckoutField>
                {createAccount &&
                  !passwordAuthEnabled &&
                  session?.googleClientId && (
                    <div className="cp-google-account">
                      <GoogleSignIn
                        clientId={session.googleClientId}
                        buttonText="signup_with"
                        onError={setError}
                        onSuccess={async () => {
                          const account = await storeApi('store-account');
                          if (!account.customer)
                            throw new Error(
                              'No pudimos confirmar tu sesión. Intentá nuevamente.',
                            );
                          const emailField =
                            checkoutForm.current?.elements.namedItem(
                              'email',
                            ) as HTMLInputElement | null;
                          if (emailField)
                            emailField.value = account.customer.email;
                          setContactSummary(account.customer.email);
                          setSession(account);
                          dispatchEvent(
                            new CustomEvent('fraguan-account', {
                              detail: account.customer,
                            }),
                          );
                        }}
                      />
                    </div>
                  )}
                {createAccount && passwordAuthEnabled && (
                  <CheckoutField className="fi">
                    CONTRASEÑA (8+)
                    <input
                      name="accountPassword"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                    />
                  </CheckoutField>
                )}
              </>
            )}
            <CheckoutField className="store-checkout-consent cp-terms">
              <input name="termsConsent" type="checkbox" required />
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
            </CheckoutField>
            <CheckoutField className="store-checkout-consent">
              <input
                name="marketingRecovery"
                type="checkbox"
                checked={recoveryConsent}
                onChange={(event) =>
                  setRecoveryConsent(event.currentTarget.checked)
                }
              />
              <span>
                Quiero recibir ayuda por email si dejo esta compra sin terminar.
              </span>
            </CheckoutField>
            {recoveryMessage && (
              <output className="cp-muted">{recoveryMessage}</output>
            )}
            {!session?.customer &&
              !emailVerificationToken &&
              !(createAccount && passwordAuthEnabled) && (
                <p className="cp-muted">
                  Para confirmar el pedido,{' '}
                  <button
                    type="button"
                    className="cp-edit"
                    onClick={() => openStep(1)}
                  >
                    verificá tu email en Contacto
                  </button>
                  .
                </p>
              )}
            {error && (
              <p className="cp-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="cp-go"
              disabled={
                busy ||
                pricingBusy ||
                !pricing ||
                (createAccount && !passwordAuthEnabled && !session?.customer) ||
                (!session?.customer &&
                  !emailVerificationToken &&
                  !(createAccount && passwordAuthEnabled))
              }
            >
              <RollingText>
                {busy
                  ? 'RESERVANDO STOCK…'
                  : payment === 'transfer'
                    ? 'CONFIRMAR PEDIDO'
                    : 'CONTINUAR AL PAGO'}
              </RollingText>
            </button>
            <p className="cp-confirm-total">
              {pricing ? 'Total' : 'Total estimado'}{' '}
              <b>
                <Odometer value={total / 100} />
              </b>
            </p>
          </CheckoutPanel>
          {error && step < 3 && (
            <p className="cp-error" role="alert">
              {error}
            </p>
          )}
        </form>
        <aside className="cp-aside" aria-label="Resumen del pedido">
          <section className="cp-order-summary">
            <header className="cp-summary-heading">
              <span>TU PEDIDO</span>
              <span>
                <Odometer value={total / 100} />
              </span>
            </header>
            <div className="cp-summary-content">
              {cart.map((item) => (
                <div className="cp-item" key={item.id}>
                  <span className="cp-thumbnail" aria-hidden="true">
                    {item.productName
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((word) => word[0])
                      .join('')
                      .toUpperCase()}
                  </span>
                  <div>
                    <strong>{item.productName}</strong>
                    <small>
                      {item.color} · {item.size} · ×{item.quantity}
                    </small>
                    <div className="cp-quantity">
                      <button
                        type="button"
                        onClick={() => update(item.id, item.quantity - 1)}
                        aria-label={'Quitar una unidad de ' + item.productName}
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => update(item.id, item.quantity + 1)}
                        aria-label={'Agregar una unidad de ' + item.productName}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <b>
                    <Odometer value={(item.price * item.quantity) / 100} />
                  </b>
                </div>
              ))}
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
                  <dt>{pricing ? 'Total' : 'Total estimado'}</dt>
                  <dd>
                    <Odometer value={total / 100} />
                  </dd>
                </div>
              </dl>
              {shippingMethod !== 'pickup' && (
                <BarraEnvioGratis
                  subtotal={
                    Math.max(0, (pricing?.subtotal ?? subtotal) - discount) /
                    100
                  }
                  meta={FREE_SHIPPING_MINIMUM_MINOR / 100}
                  ready={hydrated}
                />
              )}
              <a className="cp-edit cp-back-cart" href="/carrito">
                Modificar carrito →
              </a>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
