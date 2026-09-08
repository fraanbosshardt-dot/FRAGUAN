'use client';
import {
  ArrowRight,
  Gift,
  LogOut,
  Package,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { StoreProductCard } from '@/components/store-product-card';
import { GoogleSignIn } from '@/components/google-sign-in';
import {
  StoreProduct,
  storeApi,
  storeMoney,
  useStoreFavorites,
} from '@/lib/store-client';
export default function Account({ googleClientId }: { googleClientId: string }) {
  const [data, setData] = useState<any>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<StoreProduct[]>([]);
  const [profileState, setProfileState] = useState('');
  const { favorites } = useStoreFavorites();
  const load = () => storeApi('store-account').then(setData);
  useEffect(() => {
    load().catch((e) => setError(e.message));
    storeApi<{ products: StoreProduct[] }>('store-catalog')
      .then((result) => setCatalog(result.products))
      .catch(() => undefined);
  }, []);
  const savedProducts = catalog.filter((product) => favorites.includes(product.id));
  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(event.currentTarget);
    try {
      await storeApi('store-account', {
        method: 'POST',
        body: JSON.stringify({
          action: mode,
          email: f.get('email'),
          password: f.get('password'),
          name: f.get('name') || undefined,
          surname: f.get('surname') || undefined,
          phone: f.get('phone') || undefined,
          marketingConsent: Boolean(f.get('marketingConsent')),
        }),
      });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await storeApi('store-account', {
      method: 'POST',
      body: JSON.stringify({ action: 'logout' }),
    });
    setData({ customer: null, orders: [], cashback: 0 });
  }
  async function updateProfile(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setProfileState('Guardando…');
    const form = new FormData(event.currentTarget);
    try {
      await storeApi('store-account', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          name: form.get('name'),
          surname: form.get('surname'),
          phone: form.get('phone'),
          locality: form.get('locality'),
          usualSizes: form.get('usualSizes'),
          marketingConsent: Boolean(form.get('marketingConsent')),
        }),
      });
      await load();
      setProfileState('Datos actualizados.');
    } catch (cause: any) {
      setProfileState(cause.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="store-shell">
      <StoreHeader />
      <main className="store-account">
        {data?.customer ? (
          <>
            <header>
              <span>MI FRAGUAN</span>
              <h1>Hola, {data.customer.name}.</h1>
              <button onClick={logout}>
                <LogOut /> Salir
              </button>
            </header>
            <section className="store-account-metrics">
              <article>
                <Sparkles />
                <span>Nivel</span>
                <strong>{data.customer.level}</strong>
                <small>Tu actividad del local y online, en un lugar.</small>
              </article>
              <article>
                <Gift />
                <span>Puntos</span>
                <strong>{data.customer.points}</strong>
                <small>Usalos en beneficios del Club.</small>
              </article>
              <article>
                <span>Cashback</span>
                <strong>{storeMoney(data.cashback)}</strong>
                <small>Saldo disponible en tu cuenta.</small>
              </article>
            </section>
            <section className="store-account-profile">
              <div>
                <span>TUS DATOS</span>
                <h2>Todo listo para comprar más rápido.</h2>
                <p>Guardá tu contacto, localidad y talles habituales.</p>
              </div>
              <form onSubmit={updateProfile}>
                <label>Nombre<input name="name" defaultValue={data.customer.name} required /></label>
                <label>Apellido<input name="surname" defaultValue={data.customer.surname} required /></label>
                <label>Teléfono<input name="phone" defaultValue={data.customer.phone} required /></label>
                <label>Localidad<input name="locality" defaultValue={data.customer.locality} /></label>
                <label className="wide">Talles habituales<input name="usualSizes" defaultValue={data.customer.usualSizes} placeholder="Ej. Remeras L, pantalones 42" /></label>
                <label className="store-consent wide"><input name="marketingConsent" type="checkbox" defaultChecked={data.customer.marketingConsent} /> Quiero recibir novedades y beneficios.</label>
                <button className="store-auth-submit wide" disabled={busy}>Guardar mis datos <ArrowRight /></button>
                {profileState && <small className="wide">{profileState}</small>}
              </form>
            </section>
            {!!data.addresses?.length && <section className="store-account-orders"><div><span>TUS DIRECCIONES</span><h2>Entrega más rápida</h2></div><div className="store-address-list">{data.addresses.map((address: any) => <article key={address.id}><strong>{address.label}{address.isDefault ? ' · Principal' : ''}</strong><p>{address.address}{address.addressExtra ? `, ${address.addressExtra}` : ''}<br />{address.postalCode} · {address.city}, {address.province}</p></article>)}</div></section>}
            <section className="store-account-orders">
              <div>
                <span>TUS COMPRAS</span>
                <h2>Pedidos online</h2>
              </div>
              {data.orders.length ? (
                data.orders.map((order: any) => (
                  <a className="store-account-order-link" href={`/pedido/${order.id}`} key={order.id}>
                    <Package />
                    <span>
                      <strong>Pedido #{order.orderNumber}</strong>
                      <small>
                        {new Date(order.createdAt).toLocaleDateString('es-AR')}{' '}
                        ·{' '}
                        {order.paymentStatus === 'paid'
                          ? 'Pago confirmado'
                          : 'Pago pendiente'}
                      </small>
                    </span>
                    <b>{storeMoney(order.total)}</b>
                    <em>
                      {order.fulfillmentStatus === 'shipped'
                        ? 'Despachado'
                        : order.fulfillmentStatus === 'preparing'
                          ? 'Preparando'
                          : 'Recibido'}
                    </em>
                  </a>
                ))
              ) : (
                <div className="store-account-empty">
                  <Package />
                  <h3>Todavía no tenés pedidos online.</h3>
                  <a href="/tienda">
                    Explorar la colección <ArrowRight />
                  </a>
                </div>
              )}
            </section>
            <section className="store-account-orders">
              <div>
                <span>TUS FAVORITOS</span>
                <h2>Prendas guardadas</h2>
              </div>
              {savedProducts.length ? (
                <div className="store-product-grid">
                  {savedProducts.map((product, index) => (
                    <StoreProductCard product={product} index={index} key={product.id} />
                  ))}
                </div>
              ) : (
                <div className="store-account-empty">
                  <Gift />
                  <h3>Todavía no guardaste prendas.</h3>
                  <a href="/tienda">Explorar la colección <ArrowRight /></a>
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="store-login">
            <div className="store-login-copy">
              <span>MI FRAGUAN</span>
              <h1>Tu estilo también tiene memoria.</h1>
              <p>
                Uní tus compras del local y online. Guardá tus datos, seguí
                pedidos y acumulá beneficios.
              </p>
              <div>
                <p>
                  <Package /> Historial y seguimiento
                </p>
                <p>
                  <Gift /> Puntos y cashback
                </p>
                <p>
                  <UserRound /> Checkout más rápido
                </p>
              </div>
            </div>
            <form onSubmit={submit}>
              <GoogleSignIn clientId={googleClientId} onError={setError} />
              <div className="store-auth-separator"><span>o continuá con email</span></div>
              <div className="store-auth-tabs">
                <button
                  type="button"
                  className={mode === 'login' ? 'active' : ''}
                  onClick={() => setMode('login')}
                >
                  Ingresar
                </button>
                <button
                  type="button"
                  className={mode === 'register' ? 'active' : ''}
                  onClick={() => setMode('register')}
                >
                  Crear cuenta
                </button>
              </div>
              {mode === 'register' && (
                <>
                  <label>
                    Nombre
                    <input name="name" required />
                  </label>
                  <label>
                    Apellido
                    <input name="surname" required />
                  </label>
                  <label>
                    Teléfono
                    <input name="phone" required />
                  </label>
                </>
              )}
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                Contraseña
                <input name="password" type="password" minLength={8} required />
                <small>Mínimo 8 caracteres</small>
              </label>
              {mode === 'register' && (
                <label className="store-consent">
                  <input name="marketingConsent" type="checkbox" /> Quiero
                  recibir novedades y beneficios.
                </label>
              )}
              {error && <p className="store-buy-error">{error}</p>}
              <button className="store-auth-submit" disabled={busy}>
                {busy
                  ? 'Procesando…'
                  : mode === 'login'
                    ? 'Ingresar'
                    : 'Crear mi cuenta'}
                <ArrowRight />
              </button>
              <p className="store-auth-note">Al continuar aceptás los <a href="/informacion/terminos">Términos</a> y la <a href="/informacion/privacidad">Política de privacidad</a>.</p>
            </form>
          </section>
        )}
      </main>
      <StoreFooter />
    </div>
  );
}
