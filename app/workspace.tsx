'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  ShoppingBag,
  ArrowUpRight,
  Plus,
  Minus,
  Trash2,
  UserRound,
  ScanBarcode,
  Clock3,
  Check,
  Printer,
  LayoutDashboard,
  Sun,
  Moon,
  RotateCcw,
  ShieldCheck,
  PackageCheck,
  Store,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { printCommerce } from '@/lib/printing';
import { LoadingState } from '@/components/loading-state';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  api,
  money,
  minor,
  date,
  useSession,
  useClock,
  Row,
  ApiError,
} from '@/lib/client';
import './pos/pos-proposal.css';
import { InternalSignOut } from '@/components/internal-sign-out';
import { PosSections } from '@/components/pos-sections';
export default function Workspace() {
  const { session, error: sessionError, reload } = useSession(),
    clock = useClock();
  const [view, setView] = useState<
      'sale' | 'summary' | 'returns' | 'promotions'
    >('sale'),
    [cartOpen, setCartOpen] = useState(false),
    [sectionRevision, setSectionRevision] = useState(0),
    [cartPricing, setCartPricing] = useState<Row | null>(null),
    [pricingPending, setPricingPending] = useState(false),
    [pricingRevision, setPricingRevision] = useState(0),
    [pricingError, setPricingError] = useState(''),
    [manualDiscountType, setManualDiscountType] = useState('%'),
    [manualDiscountValue, setManualDiscountValue] = useState(''),
    [excludedPromotionIds, setExcludedPromotionIds] = useState<string[]>([]),
    [catalog, setCatalog] = useState<Row[]>([]),
    [catalogLoading, setCatalogLoading] = useState(true),
    [methods, setMethods] = useState<Row[]>([]),
    [offers, setOffers] = useState<Row[]>([]),
    [search, setSearch] = useState(''),
    [category, setCategory] = useState('Todos'),
    [cart, setCart] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row | null>(null),
    [color, setColor] = useState(''),
    [size, setSize] = useState(''),
    [modal, setModal] = useState(''),
    [customer, setCustomer] = useState<Row | null>(null),
    [customerQuery, setCustomerQuery] = useState(''),
    [customers, setCustomers] = useState<Row[]>([]),
    [method, setMethod] = useState('cash'),
    [received, setReceived] = useState(''),
    [split, setSplit] = useState(false),
    [splitAmount, setSplitAmount] = useState(''),
    [secondMethod, setSecondMethod] = useState('debit'),
    [offerIds, setOfferIds] = useState<string[]>([]),
    [couponCode, setCouponCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<Row | null>(null),
    [recent, setRecent] = useState<Row[]>([]),
    [onlineOrders, setOnlineOrders] = useState<Row[]>([]),
    [onlineOrder, setOnlineOrder] = useState<Row | null>(null),
    [quote, setQuote] = useState<Row | null>(null),
    [pendingSale, setPendingSale] = useState<Row | null>(null),
    [dark, setDark] = useState(false),
    [reference, setReference] = useState(''),
    [creditBalance, setCreditBalance] = useState(0),
    [refundReason, setRefundReason] = useState(''),
    [refundToken, setRefundToken] = useState(''),
    [refundMethod, setRefundMethod] = useState('original'),
    [refundItems, setRefundItems] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLInputElement>(null),
    reviewedInput = useRef<Row | null>(null),
    submittedInput = useRef<Row | null>(null);
  const recoveryKey = session?.user?.id
    ? `fraguan-pos-pending:${session.user.id}`
    : '';
  useEffect(() => {
    if (!recoveryKey) return;
    const restore = () => {
      const saved = localStorage.getItem(recoveryKey);
      if (!saved) return;
      try {
        const pending = JSON.parse(saved);
        if (!pending.payload?.idempotencyKey || !pending.quote?.payments)
          throw new Error('invalid');
        submittedInput.current = pending;
        setPendingSale(pending);
        setQuote(pending.quote);
        setModal('payment');
      } catch {
        setError(
          'No se pudo recuperar el cobro pendiente. Revisá las ventas recientes antes de volver a cobrar.',
        );
      }
    };
    restore();
    window.addEventListener('storage', restore);
    return () => window.removeEventListener('storage', restore);
  }, [recoveryKey]);
  const focusScanner = useCallback(() => {
    if (submittedInput.current) return;
    setView('sale');
    setCategory('Todos');
    requestAnimationFrame(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    });
  }, []);
  const refresh = async () => {
    const [c, m, o] = await Promise.all([
      api('catalog'),
      api('methods'),
      api('offers'),
    ]);
    setCatalog(c);
    setMethods(m);
    setOffers(o);
  };
  useEffect(() => {
    if (session?.user)
      refresh()
        .catch((e) => setError(e.message))
        .finally(() => setCatalogLoading(false));
  }, [session]);
  useEffect(() => {
    const saved = localStorage.getItem('fraguan-theme');
    setDark(
      saved
        ? saved === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches,
    );
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  useEffect(() => {
    if (customerQuery.trim().length < 2) {
      setCustomers([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(
      () =>
        api('customers?scope=pos&q=' + encodeURIComponent(customerQuery))
          .then((result) => {
            if (!cancelled) setCustomers(result);
          })
          .catch((e) => {
            if (!cancelled) setError(e.message);
          }),
      220,
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [customerQuery, modal]);
  useEffect(() => {
    if (!customer?.id) {
      setCreditBalance(0);
      if (method === 'store_credit') setMethod('cash');
      if (method === 'cashback') setMethod('cash');
      return;
    }
    api<{ balance: number; cashbackBalance: number }>(
      'customer-credit-balance?customerId=' + encodeURIComponent(customer.id),
    )
      .then((result) => {
        setCreditBalance(result.balance);
      })
      .catch(() => {
        setCreditBalance(0);
      });
  }, [customer?.id, method]);
  const groups = useMemo(() => {
    const map = new Map<string, Row>();
    for (const v of catalog) {
      if (!map.has(v.productId)) map.set(v.productId, { ...v, variants: [] });
      map.get(v.productId)!.variants.push(v);
    }
    return [...map.values()];
  }, [catalog]);
  const filtered = groups.filter(
    (p) =>
      (category === 'Todos' || p.category === category) &&
      p.variants.some((v: Row) =>
        `${v.name} ${v.sku} ${v.barcode} ${v.brand} ${v.color} ${v.size}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
  );
  const subtotal =
    cartPricing?.subtotal ?? cart.reduce((n, i) => n + i.price * i.quantity, 0);
  const canDiscount = session?.permissions?.includes('promotions');
  const manualDiscountMinor = (() => {
    if (!manualDiscountValue.trim() || !canDiscount) return 0;
    try {
      const value = minor(manualDiscountValue);
      return manualDiscountType === '%'
        ? Math.round((subtotal * value) / 10000)
        : value;
    } catch {
      return -1;
    }
  })();
  const manualDiscountInput = useMemo(() => {
    if (!manualDiscountValue.trim() || !canDiscount)
      return { manualDiscountMinor: 0 };
    try {
      const value = minor(manualDiscountValue);
      return manualDiscountType === '%'
        ? { manualDiscountBps: value }
        : { manualDiscountMinor: value };
    } catch {
      return { manualDiscountMinor: -1 };
    }
  }, [manualDiscountValue, manualDiscountType, canDiscount]);
  const currentPrice = (item: Row) =>
    cartPricing?.items?.find((v: Row) => v.id === item.id)?.price ?? item.price;
  const promotion =
      offerIds.length === 1 ? offers.find((o) => o.id === offerIds[0]) : null,
    estimatedDiscount =
      promotion && (!promotion.kind || promotion.kind === 'percentage')
        ? Math.floor((subtotal * promotion.percent) / 100)
        : 0,
    discount = cartPricing?.discount ?? estimatedDiscount,
    base = cartPricing?.base ?? subtotal - discount;
  useEffect(() => {
    if (submittedInput.current) return;
    setQuote(null);
    reviewedInput.current = null;
    setCartPricing(null);
    setPricingError('');
    if (!cart.length || !session?.user) {
      setPricingPending(false);
      return;
    }
    if (
      (manualDiscountInput.manualDiscountMinor ?? 0) < 0 ||
      (manualDiscountInput.manualDiscountBps ?? 0) > 10000
    ) {
      setPricingError('Ingresá un descuento válido.');
      setPricingPending(false);
      return;
    }
    let cancelled = false;
    setPricingPending(true);
    const timer = setTimeout(() => {
      api('pricing', {
        items: cart.map((item) => ({
          variantId: item.id,
          quantity: item.quantity,
        })),
        customerId: customer?.id ?? null,
        promotionId: null,
        promotionIds: offerIds,
        couponCode: couponCode.trim() || undefined,
        ...manualDiscountInput,
        autoPromotions: true,
        excludedPromotionIds,
        methodIds: split ? [method, secondMethod] : [method],
      })
        .then((result) => {
          if (!cancelled) setCartPricing(result);
        })
        .catch((e) => {
          if (!cancelled) setPricingError(e.message);
        })
        .finally(() => {
          if (!cancelled) setPricingPending(false);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    cart,
    customer?.id,
    offerIds,
    couponCode,
    manualDiscountInput,
    method,
    secondMethod,
    split,
    excludedPromotionIds,
    session?.user,
    pricingRevision,
  ]);
  useEffect(() => {
    if (!cart.length || quote || pendingSale) return;
    const update = () => {
      if (!document.hidden && !submittedInput.current)
        setPricingRevision((n) => n + 1);
    };
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, [cart.length, quote, pendingSale]);
  useEffect(() => {
    if (submittedInput.current) return;
    const available = methods.filter(
      (m) =>
        m.id !== 'cashback' && (m.id !== 'store_credit' || Boolean(customer)),
    );
    if (!available.length) return;
    const first = available.some((m) => m.id === method)
      ? method
      : available[0].id;
    if (first !== method) setMethod(first);
    if (secondMethod === first || !available.some((m) => m.id === secondMethod))
      setSecondMethod(available.find((m) => m.id !== first)?.id ?? '');
    if (split && available.length < 2) setSplit(false);
  }, [method, secondMethod, methods, customer, split]);
  const firstBase = split
    ? (() => {
        try {
          return minor(splitAmount);
        } catch {
          return 0;
        }
      })()
    : base;
  const selectedMethod = methods.find((m) => m.id === method),
    second = methods.find((m) => m.id === secondMethod);
  const surcharge = (n: number, m?: Row) =>
    n + Math.floor((n * (m?.surchargeBps ?? 0) + 5000) / 10000);
  const estimatedTotal =
    surcharge(firstBase, selectedMethod) +
    (split ? surcharge(base - firstBase, second) : 0);
  const cashDue =
    method === 'cash'
      ? surcharge(firstBase, selectedMethod)
      : split && secondMethod === 'cash'
        ? surcharge(base - firstBase, second)
        : 0;
  const cashReceived = (() => {
    try {
      return minor(received);
    } catch {
      return 0;
    }
  })();
  const add = (variant: Row) => {
    if (submittedInput.current) return;
    setError('');
    setCart((current) => {
      const existing = current.find((x) => x.id === variant.id);
      if ((existing?.quantity ?? 0) >= variant.stock) {
        setError('No hay más unidades disponibles de esta variante.');
        return current;
      }
      return existing
        ? current.map((x) =>
            x.id === variant.id ? { ...x, quantity: x.quantity + 1 } : x,
          )
        : [...current, { ...variant, quantity: 1 }];
    });
    setSelected(null);
    setSearch('');
    searchRef.current?.focus();
  };
  const openPayment = useCallback(() => {
    if (submittedInput.current) {
      setModal('payment');
      return;
    }
    if (cart.length && !pricingPending && !pricingError) {
      setQuote(null);
      setReceived('');
      setError('');
      setModal('payment');
      setPricingRevision((n) => n + 1);
    }
  }, [cart.length, pricingPending, pricingError]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (submittedInput.current) return;
      if (
        e.key === 'F2' ||
        e.code === 'F2' ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        focusScanner();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        openPayment();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        openPayment();
      }
      if (
        e.key === 'F6' &&
        session?.permissions?.includes('pos-online-orders')
      ) {
        e.preventDefault();
        void showOnlineOrders();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openPayment, session, focusScanner]);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'stage_pos_product_search',
          description:
            'Filtra el catálogo visible del POS. No crea ventas ni modifica stock.',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string', maxLength: 100 } },
            required: ['query'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute(input: any) {
            if (
              !input ||
              typeof input.query !== 'string' ||
              input.query.length > 100 ||
              Object.keys(input).some((k) => k !== 'query')
            )
              throw new Error('Búsqueda inválida');
            setSearch(input.query);
            setCategory('Todos');
            return { query: input.query, staged: true };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  function paymentInput(baseOverride?: number) {
    const payableBase = baseOverride ?? base;
    const firstPaymentBase = split ? firstBase : payableBase;
    const payments = [
      {
        methodId: method,
        baseMinor: firstPaymentBase,
        receivedMinor: method === 'cash' ? minor(received) : undefined,
        reference,
      },
    ];
    if (split)
      payments.push({
        methodId: secondMethod,
        baseMinor: payableBase - firstPaymentBase,
        receivedMinor: secondMethod === 'cash' ? minor(received) : undefined,
        reference,
      });
    return {
      items: cart.map((x) => ({ variantId: x.id, quantity: x.quantity })),
      customerId: customer?.id ?? null,
      promotionId: null,
      promotionIds: offerIds,
      couponCode: couponCode.trim() || undefined,
      ...manualDiscountInput,
      autoPromotions: true,
      excludedPromotionIds,
      payments,
    };
  }
  async function review() {
    setBusy(true);
    setError('');
    try {
      const pricing = await api('pricing', {
        items: cart.map((item) => ({
          variantId: item.id,
          quantity: item.quantity,
        })),
        customerId: customer?.id ?? null,
        promotionId: null,
        promotionIds: offerIds,
        couponCode: couponCode.trim() || undefined,
        ...manualDiscountInput,
        autoPromotions: true,
        excludedPromotionIds,
        methodIds: split ? [method, secondMethod] : [method],
      });
      setCartPricing(pricing);
      const input = paymentInput(pricing.base);
      const q = await api('quote', input);
      reviewedInput.current = input;
      setQuote(q);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function resetNewSale() {
    setCart([]);
    setCustomer(null);
    setCustomerQuery('');
    setCustomers([]);
    setOfferIds([]);
    setCouponCode('');
    setManualDiscountValue('');
    setManualDiscountType('%');
    setExcludedPromotionIds([]);
    setQuote(null);
    setCartPricing(null);
    setMethod(
      methods.some((m) => m.id === 'cash')
        ? 'cash'
        : (methods.find((m) => m.id !== 'cashback' && m.id !== 'store_credit')
            ?.id ?? 'cash'),
    );
    setSecondMethod(
      methods.find(
        (m) =>
          m.id !== 'cash' && m.id !== 'cashback' && m.id !== 'store_credit',
      )?.id ?? 'debit',
    );
    setSplit(false);
    setSplitAmount('');
    setReceived('');
    setReference('');
    setCreditBalance(0);
    setSearch('');
    setCategory('Todos');
    setSelected(null);
    setColor('');
    setSize('');
    reviewedInput.current = null;
  }
  function clearSubmittedSale() {
    if (recoveryKey) localStorage.removeItem(recoveryKey);
    submittedInput.current = null;
    setPendingSale(null);
  }
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      let pending = submittedInput.current;
      if (!pending && localStorage.getItem(recoveryKey)) {
        pending = JSON.parse(localStorage.getItem(recoveryKey)!);
        submittedInput.current = pending;
        setPendingSale(pending);
        setQuote(pending?.quote ?? null);
        throw new Error(
          'Hay un cobro pendiente de otra pestaña. Recuperá primero ese ticket.',
        );
      }
      if (!pending) {
        if (!reviewedInput.current || !quote)
          throw new Error('Revisá el pago antes de confirmar.');
        pending = {
          payload: {
            ...reviewedInput.current,
            expectedTotalMinor: quote.total,
            idempotencyKey: crypto.randomUUID(),
          },
          quote,
        };
        // Persist before sending. Retrying or reloading must submit exactly the
        // same payload and key until the server establishes the outcome.
        localStorage.setItem(recoveryKey, JSON.stringify(pending));
        submittedInput.current = pending;
        setPendingSale(pending);
      }
      const result = await api('sales', pending.payload);
      clearSubmittedSale();
      resetNewSale();
      setReceipt(result);
      setModal('receipt');
      await refresh().catch(() =>
        setError(
          'Venta registrada. No se pudo actualizar el catálogo; actualizá antes de la próxima venta.',
        ),
      );
      setSectionRevision((n) => n + 1);
    } catch (e: any) {
      if (e instanceof ApiError && e.saleNotCommitted) {
        clearSubmittedSale();
        setQuote(null);
        reviewedInput.current = null;
      }
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function showRecent() {
    setError('');
    try {
      setRecent(await api('sales?scope=pos'));
      setModal('recent');
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function showOnlineOrders() {
    setError('');
    setBusy(true);
    try {
      setOnlineOrders(await api('pos-online-orders'));
      setModal('online-orders');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function showOnlineOrder(orderId: string) {
    setError('');
    setBusy(true);
    try {
      setOnlineOrder(
        await api('pos-online-orders?id=' + encodeURIComponent(orderId)),
      );
      setModal('online-order');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function updateOnlineOrder(
    action: 'prepare' | 'ready-pickup' | 'deliver',
  ) {
    if (!onlineOrder) return;
    setError('');
    setBusy(true);
    try {
      const updated = await api('pos-online-orders', {
        action,
        orderId: onlineOrder.id,
      });
      setOnlineOrder(updated);
      setOnlineOrders(await api('pos-online-orders'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function openAuthorizedRefund() {
    if (!receipt) return;
    setRefundReason('');
    setRefundToken('');
    setRefundMethod('original');
    setRefundItems({});
    setError('');
    setModal('refund');
  }
  async function submitAuthorizedRefund() {
    if (!receipt) return;
    setBusy(true);
    setError('');
    try {
      const items = receipt.items
        .map((item: Row) => ({
          saleItemId: item.id,
          quantity: refundItems[item.id] ?? 0,
        }))
        .filter((item: Row) => item.quantity > 0);
      if (!items.length)
        throw new Error('Seleccioná al menos una prenda para devolver.');
      await api('refunds', {
        saleId: receipt.id,
        reason: refundReason,
        method: refundMethod,
        items,
        ...(refundToken ? { authorizationToken: refundToken.trim() } : {}),
      });
      setReceipt(await api('sales?scope=pos&id=' + receipt.id));
      await refresh();
      setSectionRevision((n) => n + 1);
      setModal('receipt');
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function initialize(demo: boolean) {
    setBusy(true);
    setError('');
    try {
      await api('setup', { demo });
      await reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (sessionError)
    return (
      <main className="welcome">
        <div className="wordmark">FRAGUAN</div>
        <h1>Tu espacio de trabajo.</h1>
        <p>{sessionError}</p>
        <a className="login-link" href="/acceso?returnTo=%2Fpos" target="_top">
          Ingresar con Google <ArrowUpRight size={18} />
        </a>
      </main>
    );
  if (session?.needsSetup)
    return (
      <main className="welcome">
        <p className="eyebrow">BIENVENIDO A TU PRÓXIMA ETAPA</p>
        <div className="wordmark">FRAGUAN</div>
        <h1>
          Todo tu negocio.
          <br />
          En un solo lugar.
        </h1>
        <p>
          Activá tu espacio privado como administrador.
          <br />
          Podés explorar con una colección de demostración.
        </p>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <Button
          className="activate"
          disabled={busy}
          onClick={() => initialize(true)}
        >
          {busy ? 'Preparando tu espacio…' : 'Comenzar con datos de prueba'}
          <ArrowUpRight />
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => initialize(false)}
        >
          Comenzar con el negocio vacío
        </Button>
        <small>Los medios de pago iniciales son ejemplos configurables.</small>
      </main>
    );
  return (
    <div
      className={`pos-shell pos-proposal ${view !== 'sale' ? 'pos-history' : ''}`}
    >
      <header className="topbar">
        <a className="wordmark" href="/pos">
          FRAGUAN<span>POS</span>
        </a>
        <div className="pos-header-search">
          {' '}
          <label className="pos-search-label" htmlFor="pos-product-search">
            Buscar producto
          </label>
          <div className="search-row">
            <Search />
            <Input
              id="pos-product-search"
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const code = search.trim();
                  if (!code) return;
                  const v = catalog.find(
                    (x) => x.barcode === code || x.sku === code,
                  );
                  if (v) add(v);
                  else if (filtered.length === 1) {
                    setError('');
                    setSelected(filtered[0]);
                    setColor(filtered[0].variants[0].color);
                    setSize('');
                  } else
                    setError(
                      filtered.length
                        ? 'Hay varios productos. Elegí la variante o escaneá su código exacto.'
                        : `No se encontró el código “${code}”. Revisá el producto o buscá por nombre.`,
                    );
                }
              }}
              placeholder="Buscar producto (F2)"
              aria-describedby="pos-search-help"
              maxLength={100}
              autoFocus
            />
            <ScanBarcode aria-hidden="true" />
          </div>
          <p className="pos-search-help sr-only" id="pos-search-help">
            Hacé clic en el campo y escaneá con el lector. Enter agrega la
            prenda a la venta.
          </p>
        </div>
        <nav className="pos-tabs" aria-label="Pantalla del POS">
          {(
            [
              ['sale', 'Venta'],
              ['returns', 'Devoluciones'],
              ['summary', 'Resumen'],
              ['promotions', 'Promos'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              className={view === key ? 'selected' : ''}
              variant="outline"
              onClick={() => setView(key)}
              aria-current={view === key ? 'page' : undefined}
            >
              {label}
            </Button>
          ))}
        </nav>
        <div className="user-chip">
          {session?.permissions?.includes('dashboard') && (
            <a className="admin-entry" title="Administración" href="/admin">
              <LayoutDashboard size={18} />
              <span>Administración</span>
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              localStorage.setItem('fraguan-theme', !dark ? 'dark' : 'light');
              setDark(!dark);
            }}
            aria-label="Cambiar tema"
          >
            {dark ? <Sun /> : <Moon />}
          </Button>
          <span className="avatar">{session?.user?.name?.[0] ?? 'F'}</span>
          <span>
            {session?.user?.name?.split('@')[0] ?? 'Cargando…'}
            <small className="user-time">{clock}</small>
          </span>
          {!session?.openAccess && <InternalSignOut />}
        </div>
      </header>
      <div className="pos-body">
        <main className="catalog">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PUNTO DE VENTA</p>
              <h1>
                Nueva venta<span>.</span>
              </h1>
              <p>Buscá por nombre o SKU, o escaneá el código de barras.</p>
            </div>
            <div className="pos-heading-actions">
              <Button variant="outline" onClick={showRecent}>
                <Clock3 /> Ventas recientes
              </Button>
              {session?.permissions?.includes('pos-online-orders') && (
                <Button variant="outline" onClick={showOnlineOrders}>
                  <PackageCheck /> Pedidos online
                </Button>
              )}
            </div>
          </div>
          {error && !modal && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          <div className="chips">
            {['Todos', ...new Set(catalog.map((x) => x.category))].map((x) => (
              <Button
                key={x}
                className={category === x ? 'selected' : ''}
                variant="ghost"
                onClick={() => setCategory(x)}
              >
                {x}
              </Button>
            ))}
          </div>
          <div className="catalog-caption">
            <span>{filtered.length} productos disponibles</span>
            <span>Elegí un producto para seleccionar color y talle</span>
          </div>
          <div className="product-grid">
            {filtered.map((p) => (
              <button
                className="product-card"
                key={p.productId}
                onClick={() => {
                  setSelected(p);
                  setColor(p.variants[0].color);
                  setSize('');
                }}
              >
                <div className="product-text-header">
                  <span>{p.brand}</span>
                  <Plus size={17} />
                </div>
                <div className="product-copy">
                  <span className="eyebrow">{p.category}</span>
                  <h3>{p.name}</h3>
                  <p className="product-availability">
                    {p.variants.reduce((n: number, v: Row) => n + v.stock, 0)}{' '}
                    unidades disponibles ·{' '}
                    {[...new Set(p.variants.map((v: Row) => v.color))].join(
                      ' / ',
                    )}
                  </p>
                  <div className="product-meta">
                    <strong>{money(p.price)}</strong>
                    <span>
                      {[
                        ...new Set(
                          p.variants
                            .filter((v: Row) => v.stock > 0)
                            .map((v: Row) => v.size),
                        ),
                      ].join(' · ')}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {catalogLoading && <LoadingState label="Cargando colección…" />}
          {!catalogLoading && !filtered.length && (
            <div className="empty-state">
              {session
                ? 'No encontramos prendas. Probá otra búsqueda o cargá tu primera colección.'
                : 'Cargando colección…'}
            </div>
          )}
          <footer className="catalog-footer">
            <ScanBarcode size={15} /> Listo para escanear{' '}
            <span>F2 Buscar · F4 Cobrar · F6 Pedidos</span>
          </footer>
        </main>
        <aside className={`cart ${cartOpen ? 'open' : ''}`} id="current-cart">
          <button
            type="button"
            className="cart-heading"
            aria-expanded={cartOpen}
            aria-controls="pos-cart-details"
            onClick={() => setCartOpen(!cartOpen)}
          >
            <h2>Venta actual</h2>
            <span className="count">
              {cart.reduce((n, i) => n + i.quantity, 0)}
            </span>
            <span className="cart-toggle" aria-hidden="true">
              {cartOpen ? '▾' : '▴'}
            </span>
          </button>
          <div id="pos-cart-details" className="pos-cart-details">
            <div className="pos-customer-inline">
              {customer ? (
                <div className="pos-customer-selected">
                  <span>
                    <b>
                      {customer.name} {customer.surname}
                    </b>
                    <small>{customer.phone}</small>
                  </span>
                  <Button
                    variant="ghost"
                    aria-label="Quitar cliente"
                    onClick={() => {
                      setCustomer(null);
                      setCustomerQuery('');
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="pos-customer-search">
                    <Input
                      value={customerQuery}
                      onChange={(e) => setCustomerQuery(e.target.value)}
                      placeholder="Cliente (nombre o celular)"
                      aria-label="Buscar cliente de la venta"
                      autoComplete="off"
                      maxLength={100}
                    />
                    <Button
                      variant="outline"
                      onClick={() => setModal('customer')}
                    >
                      + Nuevo
                    </Button>
                  </div>
                  {customerQuery.trim().length >= 2 && (
                    <div className="pos-customer-matches">
                      {customers.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setCustomer(c);
                            setCustomerQuery('');
                          }}
                        >
                          <b>
                            {c.name} {c.surname}
                          </b>
                          <small>{c.phone}</small>
                        </button>
                      ))}
                      {!customers.length && (
                        <small>
                          Buscá por nombre o celular, o creá un cliente.
                        </small>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            {cart.length ? (
              <div className="cart-items">
                {cart.map((i) => (
                  <div className="cart-item" key={i.id}>
                    <div>
                      <h3>{i.name}</h3>
                      <p>
                        {i.color} · {i.size}
                      </p>
                      <div className="quantity">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Disminuir cantidad"
                          onClick={() => {
                            setCart(
                              cart.flatMap((x) =>
                                x.id === i.id
                                  ? x.quantity > 1
                                    ? [{ ...x, quantity: x.quantity - 1 }]
                                    : []
                                  : [x],
                              ),
                            );
                          }}
                        >
                          <Minus size={12} />
                        </Button>
                        <span>{i.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Aumentar cantidad"
                          onClick={() => add(i)}
                        >
                          <Plus size={12} />
                        </Button>
                      </div>
                    </div>
                    <div className="item-price">
                      <strong>{money(currentPrice(i) * i.quantity)}</strong>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Quitar producto"
                        onClick={() => {
                          setCart(cart.filter((x) => x.id !== i.id));
                        }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cart-empty">
                <div className="bag-circle">
                  <ShoppingBag size={34} strokeWidth={1.2} />
                </div>
                <h3>La venta está vacía</h3>
                <p>Buscá o escaneá un producto para agregarlo.</p>
              </div>
            )}
          </div>
          <div className="cart-bottom">
            <div className="pos-cart-discounts">
              {canDiscount && (
                <div className="pos-manual-discount">
                  <select
                    value={manualDiscountType}
                    onChange={(e) => setManualDiscountType(e.target.value)}
                    aria-label="Tipo de descuento manual"
                  >
                    <option value="%">Desc. %</option>
                    <option value="$">Desc. $</option>
                  </select>
                  <Input
                    inputMode="decimal"
                    value={manualDiscountValue}
                    onChange={(e) => setManualDiscountValue(e.target.value)}
                    placeholder="0"
                    aria-label="Descuento manual"
                  />
                </div>
              )}
              <div className="summary-line">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              {cartPricing?.appliedDiscounts?.map((p: Row) => (
                <div className="pos-applied-promo" key={p.promotionId}>
                  <span>{p.name}</span>
                  <b>−{money(p.amount)}</b>
                  <Button
                    variant="ghost"
                    aria-label={'Quitar promoción ' + p.name}
                    onClick={() => {
                      setExcludedPromotionIds((ids) => [...ids, p.promotionId]);
                      setOfferIds((ids) =>
                        ids.filter((id) => id !== p.promotionId),
                      );
                    }}
                  >
                    ×
                  </Button>
                </div>
              ))}
              {!!excludedPromotionIds.length && (
                <Button
                  className="pos-restore-promos"
                  variant="ghost"
                  onClick={() => setExcludedPromotionIds([])}
                >
                  Restaurar promociones
                </Button>
              )}
              <Input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Cupón de descuento"
                aria-label="Cupón de descuento"
                autoComplete="off"
                maxLength={50}
              />
              {canDiscount && (
                <div className="summary-line">
                  <span>Descuento manual</span>
                  <span>
                    {manualDiscountMinor > 0
                      ? '−' + money(manualDiscountMinor)
                      : '—'}
                  </span>
                </div>
              )}
            </div>
            {pricingPending && (
              <output className="quiet" aria-live="polite">
                Calculando total…
              </output>
            )}
            {pricingError && (
              <p className="notice" role="alert">
                {pricingError}
              </p>
            )}
            <div className="total-line">
              <span>Total</span>
              <strong>{money(base)}</strong>
            </div>
            <div className="pos-sale-actions">
              <Button
                variant="outline"
                disabled={!cart.length || busy}
                onClick={() => {
                  if (!submittedInput.current) resetNewSale();
                }}
              >
                Vaciar
              </Button>
              <Button
                className="checkout"
                disabled={
                  !cart.length || busy || pricingPending || !!pricingError
                }
                onClick={openPayment}
              >
                Cobrar <kbd>F4</kbd>
              </Button>
            </div>
          </div>
        </aside>
        {view !== 'sale' && session && (
          <PosSections
            key={sectionRevision}
            view={view}
            session={{
              ...session,
              categories: [...new Set(catalog.map((p) => p.category))],
            }}
            onPromotionsChanged={refresh}
            onSale={async (id, refund) => {
              const ticket = await api(
                'sales?scope=pos&id=' + encodeURIComponent(id),
              );
              setReceipt(ticket);
              setError('');
              if (
                refund &&
                ['confirmed', 'partially_refunded'].includes(ticket.status)
              ) {
                setRefundReason('');
                setRefundToken('');
                setRefundMethod('original');
                setRefundItems({});
                setModal('refund');
              } else setModal('receipt');
            }}
          />
        )}
      </div>
      {cart.length > 0 && (
        <a className="mobile-cart" href="#current-cart">
          Ver venta · {cart.reduce((n, i) => n + i.quantity, 0)} productos ·{' '}
          {money(base)}
        </a>
      )}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="fraguan-modal pos-proposal-dialog">
          <DialogTitle>{selected?.name}</DialogTitle>
          <DialogDescription>
            Elegí la combinación para esta venta.
          </DialogDescription>
          <label>Color</label>
          <div className="choices">
            {[
              ...new Set(selected?.variants.map((v: Row) => v.color) ?? []),
            ].map((c: any) => (
              <Button
                variant={color === c ? 'default' : 'outline'}
                key={c}
                onClick={() => {
                  setColor(c);
                  setSize('');
                }}
              >
                {c}
              </Button>
            ))}
          </div>
          <label>Talle</label>
          <div className="choices">
            {selected?.variants
              .filter((v: Row) => v.color === color)
              .map((v: Row) => (
                <Button
                  key={v.id}
                  disabled={!v.stock}
                  variant={size === v.size ? 'default' : 'outline'}
                  onClick={() => setSize(v.size)}
                >
                  {v.size}
                </Button>
              ))}
          </div>
          {size && (
            <p className="variant-info">
              {money(
                selected?.variants.find(
                  (v: Row) => v.color === color && v.size === size,
                )?.price,
              )}{' '}
              · Stock:{' '}
              {
                selected?.variants.find(
                  (v: Row) => v.color === color && v.size === size,
                )?.stock
              }
            </p>
          )}
          <Button
            className="activate"
            disabled={!size}
            onClick={() =>
              add(
                selected!.variants.find(
                  (v: Row) => v.color === color && v.size === size,
                ),
              )
            }
          >
            Agregar a la venta <Plus />
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!modal}
        onOpenChange={(o) => {
          if (!o && !busy && !submittedInput.current) {
            setModal('');
            setError('');
          }
        }}
      >
        <DialogContent
          className={
            modal === 'receipt'
              ? 'fraguan-modal pos-proposal-dialog receipt-modal'
              : modal === 'online-orders' || modal === 'online-order'
                ? 'fraguan-modal pos-proposal-dialog pos-online-modal'
                : 'fraguan-modal pos-proposal-dialog'
          }
        >
          <DialogTitle>
            {(
              {
                customer: 'Cliente de la venta',
                payment: 'Cobrar venta',
                receipt:
                  receipt?.status === 'refunded'
                    ? 'Venta devuelta'
                    : receipt?.status === 'partially_refunded'
                      ? 'Venta con devolución parcial'
                      : 'Venta completada',
                recent: 'Ventas recientes',
                'online-orders': 'Pedidos de la tienda online',
                'online-order': onlineOrder
                  ? `Pedido #${onlineOrder.orderNumber}`
                  : 'Pedido online',
                refund: 'Cambio o devolución autorizada',
              } as Row
            )[modal] ?? 'FRAGUAN'}
          </DialogTitle>
          <DialogDescription>
            {modal === 'payment'
              ? 'Elegí cómo paga el cliente.'
              : modal === 'recent'
                ? 'Consultá un ticket para una operación autorizada.'
                : modal === 'online-orders'
                  ? 'Prepará y entregá pedidos pagos con la información necesaria para trabajar.'
                  : modal === 'online-order'
                    ? 'Ubicá las prendas y avanzá el pedido sin acceder a datos financieros.'
                    : modal === 'refund'
                      ? 'Ingresá la autorización del responsable y las prendas que vuelven al stock.'
                      : 'FRAGUAN · Punto de venta'}
          </DialogDescription>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {modal === 'customer' && (
            <>
              <Input
                placeholder="Buscar nombre o teléfono…"
                aria-label="Buscar cliente"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                maxLength={100}
              />
              <div className="customer-results">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCustomer(c);
                      setModal('');
                    }}
                  >
                    <UserRound size={17} />
                    <span>
                      {c.name} {c.surname}
                      <small>{c.phone}</small>
                    </span>
                    <Plus size={15} />
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setCustomer(null);
                  setModal('');
                }}
              >
                Continuar con cliente ocasional
              </Button>
              <form
                className="quick-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError('');
                  const f = new FormData(e.currentTarget);
                  try {
                    setCustomer(
                      await api('customers', {
                        name: f.get('name'),
                        surname: f.get('surname'),
                        phone: f.get('phone'),
                      }),
                    );
                    setModal('');
                  } catch (err: any) {
                    setError(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <h3>Crear cliente</h3>
                <Input
                  name="name"
                  placeholder="Nombre"
                  aria-label="Nombre"
                  minLength={2}
                  maxLength={80}
                  required
                />
                <Input
                  name="surname"
                  placeholder="Apellido"
                  aria-label="Apellido"
                  minLength={2}
                  maxLength={80}
                  required
                />
                <Input
                  name="phone"
                  placeholder="Teléfono"
                  aria-label="Teléfono"
                  required
                  minLength={5}
                  maxLength={25}
                />
                <Button type="submit" disabled={busy}>
                  Crear y agregar
                </Button>
              </form>
            </>
          )}
          {modal === 'payment' && (
            <fieldset className="pos-payment-fields" disabled={busy}>
              {pendingSale && (
                <output className="notice">
                  El resultado de este cobro está pendiente. Reintentá la misma
                  operación para recuperar el ticket sin duplicar la venta.
                  Mantené esta pestaña abierta.
                </output>
              )}
              {pricingPending && !pendingSale && (
                <output>Actualizando precios y promociones…</output>
              )}
              {pricingError && !pendingSale && (
                <p className="notice" role="alert">
                  {pricingError}
                </p>
              )}
              <div className="payment-total">
                <span>TOTAL A COBRAR</span>
                <strong>{money(quote?.total ?? estimatedTotal)}</strong>
              </div>
              {quote ? (
                <>
                  <div className="review-lines">
                    {quote.appliedDiscounts?.map((promotion: Row) => (
                      <p key={promotion.promotionId}>
                        {promotion.name}
                        <strong>−{money(promotion.amount)}</strong>
                      </p>
                    ))}
                    {quote.payments.map((p: Row, i: number) => (
                      <p key={i}>
                        {p.name}
                        <strong>{money(p.amount)}</strong>
                        {p.change > 0 && (
                          <small>Vuelto: {money(p.change)}</small>
                        )}
                      </p>
                    ))}
                  </div>
                  <p className="quiet">
                    Confirmá una vez verificado el cobro en efectivo, terminal o
                    aplicación.
                  </p>
                  <Button
                    className="activate"
                    disabled={busy}
                    onClick={confirm}
                  >
                    {busy
                      ? 'Guardando venta…'
                      : pendingSale
                        ? 'Reintentar y recuperar ticket'
                        : 'Confirmar venta'}
                    <Check />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy || !!pendingSale}
                    onClick={() => {
                      setQuote(null);
                      reviewedInput.current = null;
                    }}
                  >
                    Volver al pago
                  </Button>
                </>
              ) : (
                <>
                  <div className="payment-methods">
                    {methods
                      .filter(
                        (m) =>
                          m.id !== 'cashback' &&
                          (m.id !== 'store_credit' || Boolean(customer)),
                      )
                      .map((m) => (
                        <Button
                          key={m.id}
                          variant={method === m.id ? 'default' : 'outline'}
                          onClick={() => {
                            setMethod(m.id);
                            setOfferIds([]);
                          }}
                        >
                          {m.name}
                          {m.id === 'store_credit' && creditBalance > 0
                            ? ` · ${money(creditBalance)}`
                            : ''}
                        </Button>
                      ))}
                  </div>
                  {selectedMethod && selectedMethod.installments > 1 && (
                    <p className="variant-info">
                      {selectedMethod?.installments} cuotas de{' '}
                      {money(
                        Math.round(
                          surcharge(firstBase, selectedMethod) /
                            selectedMethod.installments,
                        ),
                      )}{' '}
                      · Total {money(surcharge(firstBase, selectedMethod))}
                    </p>
                  )}
                  <details className="pos-discounts">
                    <summary>
                      Descuentos y cupones
                      {offerIds.length || couponCode ? ' · seleccionados' : ''}
                    </summary>
                    <label>Promociones autorizadas</label>
                    <div className="promotion-options">
                      {offers.map((promotion) => {
                        const selectedPromotion =
                          offerIds.includes(promotion.id) ||
                          Boolean(
                            cartPricing?.appliedDiscounts?.some(
                              (p: Row) => p.promotionId === promotion.id,
                            ),
                          );
                        return (
                          <Button
                            key={promotion.id}
                            type="button"
                            variant={selectedPromotion ? 'default' : 'outline'}
                            onClick={() => {
                              setExcludedPromotionIds((ids) =>
                                selectedPromotion
                                  ? [...new Set([...ids, promotion.id])]
                                  : ids.filter((id) => id !== promotion.id),
                              );
                              setOfferIds(
                                selectedPromotion
                                  ? offerIds.filter((id) => id !== promotion.id)
                                  : [...offerIds, promotion.id],
                              );
                            }}
                          >
                            {promotion.name}
                          </Button>
                        );
                      })}
                      {!offers.length && (
                        <p className="quiet">No hay promociones vigentes.</p>
                      )}
                    </div>
                    <label>
                      Cupón (opcional)
                      <Input
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value)}
                        placeholder="Ingresar código"
                        maxLength={50}
                      />
                    </label>
                  </details>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSplit(!split);
                      setOfferIds([]);
                    }}
                  >
                    {split ? 'Usar un solo medio' : 'Dividir pago'}
                  </Button>
                  {split && (
                    <div className="quick-form">
                      <label>
                        Importe base del primer medio
                        <Input
                          inputMode="decimal"
                          value={splitAmount}
                          onChange={(e) => setSplitAmount(e.target.value)}
                          placeholder="Ej. 50000"
                        />
                      </label>
                      <label>
                        Resto con
                        <select
                          value={secondMethod}
                          onChange={(e) => setSecondMethod(e.target.value)}
                        >
                          {methods
                            .filter(
                              (m) =>
                                m.id !== method &&
                                m.id !== 'cashback' &&
                                (m.id !== 'store_credit' || Boolean(customer)),
                            )
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    </div>
                  )}
                  {(method === 'cash' ||
                    (split && secondMethod === 'cash')) && (
                    <>
                      <label>
                        Efectivo recibido
                        <Input
                          inputMode="decimal"
                          value={received}
                          onChange={(e) => setReceived(e.target.value)}
                          placeholder="Ej. 60000"
                        />
                      </label>
                      <div className="pos-cash-quick">
                        {[
                          ...new Set([
                            Math.ceil(cashDue / 100),
                            Math.ceil(cashDue / 100000) * 1000,
                            Math.ceil(cashDue / 500000) * 5000,
                            Math.ceil(cashDue / 1000000) * 10000,
                          ]),
                        ].map((amount) => (
                          <Button
                            key={amount}
                            variant="outline"
                            onClick={() => setReceived(String(amount))}
                          >
                            {money(amount * 100)}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                  {(method !== 'cash' ||
                    (split && secondMethod !== 'cash')) && (
                    <label>
                      Referencia del cobro (opcional)
                      <Input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="N.º de operación"
                        maxLength={120}
                      />
                    </label>
                  )}
                  <div className="pos-payment-summary">
                    <div>
                      <span>Total</span>
                      <b>{money(estimatedTotal)}</b>
                    </div>
                    {estimatedTotal > base && (
                      <div>
                        <span>Recargo de los medios</span>
                        <b>{money(estimatedTotal - base)}</b>
                      </div>
                    )}
                    {!!cashDue && (
                      <div>
                        <span>Efectivo a cobrar</span>
                        <b>{money(cashDue)}</b>
                      </div>
                    )}
                    {!!cashDue && (
                      <div className="pos-payment-balance">
                        <span>
                          {cashReceived >= cashDue
                            ? 'Vuelto'
                            : 'Falta en efectivo'}
                        </span>
                        <b>{money(Math.abs(cashReceived - cashDue))}</b>
                      </div>
                    )}
                    {split && (
                      <small>
                        El primer medio cubre {money(firstBase)} de base y el
                        segundo {money(base - firstBase)}.
                      </small>
                    )}
                  </div>
                  <Button
                    className="activate"
                    disabled={
                      busy ||
                      pricingPending ||
                      !!pricingError ||
                      firstBase <= 0 ||
                      (split && firstBase >= base)
                    }
                    onClick={review}
                  >
                    {busy ? 'Validando…' : 'Revisar cobro'}
                    <ArrowUpRight />
                  </Button>
                </>
              )}
            </fieldset>
          )}
          {modal === 'receipt' && receipt && (
            <>
              <div className="pos-printer-slot" aria-hidden="true" />
              <div className="pos-ticket-feed">
                <div className="receipt">
                  <div className="receipt-check">
                    <Check />
                  </div>
                  <h2>FRAGUAN</h2>
                  <p>
                    Ticket #{String(receipt.ticket).padStart(6, '0')} ·{' '}
                    {date(receipt.createdAt)}
                  </p>
                  <p>
                    {receipt.customerName
                      ? `${receipt.customerName} ${receipt.customerSurname}`
                      : 'Cliente ocasional'}
                  </p>
                  {receipt.items.map((i: Row) => (
                    <div className="receipt-line" key={i.id}>
                      <span>
                        {i.name}
                        <small>
                          {i.color} · {i.size} · {i.quantity} × {money(i.price)}
                          {i.refunded > 0 &&
                            ` · ${i.refunded} devuelta${i.refunded === 1 ? '' : 's'}`}
                        </small>
                      </span>
                      <strong>{money(i.quantity * i.price)}</strong>
                    </div>
                  ))}
                  <div className="summary-line">
                    <span>Subtotal</span>
                    <span>{money(receipt.subtotal)}</span>
                  </div>
                  <div className="summary-line">
                    <span>Descuento</span>
                    <span>−{money(receipt.discount)}</span>
                  </div>
                  <div className="total-line">
                    <span>
                      {receipt.returned > 0 ? 'Total original' : 'Total'}
                    </span>
                    <strong>{money(receipt.total)}</strong>
                  </div>
                  {receipt.payments?.map((payment: Row, index: number) => (
                    <div className="summary-line" key={index}>
                      <span>{payment.name}</span>
                      <span>{money(payment.amount)}</span>
                    </div>
                  ))}
                  {receipt.returned > 0 && (
                    <>
                      <div className="summary-line">
                        <span>Devuelto</span>
                        <b>−{money(receipt.returned)}</b>
                      </div>
                      <div className="total-line">
                        <span>Venta menos devoluciones</span>
                        <strong>{money(receipt.remaining)}</strong>
                      </div>
                      {receipt.refunds?.map((r: Row) => (
                        <div className="receipt-line" key={r.id}>
                          <span>
                            {date(r.createdAt)} · {r.reason}
                            <small>
                              {r.method === 'credit'
                                ? 'Saldo a favor'
                                : 'Medio original'}
                            </small>
                          </span>
                          <b>−{money(r.amount)}</b>
                        </div>
                      ))}
                    </>
                  )}
                  <p className="quiet">
                    Comprobante interno · No válido como factura fiscal.
                  </p>
                </div>
              </div>
              <Button
                className="activate no-print"
                onClick={() => {
                  setModal('');
                  setReceipt(null);
                  setReference('');
                  searchRef.current?.focus();
                }}
              >
                Nueva venta <ArrowUpRight />
              </Button>
              <Button
                className="no-print"
                variant="outline"
                onClick={() => printCommerce('receipt')}
              >
                <Printer /> Imprimir ticket
              </Button>
              {['confirmed', 'partially_refunded'].includes(receipt.status) && (
                <Button
                  className="no-print"
                  variant="outline"
                  onClick={openAuthorizedRefund}
                >
                  <RotateCcw /> Cambio o devolución autorizada
                </Button>
              )}
            </>
          )}
          {modal === 'refund' && receipt && (
            <div className="quick-form">
              <p className="quiet">
                Seleccioná las prendas y cantidades que devuelve el cliente.
              </p>
              {receipt.items.map((item: Row) => {
                const available = item.quantity - item.refunded;
                return (
                  <label key={item.id}>
                    {item.name} · {item.color} · {item.size} · máximo{' '}
                    {available}
                    <div className="pos-refund-quantity">
                      <Button
                        variant="outline"
                        aria-label={'Devolver menos ' + item.name}
                        disabled={!refundItems[item.id]}
                        onClick={() =>
                          setRefundItems({
                            ...refundItems,
                            [item.id]: Math.max(
                              0,
                              (refundItems[item.id] ?? 0) - 1,
                            ),
                          })
                        }
                      >
                        −
                      </Button>
                      <b>{refundItems[item.id] ?? 0}</b>
                      <Button
                        variant="outline"
                        aria-label={'Devolver más ' + item.name}
                        disabled={(refundItems[item.id] ?? 0) >= available}
                        onClick={() =>
                          setRefundItems({
                            ...refundItems,
                            [item.id]: (refundItems[item.id] ?? 0) + 1,
                          })
                        }
                      >
                        +
                      </Button>
                    </div>
                  </label>
                );
              })}
              <label>
                Resolución
                <select
                  value={refundMethod}
                  onChange={(event) => setRefundMethod(event.target.value)}
                >
                  <option value="original">
                    Reintegrar por el medio original
                  </option>
                  {receipt.customerId && (
                    <option value="credit">Emitir saldo a favor</option>
                  )}
                </select>
              </label>
              <label>
                Motivo
                <Input
                  value={refundReason}
                  onChange={(event) => setRefundReason(event.target.value)}
                  placeholder="Ej. Cambio de talle autorizado"
                  minLength={5}
                  list="pos-refund-reasons"
                />
                <datalist
                  id="pos-refund-reasons"
                  aria-label="Motivos de devolución"
                >
                  <option value="Cambio de talle">Cambio de talle</option>
                  <option value="Falla o defecto">Falla o defecto</option>
                  <option value="Cambio de opinión">Cambio de opinión</option>
                </datalist>
              </label>
              {['VENDEDOR', 'CAJA'].includes(session?.user?.role) && (
                <label>
                  Código de autorización del responsable
                  <Input
                    value={refundToken}
                    onChange={(event) => setRefundToken(event.target.value)}
                    placeholder="Código válido por 10 minutos"
                  />
                </label>
              )}
              <Button
                className="activate"
                disabled={
                  busy ||
                  !Object.values(refundItems).some(
                    (quantity) => quantity > 0,
                  ) ||
                  refundReason.trim().length < 5 ||
                  (['VENDEDOR', 'CAJA'].includes(session?.user?.role) &&
                    !refundToken.trim())
                }
                onClick={submitAuthorizedRefund}
              >
                {busy ? 'Registrando…' : 'Registrar devolución'}
                <ShieldCheck />
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => setModal('receipt')}
              >
                Volver al ticket
              </Button>
            </div>
          )}
          {modal === 'recent' && (
            <div className="recent-list">
              {recent.length ? (
                recent.map((s) => (
                  <button
                    key={s.id}
                    onClick={async () => {
                      try {
                        setReceipt(await api('sales?scope=pos&id=' + s.id));
                        setModal('receipt');
                      } catch (e: any) {
                        setError(e.message);
                      }
                    }}
                  >
                    <span>
                      #{String(s.ticket).padStart(6, '0')}
                      <small>
                        {date(s.createdAt)} ·{' '}
                        {s.status === 'refunded'
                          ? 'Devuelta'
                          : s.status === 'partially_refunded'
                            ? 'Devuelta parcialmente'
                            : 'Completada'}
                      </small>
                    </span>
                    <strong>{money(s.total)}</strong>
                    <ArrowUpRight size={16} />
                  </button>
                ))
              ) : (
                <p className="empty-state">Todavía no hay ventas recientes.</p>
              )}
            </div>
          )}
          {modal === 'online-orders' && (
            <div className="pos-online-list">
              {onlineOrders.length ? (
                onlineOrders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => showOnlineOrder(String(order.id))}
                  >
                    <span className="pos-online-icon">
                      <Store size={18} />
                    </span>
                    <span className="pos-online-copy">
                      <strong>
                        #{order.orderNumber} · {order.customerName}
                      </strong>
                      <small>
                        {order.shippingMethod === 'pickup'
                          ? 'Retiro en local'
                          : 'Envío por Correo Argentino'}{' '}
                        · {date(order.createdAt)}
                      </small>
                    </span>
                    <span
                      className={`pos-order-status status-${order.fulfillmentStatus}`}
                    >
                      {{
                        unfulfilled: 'Por preparar',
                        preparing: 'Preparando',
                        ready_pickup: 'Listo para retirar',
                        shipped: 'Despachado',
                        delivered: 'Entregado',
                      }[order.fulfillmentStatus as string] ??
                        order.fulfillmentStatus}
                    </span>
                    <ArrowUpRight size={16} />
                  </button>
                ))
              ) : (
                <p className="empty-state">No hay pedidos pagos pendientes.</p>
              )}
            </div>
          )}
          {modal === 'online-order' && onlineOrder && (
            <div className="pos-online-detail">
              <div className="pos-online-summary">
                <span>
                  <small>Cliente</small>
                  <strong>{onlineOrder.customerName}</strong>
                  <small>{onlineOrder.phone}</small>
                </span>
                <span>
                  <small>Entrega</small>
                  <strong>
                    {onlineOrder.shippingMethod === 'pickup'
                      ? 'Retiro en local'
                      : 'Correo Argentino'}
                  </strong>
                  {onlineOrder.trackingNumber && (
                    <small>{onlineOrder.trackingNumber}</small>
                  )}
                </span>
              </div>
              <div className="pos-picking-list">
                <h3>Prendas a preparar</h3>
                {onlineOrder.items?.map((item: Row, index: number) => (
                  <article key={`${item.sku}-${index}`}>
                    <span>
                      <strong>{item.productName}</strong>
                      <small>
                        {item.color} · Talle {item.size} · SKU {item.sku}
                      </small>
                      <em>{item.location}</em>
                    </span>
                    <b>{item.quantity} u.</b>
                  </article>
                ))}
              </div>
              {onlineOrder.fulfillmentStatus === 'unfulfilled' && (
                <Button
                  className="activate"
                  disabled={busy}
                  onClick={() => updateOnlineOrder('prepare')}
                >
                  <PackageCheck />{' '}
                  {busy ? 'Actualizando…' : 'Empezar preparación'}
                </Button>
              )}
              {onlineOrder.fulfillmentStatus === 'preparing' &&
                onlineOrder.shippingMethod === 'pickup' && (
                  <Button
                    className="activate"
                    disabled={busy}
                    onClick={() => updateOnlineOrder('ready-pickup')}
                  >
                    <Check />{' '}
                    {busy ? 'Actualizando…' : 'Marcar listo para retirar'}
                  </Button>
                )}
              {onlineOrder.fulfillmentStatus === 'ready_pickup' && (
                <Button
                  className="activate"
                  disabled={busy}
                  onClick={() => updateOnlineOrder('deliver')}
                >
                  <Check />{' '}
                  {busy ? 'Actualizando…' : 'Registrar entrega al cliente'}
                </Button>
              )}
              {onlineOrder.fulfillmentStatus === 'preparing' &&
                onlineOrder.shippingMethod !== 'pickup' && (
                  <p className="notice neutral">
                    Administración completará el despacho y el seguimiento de
                    Correo Argentino.
                  </p>
                )}
              {['shipped', 'delivered'].includes(
                onlineOrder.fulfillmentStatus,
              ) && (
                <p className="notice neutral">
                  Este pedido ya fue{' '}
                  {onlineOrder.fulfillmentStatus === 'delivered'
                    ? 'entregado'
                    : 'despachado'}
                  .
                </p>
              )}
              <Button
                variant="ghost"
                disabled={busy}
                onClick={showOnlineOrders}
              >
                Volver a pedidos
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
