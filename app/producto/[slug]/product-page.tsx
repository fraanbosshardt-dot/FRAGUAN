'use client';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Minus,
  Plus,
  Ruler,
  ShieldCheck,
  Truck,
  Heart,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';
import { StoreProductCard } from '@/components/store-product-card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  StoreProduct,
  StoreVariant,
  storeApi,
  storeMoney,
  useStoreCart,
  useStoreFavorites,
} from '@/lib/store-client';

export default function ProductPage({ slug }: { slug: string }) {
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [related, setRelated] = useState<StoreProduct[]>([]);
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [fitPreference, setFitPreference] = useState('normal');
  const [recommendedSize, setRecommendedSize] = useState('');
  const { add } = useStoreCart();
  const { favorites, toggle } = useStoreFavorites();
  useEffect(() => {
    storeApi<{ product: StoreProduct; related: StoreProduct[] }>(
      `store-product?slug=${encodeURIComponent(slug)}`,
    )
      .then((data) => {
        setProduct(data.product);
        setRelated(data.related);
        setColor(
          data.product.variants.find((v) => v.stock)?.color ||
            data.product.variants[0]?.color ||
            '',
        );
      })
      .catch((cause) => setError(cause.message));
  }, [slug]);
  const colors = useMemo(
    () => [...new Set(product?.variants.map((v) => v.color) || [])],
    [product],
  );
  const variants = product?.variants.filter((v) => v.color === color) || [];
  const selected = variants.find((v) => v.size === size);
  function recommendSize() {
    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const available = [...new Set((product?.variants || []).filter((v) => v.stock > 0).map((v) => v.size))]
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (!available.length) return setRecommendedSize('Sin talles disponibles');
    const h = Number(height);
    const w = Number(weight);
    if (h < 130 || h > 230 || w < 35 || w > 220)
      return setRecommendedSize('Revisá altura y peso');
    const score = w / Math.pow(h / 100, 2);
    let position = score < 20 ? 0 : score < 24 ? 1 : score < 28 ? 2 : 3;
    position += h > 188 ? 1 : h < 165 ? -1 : 0;
    position += fitPreference === 'oversize' ? 1 : fitPreference === 'ajustado' ? -1 : 0;
    setRecommendedSize(available[Math.max(0, Math.min(available.length - 1, position))]);
  }
  function addSelected() {
    if (!product || !selected) return setError('Elegí un talle disponible.');
    add(product, selected, quantity);
    setAdded(true);
    setError('');
    setTimeout(() => setAdded(false), 1800);
  }
  useEffect(() => {
    const context =
      typeof document === 'undefined'
        ? undefined
        : (document as any).modelContext;
    if (!context?.registerTool || !product) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'add_product_to_cart',
          title: 'Agregar producto al carrito',
          description:
            'Agrega al carrito una variante disponible del producto visible.',
          inputSchema: {
            type: 'object',
            properties: {
              variantId: { type: 'string' },
              quantity: { type: 'integer', minimum: 1, maximum: 20 },
            },
            required: ['variantId', 'quantity'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: any) {
            const variant: StoreVariant | undefined = product.variants.find(
              (v) => v.id === input.variantId && v.stock >= input.quantity,
            );
            if (!variant) throw new Error('Variante sin stock suficiente.');
            add(product, variant, input.quantity);
            return {
              product: product.name,
              variantId: variant.id,
              quantity: input.quantity,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [product, add]);
  if (error && !product)
    return (
      <div className="store-shell">
        <StoreHeader />
        <main className="store-page-error">
          <h1>{error}</h1>
          <a href="/tienda">
            <ArrowLeft /> Volver a la tienda
          </a>
        </main>
      </div>
    );
  if (!product)
    return (
      <div className="store-shell">
        <StoreHeader />
        <div className="store-product-loading">Preparando el producto…</div>
      </div>
    );
  return (
    <div className="store-shell">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description,
            brand: { '@type': 'Brand', name: product.brand },
            sku: product.variants[0]?.sku,
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'ARS',
              lowPrice: product.price / 100,
              offerCount: product.variants.filter((variant) => variant.stock > 0).length,
              availability: product.variants.some((variant) => variant.stock > 0)
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            },
          }).replaceAll('<', '\\u003c'),
        }}
      />
      <StoreHeader />
      <main className="store-detail">
        <a className="store-back" href="/tienda">
          <ArrowLeft /> Volver
        </a>
        <section className="store-detail-grid">
          <div className="store-detail-art">
            <span>{product.category}</span>
            <strong>
              {product.name
                .split(' ')
                .map((word) => word[0])
                .join('')
                .slice(0, 3)}
            </strong>
            <small>
              {product.brand} / {product.section}
            </small>
          </div>
          <div className="store-detail-buy">
            <p className="store-detail-category">
              {product.category} · {product.fit}
            </p>
            <h1>{product.name}</h1>
            <p className="store-detail-description">
              {product.shortDescription}
            </p>
            <div className="store-detail-price">
              <strong>{storeMoney(selected?.price ?? product.price)}</strong>
              <span>
                Transferencia:{' '}
                {storeMoney(
                  Math.floor((selected?.price ?? product.price) * 0.9),
                )}
              </span>
            </div>
            <fieldset>
              <legend>
                Color <strong>{color}</strong>
              </legend>
              <div className="store-color-options">
                {colors.map((value) => (
                  <button
                    className={color === value ? 'active' : ''}
                    key={value}
                    onClick={() => {
                      setColor(value);
                      setSize('');
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>
                Talle{' '}
                <Dialog>
                  <DialogTrigger className="store-size-helper-trigger">
                    <Ruler /> ¿Qué talle soy?
                  </DialogTrigger>
                  <DialogContent className="store-size-dialog">
                    <DialogHeader>
                      <DialogTitle>Encontrá tu talle</DialogTitle>
                      <DialogDescription>
                        Una recomendación orientativa según tus medidas y el calce que preferís.
                      </DialogDescription>
                    </DialogHeader>
                    <label>Altura (cm)<input inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
                    <label>Peso (kg)<input inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
                    <label>¿Cómo te gusta usar la ropa?
                      <select value={fitPreference} onChange={(e) => setFitPreference(e.target.value)}>
                        <option value="ajustado">Ajustada</option>
                        <option value="normal">Normal</option>
                        <option value="oversize">Oversize</option>
                      </select>
                    </label>
                    <button className="store-size-recommend" onClick={recommendSize}>Recomendar talle</button>
                    {recommendedSize && (
                      <div className="store-size-result">
                        <span>TE RECOMENDAMOS</span>
                        <strong>{recommendedSize}</strong>
                        <small>Confirmá siempre con la guía de medidas de la prenda.</small>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </legend>
              <div className="store-size-options">
                {variants.map((variant) => (
                  <button
                    disabled={!variant.stock}
                    className={size === variant.size ? 'active' : ''}
                    key={variant.id}
                    onClick={() => {
                      setSize(variant.size);
                      setQuantity(1);
                    }}
                  >
                    {variant.size}
                    <small>
                      {variant.stock ? `${variant.stock} disp.` : 'Agotado'}
                    </small>
                  </button>
                ))}
              </div>
            </fieldset>
            {selected && (
              <div className="store-quantity">
                <span>Cantidad</span>
                <div>
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Minus />
                  </button>
                  <strong>{quantity}</strong>
                  <button
                    onClick={() =>
                      setQuantity(Math.min(selected.stock, quantity + 1))
                    }
                  >
                    <Plus />
                  </button>
                </div>
              </div>
            )}
            {error && <p className="store-buy-error">{error}</p>}
            <button
              className={`store-add-button ${added ? 'added' : ''}`}
              onClick={addSelected}
            >
              {added ? (
                <>
                  <Check /> Agregado al carrito
                </>
              ) : (
                <>
                  Agregar al carrito <ArrowRight />
                </>
              )}
            </button>
            <button
              className={`store-detail-favorite ${favorites.includes(product.id) ? 'active' : ''}`}
              onClick={() => toggle(product.id)}
            >
              <Heart fill={favorites.includes(product.id) ? 'currentColor' : 'none'} />
              {favorites.includes(product.id) ? 'Guardado en favoritos' : 'Guardar en favoritos'}
            </button>
            <div className="store-buy-benefits">
              <p>
                <Truck /> Envío calculado con tu código postal
              </p>
              <p>
                <ShieldCheck /> Cambios simples con el mismo historial online y
                local
              </p>
            </div>
          </div>
        </section>
        <section className="store-product-info" id="medidas">
          <div>
            <span>01</span>
            <h2>La prenda</h2>
            <p>{product.description}</p>
          </div>
          <div>
            <span>02</span>
            <h2>Calce y talle</h2>
            <p>
              Calce {product.fit}. Elegí tu talle habitual. Si estás entre dos
              talles, preferí el más grande.
            </p>
          </div>
          <div>
            <span>03</span>
            <h2>Material y cuidado</h2>
            <p>
              {product.material}
              <br />
              {product.care}
            </p>
          </div>
        </section>
        {!!related.length && (
          <section className="store-related">
            <div>
              <span>SEGUÍ MIRANDO</span>
              <h2>También puede ir con vos.</h2>
            </div>
            <div className="store-product-grid">
              {related.map((item, index) => (
                <StoreProductCard
                  product={item}
                  index={index + 2}
                  key={item.id}
                />
              ))}
            </div>
          </section>
        )}
      </main>
      <StoreFooter />
    </div>
  );
}
