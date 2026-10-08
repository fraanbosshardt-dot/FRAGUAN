'use client';

import { useEffect, useState } from 'react';
import { DesignProductGrid } from '@/components/store-design';
import {
  AnimatedLabel,
  AnimatedForm,
  RollingText,
} from '@/components/store-motion';
import { GoogleSignIn } from '@/components/google-sign-in';
import { fulfillmentLabels } from '@/lib/store-order-status';
import {
  StoreProduct,
  storeApi,
  storeMoney,
  useStoreFavorites,
} from '@/lib/store-client';
const ARGENTINA_PROVINCES = [
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
] as const;
export default function Account({
  googleClientId,
  passwordAuthEnabled,
}: {
  googleClientId: string;
  passwordAuthEnabled: boolean;
}) {
  const [data, setData] = useState<any>(null);
  const [accountGoogleClientId, setAccountGoogleClientId] =
    useState(googleClientId);
  const [panel, setPanel] = useState('datos');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [catalog, setCatalog] = useState<StoreProduct[]>([]);
  const [profileState, setProfileState] = useState('');
  const { favorites } = useStoreFavorites();
  const load = () =>
    storeApi('store-account').then((result) => {
      setData(result);
      if (result.googleClientId)
        setAccountGoogleClientId(result.googleClientId);
      dispatchEvent(
        new CustomEvent('fraguan-account', { detail: result.customer }),
      );
      return result;
    });
  useEffect(() => {
    load().catch((e) => setError(e.message));
    storeApi<{ products: StoreProduct[] }>('store-catalog')
      .then((result) => setCatalog(result.products))
      .catch(() => undefined);
  }, []);
  const savedProducts = catalog.filter((product) =>
    favorites.includes(product.id),
  );
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
    dispatchEvent(new CustomEvent('fraguan-account', { detail: null }));
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
  const field = (
    label: string,
    name: string,
    value = '',
    extra: Record<string, any> = {},
  ) => (
    <AnimatedLabel className="fi">
      {label}
      <input
        name={name}
        defaultValue={value}
        required
        maxLength={100}
        {...extra}
      />
    </AnimatedLabel>
  );
  return (
    <section
      className={`sec lt pg ${data?.customer ? 'account-profile' : 'account-entry'}`}
    >
      {data?.customer ? (
        <div className="account-profile-content">
          <b className="k">MI FRAGUAN</b>
          <h1 className="d account-profile-title">
            Hola, {data.customer.name}
          </h1>
          <div className="pills">
            <button
              className={panel === 'datos' ? 'on' : ''}
              onClick={() => setPanel('datos')}
            >
              MIS DATOS
            </button>
            <button
              className={panel === 'pedidos' ? 'on' : ''}
              onClick={() => {
                setPanel('pedidos');
                load().catch((e) => setError(e.message));
              }}
            >
              MIS PEDIDOS ({data.orders.length})
            </button>
            <button
              className={panel === 'favoritos' ? 'on' : ''}
              onClick={() => setPanel('favoritos')}
            >
              FAVORITOS ({favorites.length})
            </button>
            <button onClick={() => logout().catch((e) => setError(e.message))}>
              SALIR
            </button>
          </div>
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
          {panel === 'datos' && (
            <>
              <p style={{ marginBottom: 16 }}>
                Completá tus datos para tus próximas compras. También podés
                actualizarlos al hacer un pedido.
              </p>
              <AnimatedForm
                onSubmit={updateProfile}
                className="account-profile-form"
                key={data.customer.id}
              >
                <div className="row">
                  {field('NOMBRE', 'name', data.customer.name, {
                    autoComplete: 'given-name',
                    maxLength: 80,
                  })}
                  {field('APELLIDO', 'surname', data.customer.surname, {
                    autoComplete: 'family-name',
                    maxLength: 80,
                  })}
                </div>
                {field('TELÉFONO', 'phone', data.customer.phone, {
                  type: 'tel',
                  autoComplete: 'tel',
                  maxLength: 25,
                })}
                <input name="country" type="hidden" value="Argentina" />
                {field(
                  'CALLE Y NÚMERO',
                  'address',
                  primaryAddress?.address || '',
                  { autoComplete: 'street-address' },
                )}
                {field(
                  'PISO / DEPARTAMENTO (OPCIONAL)',
                  'addressExtra',
                  primaryAddress?.addressExtra || '',
                  {
                    required: false,
                    autoComplete: 'address-line2',
                    maxLength: 50,
                  },
                )}
                <div className="row">
                  {field('CIUDAD', 'city', primaryAddress?.city || '', {
                    autoComplete: 'address-level2',
                    maxLength: 60,
                  })}
                  <label className="fi account-province">
                    <span>PROVINCIA</span>
                    <select
                      name="province"
                      defaultValue={primaryAddress?.province || ''}
                      autoComplete="address-level1"
                      required
                    >
                      <option value="" disabled>
                        Elegí tu provincia
                      </option>
                      {ARGENTINA_PROVINCES.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  {field(
                    'CÓD. POSTAL',
                    'postalCode',
                    primaryAddress?.postalCode || '',
                    {
                      pattern: '[0-9]{4}',
                      maxLength: 4,
                      inputMode: 'numeric',
                      autoComplete: 'postal-code',
                    },
                  )}
                </div>
                <AnimatedLabel className="design-consent">
                  <input
                    name="marketingConsent"
                    type="checkbox"
                    defaultChecked={data.customer.marketingConsent}
                  />
                  Quiero recibir novedades y beneficios.
                </AnimatedLabel>
                <div className="account-profile-actions">
                  <button className="btn a" disabled={busy}>
                    {busy ? 'GUARDANDO…' : 'GUARDAR'}
                  </button>
                  <output
                    className="account-profile-status"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {profileState}
                  </output>
                </div>
              </AnimatedForm>
              <div className="design-benefits">
                <b className="k">TUS BENEFICIOS</b>
                {data.benefits?.length ? (
                  data.benefits.map((b: string) => <p key={b}>{b}</p>)
                ) : (
                  <p>Todavía no tenemos beneficios disponibles para vos.</p>
                )}
              </div>
              {data.addresses?.length > 1 && (
                <details>
                  <summary>OTRAS DIRECCIONES</summary>
                  {data.addresses.slice(1).map((a: any) => (
                    <p key={a.id}>
                      {a.address} · {a.city}, {a.province} ({a.postalCode})
                    </p>
                  ))}
                </details>
              )}
            </>
          )}
          {panel === 'pedidos' &&
            (data.orders.length ? (
              data.orders.map((o: any) => (
                <a
                  className="ord design-order-link"
                  key={o.id}
                  href={'/pedido/' + o.id}
                >
                  <b>
                    Pedido #{o.orderNumber} ·{' '}
                    {new Date(o.createdAt).toLocaleDateString('es-AR')}
                  </b>
                  <p>
                    {storeMoney(o.total)} ·{' '}
                    {o.paymentStatus === 'paid'
                      ? 'Pago confirmado'
                      : 'Pago pendiente'}
                  </p>
                  <p>
                    {o.status === 'cancelled'
                      ? 'Cancelado'
                      : fulfillmentLabels[o.fulfillmentStatus] || 'Recibido'}
                  </p>
                  <span className="k">VER PEDIDO →</span>
                </a>
              ))
            ) : (
              <p className="em0">Todavía no hiciste pedidos.</p>
            ))}
          {panel === 'favoritos' && (
            <DesignProductGrid products={savedProducts} />
          )}
        </div>
      ) : (
        <div className="account-entry-content">
          <b className="k">MI FRAGUAN</b>
          <h1 className="d account-entry-title">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h1>
          <p className="account-entry-description">
            {mode === 'login'
              ? 'Entrá para ver tus pedidos, tus favoritos y tus datos.'
              : 'Creá tu cuenta con Google y guardá tus pedidos, favoritos y datos para tu próxima compra.'}
          </p>
          <div className="account-entry-tabs" aria-label="Opciones de acceso">
            <button
              type="button"
              aria-pressed={mode === 'login'}
              className={mode === 'login' ? 'on' : ''}
              onClick={() => {
                setMode('login');
                setError('');
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              aria-pressed={mode === 'register'}
              className={mode === 'register' ? 'on' : ''}
              onClick={() => {
                setMode('register');
                setError('');
              }}
            >
              Crear cuenta
            </button>
          </div>
          <AnimatedForm onSubmit={submit} key={mode}>
            {passwordAuthEnabled && (
              <>
                {mode === 'register' && (
                  <>
                    <div className="row">
                      {field('NOMBRE', 'name', '', {
                        autoComplete: 'given-name',
                        maxLength: 80,
                      })}
                      {field('APELLIDO', 'surname', '', {
                        autoComplete: 'family-name',
                        maxLength: 80,
                      })}
                    </div>
                    {field('TELÉFONO', 'phone', '', {
                      type: 'tel',
                      autoComplete: 'tel',
                      maxLength: 25,
                    })}
                  </>
                )}
                {field('EMAIL', 'email', '', {
                  type: 'email',
                  autoComplete: 'email',
                  maxLength: 200,
                })}
                {field(
                  mode === 'register' ? 'CONTRASEÑA (8+)' : 'CONTRASEÑA',
                  'password',
                  '',
                  {
                    type: 'password',
                    minLength: 8,
                    maxLength: 128,
                    autoComplete:
                      mode === 'login' ? 'current-password' : 'new-password',
                  },
                )}
                {mode === 'register' && (
                  <AnimatedLabel className="design-consent">
                    <input name="marketingConsent" type="checkbox" />
                    Quiero recibir novedades y beneficios.
                  </AnimatedLabel>
                )}
                {error && (
                  <p className="err" role="alert">
                    {error}
                  </p>
                )}
                <button className="btn a" disabled={busy}>
                  <RollingText>
                    {busy
                      ? 'PROCESANDO…'
                      : mode === 'login'
                        ? 'INGRESAR'
                        : 'CREAR MI CUENTA'}
                  </RollingText>
                </button>
              </>
            )}
            {accountGoogleClientId && (
              <div className="account-entry-google">
                {passwordAuthEnabled && (
                  <p className="account-entry-separator">
                    O continuá con Google
                  </p>
                )}
                <GoogleSignIn
                  clientId={accountGoogleClientId}
                  onError={setError}
                  buttonText={mode === 'login' ? 'signin_with' : 'signup_with'}
                />
              </div>
            )}
            {!data && !error && <output>Cargando opciones de acceso…</output>}
            {!passwordAuthEnabled && error && (
              <p className="err" role="alert">
                {error}
              </p>
            )}
            {!passwordAuthEnabled && data && !accountGoogleClientId && (
              <p className="err">
                El acceso a cuentas todavía no está configurado.
              </p>
            )}
            <p className="design-form-note">
              Al continuar aceptás los{' '}
              <a href="/informacion/terminos">Términos</a> y la{' '}
              <a href="/informacion/privacidad">Política de privacidad</a>.
            </p>
            {!passwordAuthEnabled && accountGoogleClientId && (
              <p className="account-entry-help">
                {mode === 'login'
                  ? '¿Es tu primera vez? Elegí Crear cuenta. Si continuás con Google y todavía no tenés cuenta, se crea automáticamente.'
                  : 'Si ya tenés una cuenta con este email, Google te permite entrar sin crear otra.'}
              </p>
            )}
          </AnimatedForm>
        </div>
      )}
    </section>
  );
}
