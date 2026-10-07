'use client';

const icons = {
  WhatsApp:
    'M20.5 3.5A11.5 11.5 0 0 0 2.4 17.3L1 23l5.8-1.5A11.5 11.5 0 0 0 20.5 3.5ZM12 21a9 9 0 0 1-4.6-1.3l-.3-.2-3.4.9.9-3.3-.2-.4A9 9 0 1 1 12 21Zm5-6.7c-.3-.2-1.7-.8-2-.9-.2-.1-.4-.1-.6.2l-.9 1c-.2.2-.3.2-.6.1-1.7-.8-2.9-1.9-3.7-3.4-.2-.3 0-.4.1-.6l.6-.8c.1-.2.1-.4 0-.6L9 7.4c-.1-.3-.3-.3-.5-.3H8c-.3 0-.6.2-.8.4-.3.4-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .1.2 2.1 3.4 5.2 4.6 1.9.8 2.7.8 3.7.5.6-.2 1.7-1 1.9-1.7.2-.7.2-1.3.1-1.4-.1-.2-.3-.3-.6-.4Z',
  Facebook:
    'M14 22v-9h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.4A25 25 0 0 0 15 1c-3 0-5 1.8-5 5v3H7v4h3v9Z',
  Pinterest:
    'M12 1a11 11 0 0 0-4 21c0-.9 0-2 .2-2.9l1.4-6s-.4-.7-.4-1.8c0-1.7 1-3 2.2-3 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.1 1.8 2.1 2.2 0 3.8-2.8 3.8-6 0-2.5-1.7-4.3-4.6-4.3-3.3 0-5.3 2.5-5.3 5.2 0 .9.2 1.6.7 2.1l.2.6-.2.9c0 .3-.3.4-.6.3-1.6-.6-2.4-2.3-2.4-4.2 0-3.1 2.6-6.9 7.9-6.9 4.2 0 6.9 3 6.9 6.2 0 4.3-2.4 7.5-5.9 7.5-1.2 0-2.4-.7-2.8-1.4l-.8 3c-.3 1-1 2.1-1.5 3A11 11 0 1 0 12 1Z',
  X: 'M18.9 2H22l-6.8 7.8L23 22h-6.1l-4.8-7.3L5.7 22H2.5l7.9-9L1 2h6.3l4.4 6.7ZM17.9 20h1.7L6.3 4H4.5Z',
};

export function StoreProductShare({ product }) {
  const url =
    'https://www.fraguan.com/producto/' + encodeURIComponent(product.slug);
  const title = product.name + ' · FRAGUAN';
  const encodedUrl = encodeURIComponent(url);
  const links = {
    WhatsApp: 'https://wa.me/?text=' + encodeURIComponent(title + '\n' + url),
    Facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl,
    Pinterest:
      'https://www.pinterest.com/pin/create/button/?url=' +
      encodedUrl +
      '&description=' +
      encodeURIComponent(title) +
      (product.imageUrl
        ? '&media=' + encodeURIComponent(new URL(product.imageUrl, url).href)
        : ''),
    X:
      'https://twitter.com/intent/tweet?url=' +
      encodedUrl +
      '&text=' +
      encodeURIComponent(title),
  };
  return (
    <section className="store-product-share" aria-label="Compartir producto">
      <span>Compartir</span>
      <div>
        {Object.entries(links).map(([name, href]) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={'Compartir en ' + name}
            title={'Compartir en ' + name}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d={icons[name]} />
            </svg>
          </a>
        ))}
      </div>
    </section>
  );
}
