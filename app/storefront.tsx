'use client';
import { ArrowDown, ArrowRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { StoreProductCard } from '@/components/store-product-card';
import {
  StoreCatalog,
  StoreProduct,
  storeApi,
  useStoreFavorites,
  trackStore,
} from '@/lib/store-client';

export default function Storefront({
  initialSection = '',
  initialCatalog,
}: {
  initialSection?: string;
  initialCatalog?: StoreCatalog;
}) {
  const [products, setProducts] = useState<StoreProduct[]>(
    initialCatalog?.products || [],
  );
  const [sections, setSections] = useState<
    { name: string; products: number }[]
  >(initialCatalog?.sections || []);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState(initialSection);
  const [size, setSize] = useState('');
  const [color, setColor] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sort, setSort] = useState('recommended');
  const [loading, setLoading] = useState(!initialCatalog);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [visibleCount, setVisibleCount] = useState(16);
  const initialCatalogUsed = useRef(false);
  const { favorites } = useStoreFavorites();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get('q') || params.get('search') || '');
    setSection(params.get('section') || initialSection);
    setOnlyFavorites(params.get('favorites') === '1');
    setInitialized(true);
    if (params.get('search'))
      setTimeout(
        () =>
          document
            .querySelector<HTMLInputElement>('.store-search input')
            ?.focus(),
        100,
      );
  }, [initialSection]);
  useEffect(() => {
    if (!initialized) return;
    if (
      initialCatalog &&
      !initialCatalogUsed.current &&
      !query &&
      section === initialSection
    ) {
      initialCatalogUsed.current = true;
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [query, section, initialized, initialCatalog, initialSection]);
  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(
      () =>
        trackStore('search', {
          metadata: { query: query.trim().slice(0, 100) },
        }),
      600,
    );
    return () => clearTimeout(timer);
  }, [query]);
  const featured = useMemo(
    () => products.filter((product) => product.featured).slice(0, 6),
    [products],
  );
  const sizes = useMemo(
    () => [
      ...new Set(
        products.flatMap((product) =>
          product.variants.map((variant) => variant.size),
        ),
      ),
    ],
    [products],
  );
  const colors = useMemo(
    () => [
      ...new Set(
        products.flatMap((product) =>
          product.variants.map((variant) => variant.color),
        ),
      ),
    ],
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
  const hasActiveFilters = Boolean(
    size || color || onlyAvailable || onlyFavorites,
  );
  useEffect(
    () => setVisibleCount(16),
    [query, section, size, color, onlyAvailable, onlyFavorites, sort],
  );
  const visibleProducts = displayed.slice(0, visibleCount);
  return (
    <div className="store-shell">
      <StoreHeader />
      <main>
        {!initialSection && !query && !onlyFavorites && (
          <section className="store-campaign" aria-label="Descubrí FRAGUAN">
            <a className="store-campaign-panel campaign-new" href="/coleccion/nuevos">
              <span className="campaign-eyebrow">FRAGUAN · NUEVA TEMPORADA</span>
              <h1 className="animate__animated animate__fadeInUp">LO NUEVO.<br /><em>A TU MANERA.</em></h1>
              <span className="campaign-link">Ver novedades <ArrowRight /></span>
            </a>
            <a className="store-campaign-panel campaign-daily" href="/coleccion/remeras">
              <span className="campaign-eyebrow">TU ESTILO, TODOS LOS DÍAS</span>
              <h2 className="animate__animated animate__fadeInUp">MENOS<br />VUELTAS.<br /><em>MÁS VOS.</em></h2>
              <span className="campaign-link">Elegir remeras <ArrowRight /></span>
            </a>
          </section>
        )}
        <section className="store-catalog-section" id="coleccion">
          <div className="store-section-head">
            <div>
              <span>FRAGUAN / COLECCIÓN</span>
              <h2>{onlyFavorites ? 'Tus favoritos' : section || 'Encontrá tu próxima prenda'}</h2>
            </div>
            <p>{displayed.length} prendas para elegir</p>
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
          <div
            className="store-catalog-tools"
            aria-label="Filtrar y ordenar productos"
          >
            <label>
              Talle
              <select
                value={size}
                onChange={(event) => setSize(event.target.value)}
              >
                <option value="">Todos</option>
                {sizes.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Color
              <select
                value={color}
                onChange={(event) => setColor(event.target.value)}
              >
                <option value="">Todos</option>
                {colors.map((value) => (
                  <option key={value}>{value}</option>
                ))}
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
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
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
            <div
              className="store-loading-grid"
              aria-label="Preparando la colección"
            >
              {Array.from({ length: 8 }).map((_, index) => (
                <span key={index}>
                  <i />
                  <b />
                  <small />
                </span>
              ))}
            </div>
          ) : displayed.length ? (
            <>
              <div className="store-product-grid">
                {visibleProducts.map((product, index) => (
                  <StoreProductCard
                    product={product}
                    index={index}
                    key={product.id}
                  />
                ))}
              </div>
              <div className="store-catalog-more" aria-live="polite">
                <span>
                  Mostrando {visibleProducts.length} de {displayed.length}
                </span>
                {visibleProducts.length < displayed.length && (
                  <button
                    onClick={() => setVisibleCount((current) => current + 16)}
                  >
                    Mostrar más productos <ArrowDown />
                  </button>
                )}
              </div>
            </>
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
      </main>
      <StoreFooter />
    </div>
  );
}
