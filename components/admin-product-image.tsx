'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';

export function AdminProductImage({
  productId,
  name,
}: {
  productId: string;
  name: string;
}) {
  const [image, setImage] = useState<{ url: string; alt: string } | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let current = true;
    setImage(null);
    api('product-image?productId=' + encodeURIComponent(productId))
      .then((data) => {
        if (current) setImage(data.image);
      })
      .catch((e) => {
        if (current) setNotice(e.message);
      });
    return () => {
      current = false;
    };
  }, [productId]);
  const upload = async (file: File) => {
    setBusy(true);
    setNotice('');
    try {
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 20_000_000
      )
        throw new Error('Elegí una foto JPG, PNG o WebP de hasta 20 MB.');
      const bitmap = await createImageBitmap(file);
      let base64 = '',
        mime = 'image/webp';
      try {
        const canvas = document.createElement('canvas'),
          scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No pudimos preparar la imagen.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/webp', 0.82);
        mime = data.slice(5, data.indexOf(';'));
        base64 = data.split(',')[1];
        if (base64.length > 1_333_332)
          throw new Error(
            'La foto sigue siendo muy pesada. Elegí una imagen más chica.',
          );
      } finally {
        bitmap.close();
      }
      const data = await api('product-image', {
        productId,
        mime,
        base64,
        alt: name,
      });
      setImage(data.image);
      setNotice('Foto guardada. Ya se muestra en la tienda.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'No pudimos guardar la foto.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="admin-product-photo">
      <strong>Foto del producto</strong>
      {image && (
        <img
          src={image.url}
          alt={image.alt}
          width={160}
          height={180}
          style={{ objectFit: 'contain', maxWidth: '100%' }}
        />
      )}
      <label className="admin-tool-field">
        {busy
          ? 'Preparando y guardando…'
          : image
            ? 'Reemplazar foto'
            : 'Cargar foto'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void upload(file);
          }}
        />
      </label>
      <small>
        Se guarda al elegirla. La foto se optimiza para la web y se usa también
        al compartir el producto.
      </small>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
