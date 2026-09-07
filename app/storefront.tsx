'use client';
import { ArrowDown, ArrowRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StoreHeader } from '@/components/store-header';
import { StoreProductCard } from '@/components/store-product-card';
import { StoreProduct, storeApi } from '@/lib/store-client';

export default function Storefront() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [sections, setSections] = useState<
    { name: string; products: number }[]
  >([]);
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSection(params.get('section') || '');
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
  async function subscribe(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewsletterState('Enviando…');
    try {
      await storeApi('store-newsletter', {
        method: 'POST',
        body: JSON.stringify({ email: newsletterEmail, source: 'storefront' }),
      });
      setNewsletterEmail('');
      setNewsletterState(
        'Listo. Te avisamos cuando haya algo que valga la pena.',
      );
    } catch (cause: any) {
      setNewsletterState(cause.message || 'No pudimos suscribirte.');
    }
  }
  const featured = useMemo(
    () => products.filter((product) => product.featured).slice(0, 6),
    [products],
  );
  return (
    <div className="store-shell">
      <StoreHeader />
      <main>
        <section className="store-hero">
          <div className="store-hero-kicker">
            <span>FRG / 26</span>
            <span>BUENOS AIRES</span>
          </div>
          <h1>
            VESTIR
            <br />
            <em>SE SIENTE.</em>
          </h1>
          <div className="store-hero-bottom">
            <p>
              Prendas que entran fácil en tu vida y se quedan. Elegí tu talle,
              tu color y seguí.
            </p>
            <a href="#coleccion">
              Ver colección <ArrowDown />
            </a>
          </div>
          <div className="store-orbit" aria-hidden="true">
            <span>NUEVA TEMPORADA · FRAGUAN ·</span>
          </div>
        </section>
        <div className="store-marquee" aria-hidden="true">
          <span>
            HECHO PARA MOVERTE — SIMPLE PARA COMBINAR — HECHO PARA MOVERTE —
            SIMPLE PARA COMBINAR —{' '}
          </span>
        </div>
        <section className="store-catalog-section" id="coleccion">
          <div className="store-section-head">
            <div>
              <span>01 / COLECCIÓN</span>
              <h2>{section || 'Elegí sin vueltas'}</h2>
            </div>
            <p>{products.length} productos · Stock actualizado</p>
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
          {error && <p className="store-error">{error}</p>}
          {loading ? (
            <div className="store-loading">Preparando la colección…</div>
          ) : products.length ? (
            <div className="store-product-grid">
              {products.map((product, index) => (
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
      </main>
      <footer className="store-footer">
        <a href="/">FRAGUAN</a>
        <div>
          <a href="/cuenta">Mi cuenta</a>
          <a href="#coleccion">Productos</a>
          <a href="/pos">Acceso interno</a>
        </div>
        <p>
          Buenos Aires · Argentina
          <br />© 2026 FRAGUAN
        </p>
        <div className="store-newsletter">
          <span>NEWSLETTER FRAGUAN</span>
          <strong>Novedades, drops y beneficios.</strong>
          <form onSubmit={subscribe}>
            <input
              type="email"
              value={newsletterEmail}
              onChange={(event) => setNewsletterEmail(event.target.value)}
              placeholder="Tu email"
              required
              aria-label="Email para newsletter"
            />
            <button type="submit">
              Unirme <ArrowRight />
            </button>
          </form>
          {newsletterState && <small>{newsletterState}</small>}
        </div>
      </footer>
    </div>
  );
}
