'use client';
import { ArrowDown, ArrowRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { StoreProductCard } from '@/components/store-product-card';
import { StoreProduct, storeApi, useStoreFavorites } from '@/lib/store-client';

export default function Storefront() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [sections, setSections] = useState<
    { name: string; products: number }[]
  >([]);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('');
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { favorites } = useStoreFavorites();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSection(params.get('section') || '');
    setOnlyFavorites(params.get('favorites') === '1');
    if (params.get('search'))
      setTimeout(
        () =>
          document
            .querySelector<HTMLInputElement>('.store-search input')
            ?.focus(),
        100,
      );
  }, []);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        storeApi<{
          products: StoreProduct[];
          sections: { name: string; products: number }[];
        }>(
          `store-catalog?q=${encodeURIComponent(query)}&section=${encodeURIComponent(section)}`,
        )
          .then((data) => {
            setProducts(data.products);
            setSections(data.sections);
            setError('');
          })
          .catch((cause) => setError(cause.message))
          .finally(() => setLoading(false));
      },
      query ? 180 : 0,
    );
    return () => clearTimeout(timer);
  }, [query, section]);
  const featured = useMemo(
    () => products.filter((product) => product.featured).slice(0, 6),
    [products],
  );
  const sizes = useMemo(
    () => [...new Set(products.flatMap((product) => product.variants.map((variant) => variant.size)))],
    [products],
  );
  const colors = useMemo(
    () => [...new Set(products.flatMap((product) => product.variants.map((variant) => variant.color)))],
    [products],
  );
  const displayed = useMemo(() => {
    const filtered = products.filter((product) => {
      if (onlyFavorites && !favorites.includes(product.id)) return false;
      return product.variants.some((variant) => {
        if (size && variant.size !== size) return false;
        if (color && variant.color !== color) return false;
        if (onlyAvailable && variant.stock < 1) return false;
        return true;
      });
    });
    return [...filtered].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price;
      if (sort === 'price-desc') return b.price - a.price;
      if (sort === 'name') return a.name.localeCompare(b.name, 'es');
      return Number(b.featured) - Number(a.featured);
    });
  }, [products, favorites, onlyFavorites, size, color, onlyAvailable, sort]);
  const hasActiveFilters = Boolean(size || color || onlyAvailable || onlyFavorites);
  return (
    <div className="store-shell">
      <StoreHeader />
      <main>
        <section className="store-hero">
          <div className="store-hero-kicker">
            <span>FRAGUAN / ARGENTINA</span>
            <span>NUEVA TEMPORADA</span>
          </div>
          <h1>
            FORJÁ
            <br />
            <em>TU ESTILO.</em>
          </h1>
          <div className="store-hero-bottom">
            <p>
              Hecho para usarlo a tu manera. Elegí tu talle, tu color y armá
              un estilo propio.
            </p>
            <a href="#coleccion">
              Ver colección <ArrowDown />
            </a>
          </div>
          <div className="store-orbit" aria-hidden="true">
            <span>HECHO PARA USARLO A TU MANERA ·</span>
          </div>
        </section>
        <div className="store-marquee" aria-hidden="true">
          <span>
            NUEVO DROP — HECHO PARA USARLO A TU MANERA — BUENOS AIRES —
            NUEVO DROP — HECHO PARA USARLO A TU MANERA — BUENOS AIRES —{' '}
          </span>
        </div>
        <section className="store-worlds" aria-label="Colecciones FRAGUAN">
          <header>
            <span>ENTRÁ POR TU ESTILO</span>
            <h2>Vestirse también es una forma de decir quién sos.</h2>
          </header>
          <div>
            <a href="/tienda?section=Nuevos">
              <small>01 / NEW DROP</small>
              <strong>LO NUEVO</strong>
              <span>Primeras piezas de la temporada <ArrowRight /></span>
            </a>
            <a href="/tienda?section=Camisas">
              <small>02 / THE UNIFORM</small>
              <strong>CAMISAS</strong>
              <span>Para todos los días <ArrowRight /></span>
            </a>
            <a href="/tienda?section=Pantalones">
              <small>03 / ESSENTIALS</small>
              <strong>BASES</strong>
              <span>Lo que combina con todo <ArrowRight /></span>
            </a>
          </div>
        </section>
        <section className="store-catalog-section" id="coleccion">
          <div className="store-section-head">
            <div>
              <span>01 / COLECCIÓN</span>
              <h2>{section || 'Elegí sin vueltas'}</h2>
            </div>
            <p>{displayed.length} productos · Stock actualizado</p>
          </div>
          <div className="store-search">
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="¿Qué estás buscando?"
              aria-label="Buscar productos"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
              >
                <X />
              </button>
            )}
          </div>
          <div className="store-section-filters" aria-label="Secciones">
            <button
              className={!section ? 'active' : ''}
              onClick={() => setSection('')}
            >
              Todo
            </button>
            {sections.map((item) => (
              <button
                className={section === item.name ? 'active' : ''}
                onClick={() => setSection(item.name)}
                key={item.name}
              >
                {item.name}
                <sup>{item.products}</sup>
              </button>
            ))}
          </div>
          <div className="store-catalog-tools" aria-label="Filtrar y ordenar productos">
            <label>
              Talle
              <select value={size} onChange={(event) => setSize(event.target.value)}>
                <option value="">Todos</option>
                {sizes.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Color
              <select value={color} onChange={(event) => setColor(event.target.value)}>
                <option value="">Todos</option>
                {colors.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className="store-check-filter">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(event) => setOnlyAvailable(event.target.checked)}
              />
              Solo disponibles
            </label>
            <label className="store-check-filter">
              <input
                type="checkbox"
                checked={onlyFavorites}
                onChange={(event) => setOnlyFavorites(event.target.checked)}
              />
              Mis favoritos
            </label>
            <label className="store-sort">
              Ordenar
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="recommended">Recomendados</option>
                <option value="price-asc">Menor precio</option>
                <option value="price-desc">Mayor precio</option>
                <option value="name">Nombre</option>
              </select>
            </label>
            {hasActiveFilters && (
              <button
                className="store-clear-filters"
                onClick={() => {
                  setSize('');
                  setColor('');
                  setOnlyAvailable(false);
                  setOnlyFavorites(false);
                }}
              >
                Limpiar filtros
              </button>
            )}
          </div>
          {error && <p className="store-error">{error}</p>}
          {loading ? (
            <div className="store-loading">Preparando la colección…</div>
          ) : displayed.length ? (
            <div className="store-product-grid">
              {displayed.map((product, index) => (
                <StoreProductCard
                  product={product}
                  index={index}
                  key={product.id}
                />
              ))}
            </div>
          ) : (
            <div className="store-empty">
              <h3>No encontramos esa prenda.</h3>
              <button
                onClick={() => {
                  setQuery('');
                  setSection('');
                }}
              >
                Ver toda la colección
              </button>
            </div>
          )}
        </section>
        {!!featured.length && (
          <section className="store-club-band">
            <span>CLUB FRAGUAN</span>
            <h2>
              Comprás acá.
              <br />
              Sumás en todos lados.
            </h2>
            <p>
              Tu cuenta reúne las compras del local y de la tienda online, tus
              puntos y beneficios.
            </p>
            <a href="/cuenta">
              Crear mi cuenta <ArrowRight />
            </a>
          </section>
        )}
        <section className="store-service-band" aria-label="Beneficios de compra">
          <div><span>01</span><strong>10% OFF</strong><small>Pagando por transferencia</small></div>
          <div><span>02</span><strong>RETIRO GRATIS</strong><small>Cuando tu pedido esté listo</small></div>
          <div><span>03</span><strong>STOCK REAL</strong><small>Conectado con el local</small></div>
          <div><span>04</span><strong>SEGUIMIENTO</strong><small>Desde Mi FRAGUAN</small></div>
        </section>
      </main>
      <StoreFooter />
    </div>
  );
}
