'use client';
import { Bell, Check, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { StoreProduct, storeApi } from '@/lib/store-client';

type Review = { id: string; displayName: string; rating: number; title: string; body: string; verified: number; createdAt: string };

export function StoreProductTrust({ product }: { product: StoreProduct }) {
  const [reviews, setReviews] = useState<{ average: number; total: number; reviews: Review[] }>({ average: 0, total: 0, reviews: [] });
  const [email, setEmail] = useState('');
  const [variantId, setVariantId] = useState(product.variants.find((v) => !v.stock)?.id || '');
  const [notice, setNotice] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  useEffect(() => { storeApi(`store-reviews?productId=${encodeURIComponent(product.id)}`).then(setReviews).catch(() => undefined); }, [product.id]);
  async function waitForStock(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await storeApi('store-back-in-stock', { method: 'POST', body: JSON.stringify({ variantId, email }) });
      setNotice('Te avisaremos apenas vuelva esa variante.');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'No pudimos guardar el aviso.');
    }
  }
  async function review(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await storeApi('store-review', { method: 'POST', body: JSON.stringify({
        productId: product.id, orderId: form.get('orderId') || '', email: form.get('email'),
        displayName: form.get('displayName'), rating: Number(form.get('rating')),
        title: form.get('title') || '', body: form.get('body'),
      }) });
      setNotice('Gracias. Publicaremos tu reseña después de revisarla.');
      setReviewOpen(false);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'No pudimos enviar la reseña.');
    }
  }
  const unavailable = product.variants.filter((v) => !v.stock);
  return <section className="store-product-trust">
    {!!unavailable.length && <div className="store-stock-alert-form">
      <Bell /><div><span>AVISO DE REPOSICIÓN</span><h2>¿No está tu talle?</h2><p>Te escribimos una sola vez cuando vuelva.</p>
      <form onSubmit={waitForStock}><select value={variantId} onChange={(e) => setVariantId(e.target.value)} required>{unavailable.map((v) => <option value={v.id} key={v.id}>{v.color} · talle {v.size}</option>)}</select><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" maxLength={200} placeholder="tu@email.com" required/><button>Avisarme</button></form></div>
    </div>}
    <div className="store-reviews">
      <header><div><span>OPINIONES</span><h2>{reviews.total ? `${reviews.average.toFixed(1)} de 5` : 'Tu experiencia cuenta'}</h2><p>{reviews.total ? `${reviews.total} opiniones de clientes` : 'Sé el primero en contar cómo te quedó.'}</p></div><button onClick={() => setReviewOpen(!reviewOpen)}>Escribir una opinión</button></header>
      {reviewOpen && <form className="store-review-form" onSubmit={review}><input name="displayName" maxLength={80} autoComplete="name" placeholder="Nombre visible" required/><input name="email" type="email" maxLength={200} autoComplete="email" placeholder="Email" required/><select name="rating" defaultValue="5" required>{[5,4,3,2,1].map((n) => <option value={n} key={n}>{n} estrellas</option>)}</select><input name="orderId" maxLength={36} placeholder="ID del pedido (opcional, para verificar compra)"/><input name="title" maxLength={100} placeholder="Título (opcional)"/><textarea name="body" minLength={10} maxLength={600} placeholder="Contanos sobre el calce, la tela y el talle" required/><button>Enviar opinión</button></form>}
      <div className="store-review-list">{reviews.reviews.map((item) => <article key={item.id}><div>{Array.from({ length: 5 }).map((_, i) => <Star key={i} fill={i < item.rating ? 'currentColor' : 'none'} />)}</div><h3>{item.title || 'Opinión sobre la prenda'}</h3><p>{item.body}</p><small>{item.displayName}{item.verified ? ' · Compra verificada' : ''}</small></article>)}</div>
    </div>
    {notice && <output className="store-inline-success"><Check /> {notice}</output>}
  </section>;
}
