'use client';
import { ArrowUpRight, Heart } from 'lucide-react';
import { StoreProduct, storeMoney, useStoreFavorites } from '@/lib/store-client';

const tones = ['acid', 'ink', 'clay', 'forest', 'silver', 'ink'];
export function StoreProductCard({
  product,
  index = 0,
  wide = false,
}: {
  product: StoreProduct;
  index?: number;
  wide?: boolean;
}) {
  const { favorites, toggle } = useStoreFavorites();
  const favorite = favorites.includes(product.id);
  const stock = product.variants.reduce(
    (total, variant) => total + variant.stock,
    0,
  );
  const colors = [
    ...new Set(product.variants.filter((v) => v.stock > 0).map((v) => v.color)),
  ];
  return (
    <article className={`store-product-card ${tones[index % tones.length]} ${wide ? 'wide' : ''}`}>
      <button
        className={`store-favorite-button ${favorite ? 'active' : ''}`}
        onClick={() => toggle(product.id)}
        aria-label={favorite ? `Quitar ${product.name} de favoritos` : `Guardar ${product.name} en favoritos`}
      >
        <Heart fill={favorite ? 'currentColor' : 'none'} />
      </button>
      <a aria-label={`Ver ${product.name}`} href={`/producto/${product.slug}`}>
        <div className="store-product-art" aria-hidden="true">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <strong>
          {product.name
            .split(' ')
            .map((word) => word[0])
            .join('')
            .slice(0, 3)}
        </strong>
        <i>{product.category}</i>
        </div>
        <div className="store-product-copy">
        <span>{product.category}</span>
        <h3>{product.name}</h3>
        <p>{colors.slice(0, 3).join(' · ') || 'Sin stock'}</p>
        <div>
          <strong>{storeMoney(product.price)}</strong>
          <small>{stock ? `${stock} disponibles` : 'Agotado'}</small>
          <ArrowUpRight />
        </div>
        </div>
      </a>
    </article>
  );
}
