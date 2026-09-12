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
const ARGENTINA_PROVINCES = ['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'] as const;
export default function Account({
  googleClientId,
  passwordAuthEnabled,
}: {
  googleClientId: string;
  passwordAuthEnabled: boolean;
}) {
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
    setData({ customer: null, orders: [], addresses: [], benefits: [] });
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
          country: form.get('country'),
          postalCode: form.get('postalCode'),
          address: form.get('address'),
          addressExtra: form.get('addressExtra') || '',
          city: form.get('city'),
          province: form.get('province'),
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
  const primaryAddress = data?.addresses?.[0];
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
                <span>Beneficios</span>
                <strong>Por tus compras</strong>
                <small>{data.benefits?.[0] || 'Te avisamos cuando tengas un beneficio disponible.'}</small>
              </article>
              <article>
                <UserRound />
                <span>Dirección</span>
                <strong>{primaryAddress ? 'Lista para usar' : 'Completala una vez'}</strong>
                <small>La sugerimos al comprar y siempre podés usar otra.</small>
              </article>
            </section>
            <section className="store-account-profile">
              <div>
                <span>TUS DATOS</span>
                <h2>Todo listo para comprar más rápido.</h2>
                <p>Guardá tu contacto y dirección principal. En cada compra podés confirmarla, editarla o usar otra.</p>
              </div>
              <form onSubmit={updateProfile}>
                <label>Nombre<input name="name" autoComplete="name" maxLength={80} defaultValue={data.customer.name} required /></label>
                <label>Apellido<input name="surname" autoComplete="name" maxLength={80} defaultValue={data.customer.surname} required /></label>
                <label>Teléfono<input name="phone" type="tel" autoComplete="tel" maxLength={25} defaultValue={data.customer.phone} required /></label>
                <label>País<select name="country" autoComplete="country-name" defaultValue={primaryAddress?.country || 'Argentina'} required><option>Argentina</option></select></label>
                <label>Dirección<input name="address" autoComplete="street-address" maxLength={100} placeholder="Calle y número" defaultValue={primaryAddress?.address || ''} required /></label>
                <label>Piso / departamento <small>Opcional</small><input name="addressExtra" autoComplete="address-line2" maxLength={50} defaultValue={primaryAddress?.addressExtra || ''} /></label>
                <label>Ciudad / localidad<input name="city" autoComplete="address-level2" maxLength={60} defaultValue={primaryAddress?.city || ''} required /></label>
                <label>Provincia<select name="province" autoComplete="address-level1" defaultValue={primaryAddress?.province || ''} required><option value="" disabled>Seleccionar</option>{ARGENTINA_PROVINCES.map((province) => <option key={province}>{province}</option>)}</select></label>
                <label>Código postal<input name="postalCode" autoComplete="postal-code" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} defaultValue={primaryAddress?.postalCode || ''} required /></label>
                <label className="store-consent wide"><input name="marketingConsent" type="checkbox" defaultChecked={data.customer.marketingConsent} /> Quiero recibir novedades y beneficios.</label>
                <button className="store-auth-submit wide" disabled={busy}>Guardar mis datos <ArrowRight /></button>
                {profileState && <small className="wide">{profileState}</small>}
              </form>
            </section>
            {data.addresses?.length > 1 && <section className="store-account-orders"><div><span>OTRAS DIRECCIONES</span><h2>Direcciones usadas</h2></div><div className="store-address-list">{data.addresses.slice(1).map((address: any) => <article key={address.id}><strong>{address.label}</strong><p>{address.address}{address.addressExtra ? `, ${address.addressExtra}` : ''}<br />{address.postalCode} · {address.city}, {address.province} · {address.country}</p></article>)}</div></section>}
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
                  <a href="/">
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
                  <a href="/">Explorar la colección <ArrowRight /></a>
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
                  <Gift /> Beneficios según tus compras
                </p>
                <p>
                  <UserRound /> Checkout más rápido
                </p>
              </div>
            </div>
            <form onSubmit={submit}>
              <GoogleSignIn clientId={googleClientId} onError={setError} />
              {passwordAuthEnabled && <div className="store-auth-separator"><span>o continuá con email</span></div>}
              {passwordAuthEnabled && <>
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
                    <input name="name" autoComplete="name" maxLength={80} required />
                  </label>
                  <label>
                    Apellido
                    <input name="surname" autoComplete="name" maxLength={80} required />
                  </label>
                  <label>
                    Teléfono
                    <input name="phone" type="tel" autoComplete="tel" maxLength={25} required />
                  </label>
                </>
              )}
              <label>
                Email
                <input name="email" type="email" autoComplete="email" maxLength={200} required />
              </label>
              <label>
                Contraseña
                <input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} maxLength={128} required />
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
              </>}
            </form>
          </section>
        )}
      </main>
      <StoreFooter />
    </div>
  );
}
