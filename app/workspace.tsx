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
  LogOut,
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
} from '@/lib/client';
export default function Workspace() {
  const { session, error: sessionError, reload } = useSession(),
    clock = useClock();
  const [catalog, setCatalog] = useState<Row[]>([]),
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
    [dark, setDark] = useState(false),
    [reference, setReference] = useState(''),
    [creditBalance, setCreditBalance] = useState(0),
    [refundReason, setRefundReason] = useState(''),
    [refundToken, setRefundToken] = useState(''),
    [refundMethod, setRefundMethod] = useState('original'),
    [refundItems, setRefundItems] = useState<Record<string, number>>({});
  const searchRef = useRef<HTMLInputElement>(null),
    requestKey = useRef('');
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
    if (modal !== 'customer') return;
    const t = setTimeout(
      () =>
        api('customers?q=' + encodeURIComponent(customerQuery))
          .then(setCustomers)
          .catch((e) => setError(e.message)),
      220,
    );
    return () => clearTimeout(t);
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
  const subtotal = cart.reduce((n, i) => n + i.price * i.quantity, 0),
    promotion =
      offerIds.length === 1 ? offers.find((o) => o.id === offerIds[0]) : null,
    discount =
      promotion && (!promotion.kind || promotion.kind === 'percentage')
        ? Math.floor((subtotal * promotion.percent) / 100)
        : 0,
    base = subtotal - discount;
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
  const add = (variant: Row) => {
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
    requestKey.current = '';
    setSearch('');
    searchRef.current?.focus();
  };
  const openPayment = useCallback(() => {
    if (cart.length) {
      setQuote(null);
      setReceived('');
      setError('');
      setModal('payment');
    }
  }, [cart.length]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === 'F2' ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        setModal('customer');
      }
      if (e.key === 'F8') {
        e.preventDefault();
        openPayment();
      }
      if (e.key === 'F6' && session?.permissions?.includes('pos-online-orders')) {
        e.preventDefault();
        void showOnlineOrders();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openPayment, session]);
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
        methodIds: split ? [method, secondMethod] : [method],
      });
      const q = await api('quote', paymentInput(pricing.base));
      setQuote(q);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      requestKey.current ||= crypto.randomUUID();
      const result = await api('sales', {
        ...paymentInput(quote?.base),
        idempotencyKey: requestKey.current,
      });
      setReceipt(result);
      setModal('receipt');
      setCart([]);
      setCustomer(null);
      setOfferIds([]);
      setCouponCode('');
      setQuote(null);
      requestKey.current = '';
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function showRecent() {
    setError('');
    try {
      setRecent(await api('sales'));
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
  async function updateOnlineOrder(action: 'prepare' | 'ready-pickup' | 'deliver') {
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
      await api('refunds', {
        saleId: receipt.id,
        reason: refundReason,
        method: refundMethod,
        ...(items.length ? { items } : {}),
        ...(refundToken ? { authorizationToken: refundToken.trim() } : {}),
      });
      setReceipt(await api('sales?id=' + receipt.id));
      await refresh();
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
        <a
          className="login-link"
          href="/signin-with-chatgpt?return_to=%2Fpos"
          target="_top"
        >
          Ingresar con ChatGPT <ArrowUpRight size={18} />
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
    <div className="pos-shell">
      <header className="topbar">
        <a className="wordmark" href="/pos">
          FRAGUAN<span>EST. ARGENTINA</span>
        </a>
        <div className="top-label">
          Punto de venta{' '}
          {session?.demo && <span className="demo-pill">DEMOSTRACIÓN</span>}
        </div>
        <div className="user-chip">
          {session?.permissions?.includes('dashboard') && (
            <a
              className="admin-entry"
              title="Administración"
              href="/admin-access?returnTo=%2Fadmin%2Fdashboard"
            >
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
          <a
            href="/signout-with-chatgpt?return_to=%2Fpos"
            title="Cerrar sesión"
          >
            <LogOut size={15} />
          </a>
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
          <div className="search-row">
            <Search />
            <Input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = catalog.find(
                    (x) => x.barcode === search || x.sku === search,
                  );
                  if (v) add(v);
                  else if (filtered.length === 1) {
                    setSelected(filtered[0]);
                    setColor(filtered[0].variants[0].color);
                    setSize('');
                  }
                }
              }}
              placeholder="Buscar producto, código o escanear…"
              aria-label="Buscar productos"
              autoFocus
            />
            <kbd>F2</kbd>
            <ScanBarcode />
          </div>
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
            <span>F2 Buscar · F4 Cliente · F6 Pedidos · F8 Cobrar</span>
          </footer>
        </main>
        <aside className="cart" id="current-cart">
          <div className="cart-heading">
            <h2>Venta actual</h2>
            <span className="count">
              {cart.reduce((n, i) => n + i.quantity, 0)}
            </span>
          </div>
          <button
            className="customer-line"
            onClick={() => setModal('customer')}
          >
            <span className="customer-icon">
              <UserRound size={18} />
            </span>
            <span>
              {customer
                ? `${customer.name} ${customer.surname}`
                : 'Cliente ocasional'}
              <small>
                {customer ? 'Cambiar cliente' : 'Agregar cliente a la venta'}
              </small>
            </span>
            <Plus size={18} />
          </button>
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
                          requestKey.current = '';
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
                    <strong>{money(i.price * i.quantity)}</strong>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Quitar producto"
                      onClick={() => {
                        setCart(cart.filter((x) => x.id !== i.id));
                        requestKey.current = '';
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
          <div className="cart-bottom">
            <div className="summary-line">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <div className="summary-line">
              <span>Descuentos autorizados</span>
              <span>{discount ? `−${money(discount)}` : '—'}</span>
            </div>
            <div className="total-line">
              <span>Total</span>
              <strong>{money(base)}</strong>
            </div>
            <Button
              className="checkout"
              disabled={!cart.length || busy}
              onClick={openPayment}
            >
              Cobrar <ArrowUpRight size={20} />
            </Button>
            <p className="quiet">F8 para cobrar</p>
          </div>
        </aside>
      </div>
      {cart.length > 0 && (
        <a className="mobile-cart" href="#current-cart">
          Ver venta · {cart.reduce((n, i) => n + i.quantity, 0)} productos ·{' '}
          {money(base)}
        </a>
      )}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="fraguan-modal">
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
          if (!o && !busy) {
            setModal('');
            setError('');
          }
        }}
      >
        <DialogContent
          className={
            modal === 'receipt'
              ? 'fraguan-modal receipt-modal'
              : modal === 'online-orders' || modal === 'online-order'
                ? 'fraguan-modal pos-online-modal'
              : 'fraguan-modal'
          }
        >
          <DialogTitle>
            {(
              {
                customer: 'Cliente de la venta',
                payment: 'Cobrar venta',
                receipt: 'Venta completada',
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
                  required
                />
                <Input
                  name="surname"
                  placeholder="Apellido"
                  aria-label="Apellido"
                  required
                />
                <Input
                  name="phone"
                  placeholder="Teléfono"
                  aria-label="Teléfono"
                  required
                  minLength={5}
                />
                <Button type="submit" disabled={busy}>
                  Crear y agregar
                </Button>
              </form>
            </>
          )}
          {modal === 'payment' && (
            <>
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
                    {busy ? 'Guardando venta…' : 'Confirmar venta'}
                    <Check />
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setQuote(null);
                      requestKey.current = '';
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
                  {selectedMethod?.installments > 1 && (
                    <p className="variant-info">
                      {selectedMethod?.installments} cuotas · Total{' '}
                      {money(surcharge(firstBase, selectedMethod))}
                    </p>
                  )}
                  <label>Promociones autorizadas</label>
                  <div className="promotion-options">
                    {offers.map((promotion) => {
                      const selectedPromotion = offerIds.includes(promotion.id);
                      return (
                        <Button
                          key={promotion.id}
                          type="button"
                          variant={selectedPromotion ? 'default' : 'outline'}
                          onClick={() =>
                            setOfferIds(
                              selectedPromotion
                                ? offerIds.filter((id) => id !== promotion.id)
                                : [...offerIds, promotion.id],
                            )
                          }
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
                            .filter((m) => m.id !== method)
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
                    <label>
                      Efectivo recibido
                      <Input
                        inputMode="decimal"
                        value={received}
                        onChange={(e) => setReceived(e.target.value)}
                        placeholder="Ej. 60000"
                      />
                    </label>
                  )}
                  {method !== 'cash' && (
                    <label>
                      Referencia del cobro (opcional)
                      <Input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="N.º de operación"
                      />
                    </label>
                  )}
                  <Button
                    className="activate"
                    disabled={
                      busy || firstBase <= 0 || (split && firstBase >= base)
                    }
                    onClick={review}
                  >
                    {busy ? 'Validando…' : 'Revisar cobro'}
                    <ArrowUpRight />
                  </Button>
                </>
              )}
            </>
          )}
          {modal === 'receipt' && receipt && (
            <>
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
                      </small>
                    </span>
                    <strong>{money(i.quantity * i.price)}</strong>
                  </div>
                ))}
                <div className="total-line">
                  <span>Total</span>
                  <strong>{money(receipt.total)}</strong>
                </div>
                <p className="quiet">
                  Comprobante interno · No válido como factura fiscal.
                </p>
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
                Indicá las cantidades. Si todas quedan en cero se devolverá todo
                lo pendiente del ticket.
              </p>
              {receipt.items.map((item: Row) => {
                const available = item.quantity - item.refunded;
                return (
                  <label key={item.id}>
                    {item.name} · {item.color} · {item.size} · máximo{' '}
                    {available}
                    <Input
                      type="number"
                      min={0}
                      max={available}
                      disabled={!available}
                      value={refundItems[item.id] ?? 0}
                      onChange={(event) =>
                        setRefundItems({
                          ...refundItems,
                          [item.id]: Number(event.target.value),
                        })
                      }
                    />
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
                  {receipt.customerName && (
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
                />
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
                        setReceipt(await api('sales?id=' + s.id));
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
                    <span className="pos-online-icon"><Store size={18} /></span>
                    <span className="pos-online-copy">
                      <strong>#{order.orderNumber} · {order.customerName}</strong>
                      <small>
                        {order.shippingMethod === 'pickup' ? 'Retiro en local' : 'Envío por Correo Argentino'} · {date(order.createdAt)}
                      </small>
                    </span>
                    <span className={`pos-order-status status-${order.fulfillmentStatus}`}>
                      {{
                        unfulfilled: 'Por preparar',
                        preparing: 'Preparando',
                        ready_pickup: 'Listo para retirar',
                        shipped: 'Despachado',
                        delivered: 'Entregado',
                      }[order.fulfillmentStatus as string] ?? order.fulfillmentStatus}
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
                  <strong>{onlineOrder.shippingMethod === 'pickup' ? 'Retiro en local' : 'Correo Argentino'}</strong>
                  {onlineOrder.trackingNumber && <small>{onlineOrder.trackingNumber}</small>}
                </span>
              </div>
              <div className="pos-picking-list">
                <h3>Prendas a preparar</h3>
                {onlineOrder.items?.map((item: Row, index: number) => (
                  <article key={`${item.sku}-${index}`}>
                    <span>
                      <strong>{item.productName}</strong>
                      <small>{item.color} · Talle {item.size} · SKU {item.sku}</small>
                      <em>{item.location}</em>
                    </span>
                    <b>{item.quantity} u.</b>
                  </article>
                ))}
              </div>
              {onlineOrder.fulfillmentStatus === 'unfulfilled' && (
                <Button className="activate" disabled={busy} onClick={() => updateOnlineOrder('prepare')}>
                  <PackageCheck /> {busy ? 'Actualizando…' : 'Empezar preparación'}
                </Button>
              )}
              {onlineOrder.fulfillmentStatus === 'preparing' && onlineOrder.shippingMethod === 'pickup' && (
                <Button className="activate" disabled={busy} onClick={() => updateOnlineOrder('ready-pickup')}>
                  <Check /> {busy ? 'Actualizando…' : 'Marcar listo para retirar'}
                </Button>
              )}
              {onlineOrder.fulfillmentStatus === 'ready_pickup' && (
                <Button className="activate" disabled={busy} onClick={() => updateOnlineOrder('deliver')}>
                  <Check /> {busy ? 'Actualizando…' : 'Registrar entrega al cliente'}
                </Button>
              )}
              {onlineOrder.fulfillmentStatus === 'preparing' && onlineOrder.shippingMethod !== 'pickup' && (
                <p className="notice neutral">Administración completará el despacho y el seguimiento de Correo Argentino.</p>
              )}
              {['shipped', 'delivered'].includes(onlineOrder.fulfillmentStatus) && (
                <p className="notice neutral">Este pedido ya fue {onlineOrder.fulfillmentStatus === 'delivered' ? 'entregado' : 'despachado'}.</p>
              )}
              <Button variant="ghost" disabled={busy} onClick={showOnlineOrders}>Volver a pedidos</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
