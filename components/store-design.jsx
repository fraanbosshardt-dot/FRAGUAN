'use client';
import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  createContext,
  useMemo,
} from 'react';
import htm from 'htm';
import {
  RollingText,
  Odometer,
  useFluidGrid,
  ColorMedia,
  PhotoReveal,
  AnimatedLabel,
  AnimatedForm,
} from '@/components/store-motion';
import {
  volarAlCarrito,
  BarraEnvioGratis,
  EtiquetaTalle,
  HeroForja,
  ColeccionHover,
} from '@/components/fraguan-animaciones';
import { usePathname } from 'next/navigation';
import {
  storeApi,
  storeMoney,
  useStoreCart,
  useStoreFavorites,
  trackStore,
} from '@/lib/store-client';
import { StoreProductTrust } from '@/components/store-product-trust';
import { FREE_SHIPPING_MINIMUM_MINOR } from '@/lib/store-shipping-policy';
const matchText = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-AR');
const route = (h) =>
  h?.startsWith('#/')
    ? h
        .replace(/^#\/c\/todo$/, '/tienda')
        .replace(/^#\/c\//, '/coleccion/')
        .replace(/^#\/p\//, '/producto/')
        .replace(/^#\/info\/arrepentimiento$/, '/arrepentimiento')
        .replace(/^#\/info\//, '/informacion/')
        .replace(/^#/, '')
    : h;
const html = htm.bind((tag, props, ...children) => {
  if (props) {
    props = { ...props };
    if ('class' in props) {
      props.className = props.class;
      delete props.class;
    }
    if ('tabindex' in props) {
      props.tabIndex = props.tabindex;
      delete props.tabindex;
    }
    if (props.href) props.href = route(props.href);
  }
  if (tag === 'label') tag = AnimatedLabel;
  if (tag === 'form') tag = AnimatedForm;
  if (
    (tag === 'button' || tag === 'a') &&
    props?.className?.split(' ').includes('btn') &&
    children.every(
      (child) => typeof child === 'string' || typeof child === 'number',
    )
  ) {
    children = [React.createElement(RollingText, null, children)];
  }
  return React.createElement(tag, props, ...children);
});
const C = createContext(null),
  useC = () => useContext(C);
const $ = (n) => '$ ' + Math.round(n).toLocaleString('es-AR'),
  FREE = FREE_SHIPPING_MINIMUM_MINOR / 100,
  TONE = { Blanco: 'bone', Arena: 'sand', Negro: 'ink', Celeste: 'b2' },
  go = (h) => location.assign(route(h));
const T = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
  B = ['38', '40', '42', '44', '46', '48'];
const INFO = {
  envios: ['Envíos'],
  cambios: ['Cambios y devoluciones'],
  pagos: ['Pagos'],
  talles: ['Guía de talles'],
  contacto: ['Contacto'],
  terminos: ['Términos y condiciones'],
  privacidad: ['Privacidad'],
  cookies: ['Cookies'],
  arrepentimiento: ['Botón de arrepentimiento'],
};
const referenceOrder = [
  'Camisa Oxford',
  'Remera Essential',
  'Jean Slim Fit',
  'Camisa de lino',
  'Buzo Half Zip',
  'Pantalón Chino',
  'Remera Pima',
  'Campera Urban',
  'Chomba Classic',
  'Jean Straight',
];
const designProducts = (products) =>
  [...products]
    .sort((a, b) => {
      const ai = referenceOrder.indexOf(a.name),
        bi = referenceOrder.indexOf(b.name);
      return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
    })
    .map(designProduct);
export const designProduct = (p) => ({
  ...p,
  original: p,
  n: p.name,
  c: p.category,
  k:
    {
      'Camisa Oxford': 'OX',
      'Remera Essential': 'RE',
      'Jean Slim Fit': 'JF',
      'Camisa de lino': 'LI',
      'Buzo Half Zip': 'HZ',
      'Pantalón Chino': 'CH',
      'Remera Pima': 'PI',
      'Campera Urban': 'UR',
      'Chomba Classic': 'CC',
      'Jean Straight': 'JS',
    }[p.name] ||
    p.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join(''),
  p: p.price / 100,
  cols: [...new Set(p.variants.map((v) => v.color))],
  col: [...new Set(p.variants.map((v) => v.color))].join(' · '),
  z: [...new Set(p.variants.map((v) => v.size))].sort((a, b) => {
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    if (order.includes(a) && order.includes(b))
      return order.indexOf(a) - order.indexOf(b);
    return a.localeCompare(b, 'es', { numeric: true });
  }),
  low:
    p.variants.reduce((n, v) => n + v.stock, 0) > 0 &&
    p.variants.reduce((n, v) => n + v.stock, 0) < 10,
  img: p.imageUrl,
});
function useProg(ref) {
  const [p, s] = useState(0);
  useEffect(() => {
    let t;
    const f = () => {
      cancelAnimationFrame(t);
      t = requestAnimationFrame(() => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        s(Math.min(1, Math.max(0, -r.top / (r.height - innerHeight))));
      });
    };
    addEventListener('scroll', f, { passive: true });
    addEventListener('resize', f);
    f();
    return () => {
      removeEventListener('scroll', f);
      removeEventListener('resize', f);
      cancelAnimationFrame(t);
    };
  }, [ref]);
  return p;
}
function useSeen() {
  const r = useRef(),
    [v, s] = useState(false);
  useEffect(() => {
    const o = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          s(true);
          o.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    o.observe(r.current);
    return () => o.disconnect();
  }, []);
  return [r, v];
}
function Rv({ c = '', d = 0, children, animationKey }) {
  const [r, v] = useSeen();
  return html`<div
    ref=${r}
    data-fg-key=${animationKey}
    class=${'rv ' + (v ? 'in ' : '') + c}
    style=${{ transitionDelay: d + 'ms' }}
  >
    ${children}
  </div>`;
}
function Count({ to, suf = '' }) {
  const [r, v] = useSeen(),
    [n, s] = useState(0);
  useEffect(() => {
    if (!v) return;
    let t0, frame;
    const f = (t) => {
      t0 = t0 || t;
      const k = Math.min(1, (t - t0) / 1400);
      s(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(f);
    };
    frame = requestAnimationFrame(f);
    return () => cancelAnimationFrame(frame);
  }, [v, to]);
  return html`<span ref=${r}>${n}${suf}</span>`;
}
const Err = ({ e }) => (e ? html`<div class="err">${e}</div>` : null);

function Card({ p, i = 0 }) {
  const imageRef = useRef(null);
  const { add, favs, tf } = useC(),
    f = favs.includes(p.id);
  return html`<${Rv} c="card" animationKey=${p.id} d=${(i % 4) * 70}
    ><div
      ref=${!p.img ? imageRef : undefined}
      class=${'m t-' + (TONE[p.cols[0]] || 'sand')}
    >
      <a class="ml" href=${'#/p/' + p.slug} aria-label=${p.n}></a
      >${p.img && html`<${PhotoReveal}><img ref=${imageRef} class="im" src=${p.img} alt=${p.n} loading="lazy" /><//>`}<span
        class="ct"
        >${p.c.toUpperCase()}</span
      >${p.low && html`<span class="lo">QUEDAN POCOS</span>`}
      <button
        class=${'fv' + (f ? ' store-favorite-pop' : '')}
        aria-label=${f ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        aria-pressed=${f}
        onClick=${() => tf(p.id)}
      >
        ${f ? '♥' : '♡'}</button
      >${!p.img && html`<span class="big d">${p.k}</span>`}
      <div class="qa">
        <p>AGREGAR RÁPIDO · TALLE</p>
        <div>
          ${p.z.map((z) => html`<button key=${z} disabled=${!p.variants.some((v) => v.size === z && v.color === p.cols[0] && v.stock > 0)} onClick=${() => add(p, z, p.cols[0], 1, true, imageRef.current)}>${z}</button>`)}
        </div>
      </div>
    </div>
    <div class="nfo">
      <span>${p.n}<small>${p.col}</small></span
      ><span>${$(p.p)}</span>
    </div>
    <a
      class="design-card-link"
      href=${'#/p/' + p.slug}
      aria-label=${'Elegir talle de ' + p.n}
      >ELEGIR TALLE →</a
    ><//
  >`;
}
function Grid({ L }) {
  const ref = useRef(null);
  useFluidGrid(ref, L.map((p) => p.id).join('|'));
  return html`<div class="grid" ref=${ref}>
    ${L.length ? L.map((p, i) => html`<${Card} key=${p.id} p=${p} i=${i} />`) : html`<p class="em0">No hay prendas para mostrar.</p>`}
  </div>`;
}

function Words() {
  const r = useRef(),
    p = useProg(r),
    W = 'Forjá tu estilo. Todos los días. Menos vueltas. Más vos.'.split(' ');
  return html`<section class="words" ref=${r}>
    <div>
      <p class="d">
        ${W.map((w, i) => html`<span key=${i} class=${(i / W.length < p * 1.12 ? 'on ' : '') + (/estilo|vos/i.test(w) ? 'hot' : '')}>${w} </span>`)}
      </p>
    </div>
  </section>`;
}
function HScroll() {
  const { products: P } = useC();
  const r = useRef(),
    t = useRef(),
    p = useProg(r),
    x = t.current ? (t.current.scrollWidth - innerWidth) * p : 0;
  return html`<section class="hs" ref=${r}>
    <div>
      <h2 class="d">Lo más vendido</h2>
      <p class="design-swipe-hint">SEGUÍ BAJANDO PARA VER MÁS ↓</p>
      <div
        class="trk"
        ref=${t}
        tabindex="0"
        aria-label="Productos más vendidos"
        style=${{ transform: `translateX(${-x}px)` }}
      >
        ${[7, 0, 2, 4, 3, 5]
          .map((i) => P[i])
          .filter(Boolean)
          .map((q, i) => {
            return html`<div class="hc" key=${i}>
              <b>${q.c.toUpperCase()} · ${q.col}</b
              ><span class="d">${q.n}</span>
              <div>
                <b>${$(q.p)}</b><br /><br /><a href=${'#/p/' + q.slug}
                  >VER PRODUCTO →</a
                >
              </div>
            </div>`;
          })}
      </div>
    </div>
  </section>`;
}

function Home() {
  const { news, products: P, categories: CATS } = useC();
  return html`<${React.Fragment}>
    <${HeroForja} titulo="FRAGUAN" linea="Lo nuevo." destacado="A tu manera.">
      <div class="tiles">
        <a class="tile" href="#/c/nuevos"
          ><b class="k">01 — NOVEDADES</b
          ><span class="d">Ver lo<br />nuevo →</span></a
        ><a class="tile" href="#/c/remeras"
          ><b class="k">02 — TU ESTILO, TODOS LOS DÍAS</b
          ><span class="d">Elegir<br />remeras →</span></a
        >
      </div>
    <//>
    <${Words} />
    <section class="sec lt cats">
      <${Rv}><b class="k">COLECCIÓN</b><//
      ><${ColeccionHover}
        items=${CATS.map((c) => ({ nombre: c, cantidad: String(P.filter((p) => p.c === c).length).padStart(2, '0') + ' MODELOS', href: '/coleccion/' + c.toLowerCase(), img: P.find((p) => p.c === c && p.img)?.img }))}
      />
    </section>
    <section class="sec lt2">
      <${Rv}><h2 class="d h1">Lo nuevo</h2><//><${Grid} L=${P.slice(0, 8)} />
      <p style=${{ marginTop: '5vh' }}>
        <a class="btn" href="#/c/todo">VER TODA LA COLECCIÓN →</a>
      </p>
    </section>
    <${HScroll} />
    <section class="sec">
      <div class="ben">
        <div>
          <div class="d"><${Count} to=${10} suf="%" /></div>
          <p>OFF PAGANDO POR TRANSFERENCIA</p>
        </div>
        <div>
          <div class="d"><${Count} to=${24} /></div>
          <p>PROVINCIAS CON ENVÍO</p>
        </div>
        <div>
          <div class="d"><${Count} to=${7} /></div>
          <p>CATEGORÍAS PARA ARMAR TU LOOK</p>
        </div>
      </div>
    </section>
    <section class="sec em club">
      <${Rv}
        ><b class="k">CLUB FRAGUAN</b>
        <h2 class="d">Comprás acá.<br />Sumás en todos lados.</h2>
        <p>
          Tu cuenta reúne las compras del local y de la tienda online, tus
          preferencias y beneficios. Y en el checkout, tus datos se completan
          solos.
        </p>
        <a class="btn" href="#/cuenta">CREAR MI CUENTA →</a><//
      >
    </section>
    <section class="sec dk nl">
      <${Rv}
        ><b class="k" style=${{ color: 'var(--acc-l)' }}>FRAGUAN LETTER</b>
        <h2 class="d h1">Ingresos, drops<br />y beneficios.</h2>
        ${
          news[0]
            ? html`<p style=${{ fontSize: 20 }}>
                Listo, ya sos parte. Sin ruido.
              </p>`
            : html`<form
                onSubmit=${(e) => {
                  e.preventDefault();
                  news[1](e.currentTarget.elements.email.value);
                }}
              >
                <input
                  name="email"
                  aria-label="Email para newsletter"
                  type="email"
                  required
                  placeholder="Tu email"
                /><button class="btn a">UNIRME</button>
              </form>`
        }<${Err} e=${news[2]}
      /><//></section
  ><//>`;
}

function Coll({ c }) {
  const { products: P, categories: CATS } = useC();
  const [search, setSearch] = useState('');
  useEffect(
    () => setSearch(new URLSearchParams(location.search).get('search') || ''),
    [],
  );
  const [so, sso] = useState('rec'),
    [z, sz] = useState(''),
    cat = CATS.find((x) => x.toLowerCase() == c);
  let L = P.filter((p) => c == 'todo' || c == 'nuevos' || p.c == cat);
  if (c == 'nuevos') L = L.filter((p) => p.featured);
  if (search)
    L = L.filter((p) =>
      matchText(p.n + ' ' + p.c + ' ' + p.col).includes(
        matchText(search.trim()),
      ),
    );
  if (z) L = L.filter((p) => p.z.includes(z));
  if (so == 'min') L = [...L].sort((a, b) => a.p - b.p);
  if (so == 'max') L = [...L].sort((a, b) => b.p - a.p);
  if (so == 'nom') L = [...L].sort((a, b) => a.n.localeCompare(b.n));
  return html`<section class="sec lt2 pg">
    <b class="k">FRAGUAN / COLECCIÓN</b>
    <h1 class="d h1">
      ${c == 'todo' ? 'Toda la colección' : c == 'nuevos' ? 'Nuevos' : cat || 'Colección'}
    </h1>
    <div class="pills">
      ${['todo', ...CATS.map((x) => x.toLowerCase())].map((s) => html`<a key=${s} class=${s == c ? 'on' : ''} href=${'#/c/' + s}>${s == 'todo' ? 'Todo' : s[0].toUpperCase() + s.slice(1)}</a>`)}
    </div>
    <div class="collection-tools">
      <label class="collection-search"
        ><span>Buscar en esta colección</span
        ><input
          aria-label="Buscar producto en esta colección"
          type="search"
          placeholder="Nombre, color o categoría"
          value=${search}
          onChange=${(e) => setSearch(e.target.value)} /></label
      ><select
        aria-label="Filtrar por talle"
        value=${z}
        onChange=${(e) => sz(e.target.value)}
      >
        <option value="">Talle: todos</option>
        ${[...T, ...B].map((x) => html`<option key=${x}>${x}</option>`)}
      </select>
      <select
        aria-label="Ordenar productos"
        value=${so}
        onChange=${(e) => sso(e.target.value)}
      >
        <option value="rec">Recomendados</option>
        <option value="min">Menor precio</option>
        <option value="max">Mayor precio</option>
        <option value="nom">Nombre</option>
      </select>
    </div>
    <${Grid} L=${L} />
  </section>`;
}

function Prod({ id }) {
  const imageRef = useRef(null);
  const { add, favs, tf, products: P } = useC(),
    p = P.find((p) => p.slug === id),
    [s, ss] = useState(''),
    [c, sc] = useState(p ? p.cols[0] : ''),
    [q, sq] = useState(1),
    [e, se] = useState('');
  useEffect(() => {
    if (!p) return;
    const requested = new URLSearchParams(location.search).get('variant');
    const v = p.variants.find((v) => v.id === requested || v.sku === requested);
    if (v) {
      ss(v.size);
      sc(v.color);
    }
    trackStore('view_item', { productId: p.id, value: p.original.price });
  }, [p]);
  if (!p) return html`<${NF} />`;
  const f = favs.includes(p.id);
  const variant = p?.variants.find((v) => v.color === c && v.size === s);
  const ok = (o) => {
    if (!s) {
      se('Elegí un talle para continuar.');
      return;
    }
    se('');
    if (!add(p, s, c, q, o, imageRef.current))
      se('Este talle y color no tienen stock disponible.');
  };
  return html`<section class="sec lt pg">
    <p class="k" style=${{ marginBottom: 20 }}>
      <a href="#/">INICIO</a> /
      <a href=${'#/c/' + p.c.toLowerCase()}>${p.c.toUpperCase()}</a>
    </p>
    <div class="pd">
      <${ColorMedia}
        color=${c}
        tone=${(name) => TONE[name] || 'sand'}
        imageRef=${!p.img ? imageRef : undefined}
      >
        ${(shown) => html`${p.img && html`<img ref=${imageRef} class="im" src=${p.img} alt=${p.n} />`}<span key=${shown} class="ct fg-color-label">${p.c.toUpperCase()} · ${shown.toUpperCase()}</span>${!p.img && html`<span class="big d">${p.k}</span>`}`}
      <//>
      <div>
        <h1 class="d">${p.n}</h1>
        <div class="pr">
          <${Odometer} value=${variant?.price / 100 || p.p} />
        </div>
        <p style=${{ fontSize: 14 }}>
          ${$(Math.max(0, (variant?.price / 100 || p.p) * 0.9))} pagando por
          transferencia · Envíos a todo el país
        </p>
        <span class="k">COLOR · ${c.toUpperCase()}</span>
        <div class="chips">
          ${p.cols.map((x) => html`<button key=${x} class=${x == c ? 'on' : ''} aria-pressed=${x === c} onClick=${() => sc(x)}>${x}</button>`)}
        </div>
        <span class="k">TALLE</span>
        <div class="chips">
          ${p.z.map((x) => html`<button key=${x} disabled=${!p.variants.some((v) => v.size === x && v.color === c && v.stock > 0)} class=${x == s ? 'on' : ''} aria-pressed=${x === s} onClick=${() => ss(x)}>${x}</button>`)}
        </div>
        <${EtiquetaTalle}
          key=${s + c}
          talle=${s}
          nombre=${p.n}
          precio=${variant ? variant.price / 100 : p.p}
        />
        <span class="k">CANTIDAD</span>
        <div class="qt">
          <button onClick=${() => sq(Math.max(1, q - 1))}>−</button>${q}<button
            onClick=${() => sq(Math.min(variant?.stock || 1, q + 1))}
          >
            +
          </button>
        </div>
        <div style=${{ marginTop: 22 }}>
          <${Err} e=${e} /><button class="btn a w" onClick=${() => ok(true)}>
            AGREGAR AL CARRITO</button
          ><button
            class="btn w"
            onClick=${() => {
              if (!s) {
                se('Elegí un talle para continuar.');
                return;
              }
              if (add(p, s, c, q, false)) go('#/checkout');
              else se('Este talle y color no tienen stock disponible.');
            }}
          >
            COMPRAR AHORA</button
          ><button class="btn g w" onClick=${() => tf(p.id)}>
            ${f ? '♥ EN FAVORITOS' : '♡ GUARDAR EN FAVORITOS'}
          </button>
        </div>
        <p style=${{ marginTop: 22, lineHeight: 1.6 }}>${p.description}</p>
        <details>
          <summary>MATERIAL Y CUIDADOS</summary>
          <p>${p.material}<br />${p.care}</p>
        </details>
        <${SizeHelp} product=${p.original} />
        <details>
          <summary>ENVÍOS</summary>
          <p>
            Enviamos a todo el país. Gratis desde ${$(FREE)}. Retiro sin cargo
            en el local.
          </p>
        </details>
        <details>
          <summary>CAMBIOS Y DEVOLUCIONES</summary>
          <p>30 días para cambiar tu prenda sin uso y con etiquetas.</p>
        </details>
      </div>
    </div>
    <${StoreProductTrust} product=${p.original} />
    <h2 class="d h1" style=${{ marginTop: '10vh' }}>También te puede gustar</h2>
    <${Grid}
      L=${P.filter((x) => x.c == p.c && x.id != p.id)
        .concat(P.filter((x) => x.c != p.c))
        .slice(0, 4)}
    />
  </section>`;
}

function Lines({ ro, stagger = false }) {
  const { cart, chg, rm } = useC();
  return cart.length
    ? cart.map(
        (i, index) =>
          html`<div
            class=${'ln2' + (stagger ? ' store-cart-enter' : '')}
            style=${stagger ? { '--cart-index': Math.min(index, 6) } : undefined}
            key=${i.k}
          >
            <div>
              <b>${i.n}</b
              ><small>${i.col} · Talle ${i.s} · ${$(i.p)}</small
              >${ro ? html`<small>Cantidad: ${i.q}</small>` : html`<div class="qt"><button onClick=${() => chg(i.k, -1)}>−</button>${i.q}<button onClick=${() => chg(i.k, 1)}>+</button><button style=${{ marginLeft: 10 }} onClick=${() => rm(i.k)}>QUITAR</button></div>`}
            </div>
            <b><${Odometer} value=${i.p * i.q} /></b>
          </div>`,
      )
    : html`<p class="em0">Tu carrito está vacío.</p>`;
}
function CartPage() {
  const { cart, sub, ready, products, chg, rm, favs, tf } = useC();
  const suggestions = products
    .filter(
      (p) =>
        !cart.some((i) => i.id === p.id) && p.variants.some((v) => v.stock > 0),
    )
    .slice(0, 4);
  return html`<section class="sec lt pg purchase-cart">
    <h1 class="purchase-title">Tu carrito</h1>
    ${
      !ready
        ? html`<p aria-busy="true">Cargando tu selección…</p>`
        : cart.length
          ? html`
              <div class="purchase-layout">
                <div class="purchase-products">
                  ${cart.map((i) => {
                    const product = products.find((p) => p.id === i.id);
                    return html`<article class="purchase-item" key=${i.k}>
                      <a
                        class="purchase-photo"
                        href=${product ? '/producto/' + product.slug : '/tienda'}
                        aria-label=${'Ver ' + i.n}
                      >
                        ${product?.img ? html`<img src=${product.img} alt=${i.n} />` : html`<span>Foto no disponible</span>`}
                      </a>
                      <div class="purchase-description">
                        <a
                          class="purchase-name"
                          href=${product ? '/producto/' + product.slug : '/tienda'}
                          >${i.n}</a
                        >
                        <p class="purchase-muted">${i.col} · Talle ${i.s}</p>
                        <div class="purchase-controls">
                          <div class="purchase-quantity">
                            <button
                              type="button"
                              onClick=${() => chg(i.k, -1)}
                              aria-label=${'Quitar una unidad de ' + i.n}
                            >
                              −
                            </button>
                            <span aria-label="Cantidad">${i.q}</span>
                            <button
                              type="button"
                              onClick=${() => chg(i.k, 1)}
                              aria-label=${'Agregar una unidad de ' + i.n}
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            class="purchase-favorite"
                            aria-pressed=${favs.includes(i.id)}
                            aria-label=${(favs.includes(i.id) ? 'Quitar de favoritos: ' : 'Guardar en favoritos: ') + i.n}
                            onClick=${() => tf(i.id)}
                          >
                            ${favs.includes(i.id) ? '♥' : '♡'}
                          </button>
                          <button
                            type="button"
                            class="purchase-remove"
                            onClick=${() => rm(i.k)}
                          >
                            Quitar
                          </button>
                        </div>
                        <p class="purchase-delivery">
                          Envío a domicilio o retiro en el local<span
                            class="purchase-muted"
                            >Elegís la entrega al finalizar la compra.</span
                          >
                        </p>
                      </div>
                      <strong class="purchase-price"
                        ><${Odometer} value=${i.p * i.q}
                      /></strong>
                    </article>`;
                  })}
                </div>
                <aside
                  class="purchase-summary"
                  aria-label="Resumen del carrito"
                >
                  <h2>Resumen</h2>
                  <dl>
                    <div>
                      <dt>Subtotal</dt>
                      <dd><${Odometer} value=${sub} /></dd>
                    </div>
                    <div>
                      <dt>Descuento</dt>
                      <dd>Se calcula al pagar</dd>
                    </div>
                    <div>
                      <dt>Envío</dt>
                      <dd>Se calcula al pagar</dd>
                    </div>
                    <div class="purchase-total">
                      <dt>Total estimado</dt>
                      <dd><${Odometer} value=${sub} /></dd>
                    </div>
                  </dl>
                  <${BarraEnvioGratis}
                    subtotal=${sub - Math.floor(sub * 10) / 100}
                    meta=${FREE}
                    ready=${ready}
                  />
                  <a class="purchase-button" href="/checkout"
                    >Finalizar compra</a
                  >
                  <a class="purchase-button purchase-secondary" href="/tienda"
                    >Seguir comprando</a
                  >
                </aside>
              </div>
            `
          : html`<p class="em0">
              Todavía no agregaste nada.
              <a class="k" href="/tienda">VER COLECCIÓN →</a>
            </p>`
    }
    ${
      ready && suggestions.length > 0
        ? html`<section
            class="purchase-suggestions"
            aria-label="Productos sugeridos"
          >
            <h2>Completá tu look</h2>
            <${Grid} L=${suggestions} />
          </section>`
        : null
    }
  </section>`;
}

const NF = () =>
  html`<section class="sec lt pg">
    <h1 class="d h1">No encontrado</h1>
    <a class="btn" href="#/">VOLVER AL INICIO</a>
  </section>`;
function Favs() {
  const { favs, products: P } = useC();
  return html`<section class="sec lt2 pg">
    <h1 class="d h1">Favoritos</h1>
    <${Grid} L=${P.filter((p) => favs.includes(p.id))} />
  </section>`;
}
function Cart({ o, close }) {
  const { cart, sub, ready } = useC();
  return html`<${React.Fragment}
    ><div
      aria-hidden="true"
      class=${'ov ' + (o ? 'on' : '')}
      onClick=${close}
    ></div>
    <aside
      inert=${!o}
      aria-hidden=${!o}
      aria-label="Carrito"
      role="dialog"
      aria-modal="true"
      class=${'dr ' + (o ? 'on' : '')}
    >
      <header class="d">
        Tu carrito<button onClick=${close}>CERRAR ✕</button>
      </header>
      <${BarraEnvioGratis}
        subtotal=${sub - Math.floor(sub * 10) / 100}
        meta=${FREE}
        ready=${ready}
      />
      <div class="it" key=${o ? 'open' : 'closed'}>
        <${Lines} stagger=${o} />
      </div>
      <div class="tot g">
        <span>Subtotal</span><span><${Odometer} value=${sub} /></span>
      </div>
      ${cart.length > 0 && html`<${React.Fragment}><a class="btn a w" href="#/checkout">IR A PAGAR</a><a class="btn g w" href="#/carrito">VER CARRITO</a><//>`}
    </aside><//
  >`;
}
function Cur() {
  const r = useRef();
  useEffect(() => {
    const m = (e) => {
      r.current.classList.add('active');
      r.current.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      r.current.classList.toggle(
        'h',
        !!e.target.closest('a,button,.card,input,select'),
      );
    };
    addEventListener('mousemove', m);
    return () => removeEventListener('mousemove', m);
  }, []);
  return html`<div class="cur" ref=${r}></div>`;
}

function PublicStore({ children }) {
  const pathname = usePathname(),
    basket = useStoreCart(),
    saved = useStoreFavorites();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [products, setProducts] = useState([]),
    [catalogError, setCatalogError] = useState(''),
    [user, setUser] = useState(null),
    [open, setOpen] = useState(false),
    [menu, setMenu] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [searchQuery, setSearchQuery] = useState(''),
    [catalogLoaded, setCatalogLoaded] = useState(false),
    [newsDone, setNewsDone] = useState(false),
    [newsError, setNewsError] = useState('');
  const normalizedQuery = matchText(searchQuery.trim());
  const searchMatches = normalizedQuery
    ? products.filter((p) =>
        matchText(p.n + ' ' + p.c + ' ' + p.col).includes(normalizedQuery),
      )
    : [];
  const root = useRef(null),
    trigger = useRef(null),
    lastFocus = useRef(null),
    searchInput = useRef(null);
  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);
  useEffect(() => setSearchOpen(false), [pathname]);
  useEffect(() => {
    if (!menu) return;
    const close = (event) => {
      if (event.key === 'Escape') {
        setMenu(false);
        root.current?.querySelector('.mobile-menu')?.focus();
      }
    };
    addEventListener('keydown', close);
    return () => removeEventListener('keydown', close);
  }, [menu]);
  useEffect(() => {
    if (location.hash.startsWith('#/')) {
      const parts = location.hash.slice(2).split('/');
      if (parts[0] !== 'p') location.replace(route(location.hash));
    }
    let active = true;
    storeApi('store-catalog')
      .then((r) => {
        if (active) setProducts(designProducts(r.products));
      })
      .catch((e) => {
        if (active) setCatalogError(e.message);
      })
      .finally(() => {
        if (active) setCatalogLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    storeApi('store-account')
      .then((r) => {
        if (active) setUser(r.customer);
      })
      .catch(() => {});
    setOpen(false);
    setMenu(false);
    return () => {
      active = false;
    };
  }, [pathname]);
  useEffect(() => {
    const update = (e) => setUser(e.detail);
    addEventListener('fraguan-account', update);
    return () => removeEventListener('fraguan-account', update);
  }, []);
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const drawer = root.current.querySelector('.dr');
    drawer.querySelector('button')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab') {
        const nodes = [
          ...drawer.querySelectorAll('a,button,input,select'),
        ].filter((n) => !n.disabled);
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = overflow;
      removeEventListener('keydown', key);
      lastFocus.current?.focus();
    };
  }, [open]);
  const categories = useMemo(
    () => [
      ...new Set([
        'Camisas',
        'Remeras',
        'Jeans',
        'Buzos',
        'Pantalones',
        'Camperas',
        'Chombas',
        ...products.map((p) => p.c),
      ]),
    ],
    [products],
  );
  const cart = basket.cart.map((i) => ({
    k: i.id,
    id: i.productId,
    n: i.productName,
    p: i.price / 100,
    s: i.size,
    col: i.color,
    q: i.quantity,
  }));
  const add = (p, s, col, q = 1, show = true, origin = null) => {
    const variant = p.variants.find(
      (v) => v.size === s && v.color === col && v.stock > 0,
    );
    if (!variant) return false;
    basket.add(p.original, variant, q);
    if (show) {
      if (origin) volarAlCarrito(origin, trigger.current, () => setOpen(true));
      else setOpen(true);
    }
    return true;
  };
  const news = async (email) => {
    setNewsError('');
    try {
      await storeApi('store-newsletter', {
        method: 'POST',
        body: JSON.stringify({ email, source: 'design-home' }),
      });
      setNewsDone(true);
    } catch (e) {
      setNewsError(e.message);
    }
  };
  const value = {
    ready,
    products,
    categories,
    cart,
    add,
    chg: (k, d) => {
      const i = basket.cart.find((i) => i.id === k);
      if (i) basket.update(k, i.quantity + d);
    },
    rm: (k) => basket.update(k, 0),
    n: basket.count,
    sub: basket.subtotal / 100,
    favs: saved.favorites,
    tf: saved.toggle,
    user,
    so: setOpen,
    news: [newsDone, news, newsError],
  };
  return (
    <C.Provider value={value}>
      <div
        className={
          'fraguan-design' +
          (pathname === '/checkout'
            ? ' checkout-surface'
            : pathname === '/carrito'
              ? ' cart-surface'
              : '')
        }
        ref={root}
      >
        <a className="design-skip" href="#store-content">
          Saltar al contenido
        </a>
        {pathname === '/checkout' ? (
          <nav className="cp-nav" aria-label="Navegación de compra">
            <a href="/carrito">← VOLVER AL CARRITO</a>
            <a className="lg d" href="/">
              FRAGUAN
            </a>
            <span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z" />
                <path d="m8 12 3 3 5-6" />
              </svg>
              Compra segura
            </span>
          </nav>
        ) : (
          <nav inert={open} aria-label="Navegación principal">
            <a className="lg d" href="/">
              Fraguan
            </a>
            <div className="ln">
              {[
                ['nuevos', 'Nuevos'],
                ['camisas', 'Camisas'],
                ['remeras', 'Remeras'],
                ['pantalones', 'Pantalones'],
                ['camperas', 'Abrigos'],
              ].map(([s, l]) => (
                <a key={s} href={'/coleccion/' + s}>
                  {l}
                </a>
              ))}
            </div>
            <div className="nr">
              <button
                className="mobile-menu"
                aria-label="Abrir categorías"
                aria-expanded={menu}
                aria-controls="store-mobile-menu"
                onClick={() => setMenu(!menu)}
              >
                ☰
              </button>
              <button
                className="store-search-toggle"
                type="button"
                aria-label="Buscar productos"
                aria-expanded={searchOpen}
                aria-controls="store-header-search"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m16 16 5 5" />
                </svg>
              </button>
              <a
                href="/favoritos"
                aria-label={'Favoritos: ' + saved.favorites.length}
              >
                ♡ {saved.favorites.length}
              </a>
              <a
                href="/cuenta"
                aria-label={user?.name ? 'Cuenta de ' + user.name : 'Mi cuenta'}
              >
                <span className="design-nav-label">
                  {user?.name || 'Cuenta'}
                </span>
                <svg
                  className="design-nav-icon"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                </svg>
              </a>
              <button
                className="cb"
                ref={trigger}
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-label={'Carrito, ' + basket.count + ' productos'}
              >
                <span className="design-nav-label">CARRITO</span>
                <svg
                  className="design-nav-icon"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path
                    d="M3 5h2l3 12h11l2-9H6M9 21h.01M18 21h.01"
                    strokeLinecap="round"
                  />
                </svg>
                <i>{basket.count}</i>
              </button>
            </div>
          </nav>
        )}
        {searchOpen && pathname !== '/checkout' && (
          <search id="store-header-search" className="store-search-panel">
            <form action="/tienda" method="get">
              <label htmlFor="store-header-search-input">
                ¿Qué estás buscando?
              </label>
              <div>
                <input
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setSearchOpen(false);
                      root.current
                        ?.querySelector('.store-search-toggle')
                        ?.focus();
                    }
                  }}
                  ref={searchInput}
                  id="store-header-search-input"
                  name="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  autoComplete="off"
                  aria-controls="store-search-suggestions"
                  type="search"
                  placeholder="Nombre, color o categoría"
                  required
                  maxLength={120}
                />
                <button type="submit">Buscar</button>
                <button
                  type="button"
                  aria-label="Cerrar búsqueda"
                  onClick={() => {
                    setSearchOpen(false);
                    root.current
                      ?.querySelector('.store-search-toggle')
                      ?.focus();
                  }}
                >
                  ×
                </button>
              </div>
              {normalizedQuery && (
                <section
                  id="store-search-suggestions"
                  className="store-search-suggestions"
                  aria-label="Sugerencias de productos"
                >
                  <output aria-live="polite">
                    {!catalogLoaded
                      ? 'Buscando productos…'
                      : catalogError
                        ? 'No pudimos cargar las sugerencias. Intentá nuevamente.'
                        : searchMatches.length
                          ? 'Productos que coinciden con tu búsqueda'
                          : 'No encontramos productos con esa búsqueda.'}
                  </output>
                  {catalogLoaded &&
                    !catalogError &&
                    searchMatches.length > 0 && (
                      <>
                        <ul>
                          {searchMatches.slice(0, 6).map((product) => (
                            <li key={product.id}>
                              <a
                                href={'/producto/' + product.slug}
                                onClick={() => setSearchOpen(false)}
                              >
                                <span>
                                  <strong>{product.n}</strong>
                                  <small>
                                    {product.c} · {product.col}
                                  </small>
                                </span>
                                <b>{storeMoney(product.original.price)}</b>
                              </a>
                            </li>
                          ))}
                        </ul>
                        <a
                          className="store-search-all"
                          href={
                            '/tienda?search=' +
                            encodeURIComponent(searchQuery.trim())
                          }
                        >
                          Ver todos los resultados →
                        </a>
                      </>
                    )}
                </section>
              )}
            </form>
          </search>
        )}
        {menu && pathname !== '/checkout' && (
          <div className="design-mobile-links" id="store-mobile-menu">
            {[
              ['todo', 'Toda la colección'],
              ['nuevos', 'Nuevos'],
              ...categories.map((c) => [c.toLowerCase(), c]),
            ].map(([s, l]) => (
              <a key={s} href={s === 'todo' ? '/tienda' : '/coleccion/' + s}>
                {l}
              </a>
            ))}
          </div>
        )}
        <main
          id="store-content"
          className="store-page-enter"
          key={pathname}
          inert={open}
        >
          {catalogError && (
            <p className="err" role="alert">
              {catalogError}
            </p>
          )}
          {children}
        </main>
        <footer inert={open}>
          <div className="fl">
            <div>
              <b>AYUDA</b>
              {['envios', 'cambios', 'pagos', 'talles', 'contacto'].map((k) => (
                <a key={k} href={'/informacion/' + k}>
                  {INFO[k][0]}
                </a>
              ))}
              <a href="/cuenta">Mi cuenta</a>
            </div>
            <div>
              <b>LEGAL</b>
              {['terminos', 'privacidad', 'cookies', 'arrepentimiento'].map(
                (k) => (
                  <a
                    key={k}
                    href={
                      k === 'arrepentimiento'
                        ? '/arrepentimiento'
                        : '/informacion/' + k
                    }
                  >
                    {INFO[k][0]}
                  </a>
                ),
              )}
            </div>
          </div>
          <div className="wm d" aria-hidden="true">
            {'FRAGUAN'.split('').map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
        </footer>
        <Cart o={open} close={() => setOpen(false)} />
        <Cur />
      </div>
    </C.Provider>
  );
}
export function StoreDesignBoundary({ children }) {
  const pathname = usePathname();
  const internal =
    pathname === '/pos' ||
    pathname.startsWith('/pos/') ||
    pathname === '/acceso' ||
    pathname === '/admin-access' ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/');
  return internal ? children : <PublicStore>{children}</PublicStore>;
}
export function DesignCatalog({ initialCatalog, section }) {
  const context = useC();
  const [data, setData] = useState(
      initialCatalog?.products ? designProducts(initialCatalog.products) : null,
    ),
    [error, setError] = useState('');
  useEffect(() => {
    if (initialCatalog) {
      setData(designProducts(initialCatalog.products));
      return;
    }
    storeApi('store-catalog')
      .then((r) => setData(designProducts(r.products)))
      .catch((e) => setError(e.message));
  }, [initialCatalog]);
  const value = { ...context, products: data || context.products };
  return (
    <C.Provider value={value}>
      {error ? (
        <section className="sec lt pg">
          <h1 className="d h1">Colección</h1>
          <p role="alert">{error}</p>
        </section>
      ) : section ? (
        <Coll key={section} c={section.toLowerCase()} />
      ) : (
        <Home />
      )}
    </C.Provider>
  );
}
export function DesignProduct({ slug, initialProduct, initialRelated }) {
  const context = useC();
  const [data, setData] = useState(
      initialProduct
        ? { product: initialProduct, related: initialRelated || [] }
        : null,
    ),
    [error, setError] = useState('');
  useEffect(() => {
    if (initialProduct) return;
    storeApi('store-product?slug=' + encodeURIComponent(slug))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [slug, initialProduct]);
  if (error)
    return (
      <section className="sec lt pg">
        <h1 className="d h1">Producto</h1>
        <p role="alert">{error}</p>
        <a className="btn" href="/tienda">
          VER COLECCIÓN
        </a>
      </section>
    );
  if (!data)
    return (
      <section className="sec lt pg" aria-busy="true">
        Cargando producto…
      </section>
    );
  const products = [data.product, ...data.related].map(designProduct);
  return (
    <C.Provider value={{ ...context, products }}>
      <Prod key={slug} id={slug} />
    </C.Provider>
  );
}
export function DesignCart() {
  return <CartPage />;
}
export function DesignFavorites() {
  return <Favs />;
}
export function DesignProductGrid({ products }) {
  return <Grid L={products.map(designProduct)} />;
}

function SizeHelp({ product }) {
  const [height, setHeight] = useState(''),
    [weight, setWeight] = useState(''),
    [fit, setFit] = useState('normal'),
    [result, setResult] = useState('');
  function recommend() {
    const h = Number(height),
      w = Number(weight);
    if (h < 130 || h > 230 || w < 35 || w > 220) {
      setResult('Revisá altura y peso.');
      return;
    }
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const sizes = [
      ...new Set(
        product.variants.filter((v) => v.stock > 0).map((v) => v.size),
      ),
    ].sort((a, b) =>
      order.includes(a)
        ? order.indexOf(a) - order.indexOf(b)
        : Number(a) - Number(b),
    );
    if (!sizes.length) {
      setResult('Sin talles disponibles.');
      return;
    }
    const score = w / Math.pow(h / 100, 2);
    let position = score < 20 ? 0 : score < 24 ? 1 : score < 28 ? 2 : 3;
    position += h > 188 ? 1 : h < 165 ? -1 : 0;
    position += fit === 'oversize' ? 1 : fit === 'ajustado' ? -1 : 0;
    setResult(
      'Talle sugerido: ' +
        sizes[Math.max(0, Math.min(sizes.length - 1, position))] +
        '. Es una orientación; compará con una prenda que te quede bien.',
    );
  }
  return (
    <details className="design-size-help">
      <summary>GUÍA Y ASISTENTE DE TALLES</summary>
      <p>Encontrá tu talle según tus medidas y el calce que preferís.</p>
      <div className="design-size-fields">
        <label className="fi">
          ALTURA (CM)
          <input
            type="number"
            placeholder="Ej. 175"
            inputMode="numeric"
            min="130"
            max="230"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </label>
        <label className="fi">
          PESO (KG)
          <input
            type="number"
            placeholder="Ej. 75"
            inputMode="numeric"
            min="35"
            max="220"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </label>
      </div>
      <label className="fi">
        CALCE
        <select value={fit} onChange={(e) => setFit(e.target.value)}>
          <option value="normal">Normal</option>
          <option value="ajustado">Ajustado</option>
          <option value="oversize">Holgado</option>
        </select>
      </label>
      <button className="btn" onClick={recommend}>
        SUGERIR TALLE →
      </button>
      {result && (
        <output className="design-size-result" style={{ display: 'block' }}>
          {result}
        </output>
      )}
      <p>
        <a className="k" href="/informacion/talles">
          VER GUÍA DE TALLES →
        </a>
      </p>
    </details>
  );
}
