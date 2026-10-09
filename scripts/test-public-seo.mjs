// Read-only production checks: no orders, accounts or emails are created.
import assert from 'node:assert/strict';
const origin = 'https://www.fraguan.com';
const fetchPage = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  return { response, html: await response.text() };
};
const { response: sitemapResponse, html: xml } = await fetchPage(
  origin + '/sitemap.xml',
);
assert.equal(sitemapResponse.status, 200);
const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
assert.equal(urls.length, new Set(urls).size);
const privatePath =
  /^\/(admin(?:-access)?|pos|acceso|cuenta|carrito|favoritos|checkout|pedido|gracias|recuperar-carrito)(?:\/|$)/;
for (const url of urls) {
  assert.equal(new URL(url).origin, origin);
  assert.ok(!privatePath.test(new URL(url).pathname));
  const { response, html } = await fetchPage(url);
  assert.equal(response.status, 200, `Página pública: ${url}`);
  assert.match(html, /<h1\b/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]+"/);
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  assert.equal(new URL(canonical).href, new URL(url).href, `Canónica: ${url}`);
  assert.ok(!/<meta name="robots" content="[^"]*noindex/.test(html), url);
  const structured = [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
    ),
  ].map((m) => JSON.parse(m[1]));
  const organization = structured.find(
    (p) => p['@id'] === origin + '/#organization',
  );
  assert.equal(
    organization.hasMerchantReturnPolicy.merchantReturnLink,
    origin + '/informacion/cambios',
  );
  if (new URL(url).pathname.startsWith('/producto/')) {
    const group = structured.find((p) => p['@type'] === 'ProductGroup');
    assert.ok(group.hasVariant.length);
    for (const product of group.hasVariant) {
      assert.equal(product.offers.priceCurrency, 'ARS');
      assert.ok(Number.isFinite(product.offers.price));
      assert.ok(product.description);
    }
  }
  console.log(`OK público: ${new URL(url).pathname}`);
}
for (const path of [
  '/admin',
  '/admin/products',
  '/pos',
  '/cuenta',
  '/checkout',
  '/carrito',
  '/favoritos',
]) {
  const { response, html } = await fetchPage(origin + path);
  assert.ok(
    response.status === 404 ||
      /<meta name="robots" content="[^"]*noindex/.test(html),
    `Falta noindex: ${path}`,
  );
  console.log(`OK fuera de Google: ${path}`);
}
const { html: robots } = await fetchPage(origin + '/robots.txt');
const general = robots.split(/User-Agent:\s*\*/i)[1].split(/User-Agent:/i)[0];
assert.match(general, /Disallow: \/admin/);
assert.match(general, /Disallow: \/pos/);
for (const path of [
  '/producto/no-existe-auditoria-seo',
  '/coleccion/no-existe-auditoria-seo',
]) {
  const { response } = await fetchPage(origin + path);
  assert.equal(response.status, 404);
}
console.log(
  `Verificadas ${urls.length} páginas públicas, 7 rutas privadas, robots y errores 404.`,
);
