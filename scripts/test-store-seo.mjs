import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { actor, fixture } from '../tests-cashback-regressions.mjs';

function pure(file, require) {
  const loaded = { exports: {} };
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  vm.runInNewContext(compiled.outputText, {
    module: loaded,
    exports: loaded.exports,
    URL,
    require,
  });
  return loaded.exports;
}
const seo = pure('lib/store-seo-data.ts');
test('product markup uses online prices and retains unavailable sizes without invented identifiers', () => {
  const product = {
    id: 'p',
    name: 'Remera',
    slug: 'remera',
    category: 'Remeras',
    shortDescription: '',
    description: '',
    brand: '',
    imageUrl: '/api/store-image?id=foto',
    variants: [
      { id: 'v1', sku: 'A', color: 'Negro', size: 'L', price: 12345, stock: 2 },
      {
        id: 'v2',
        sku: 'B',
        color: 'Negro',
        size: 'XL',
        price: 15000,
        stock: 0,
      },
    ],
  };
  const schema = seo.productStructuredData(product);
  assert.equal(schema.hasVariant[0].offers.price, 123.45);
  assert.equal(
    schema.hasVariant[1].offers.availability,
    'https://schema.org/OutOfStock',
  );
  assert.equal(schema.hasVariant[1].size, 'XL');
  assert.equal(
    schema.hasVariant[0].image,
    'https://www.fraguan.com/api/store-image?id=foto',
  );
  assert.equal(schema.brand, undefined);
  assert.equal(schema.hasVariant[0].gtin13, undefined);
  assert.ok(schema.description.length > 0);
});
test('public SEO defaults stay distinct and category aliases share the canonical URL', () => {
  assert.match(
    seo.productSeo({
      name: 'Camisa Oxford',
      category: 'Camisas',
      shortDescription: 'Una prenda versátil para usar todos los días.',
    }).description,
    /Camisa Oxford/,
  );
  assert.equal(
    seo.collectionSeo('abrigos').path,
    seo.collectionSeo('camperas').path,
  );
  assert.equal(
    seo.collectionSlug('Pantalones de vestir'),
    'pantalones-de-vestir',
  );
  const pages = [
    seo.HOME_SEO,
    ...Object.values(seo.INFORMATION_SEO),
    ...Object.keys(seo.COLLECTION_NAMES)
      .filter((k) => k !== 'abrigos')
      .map(seo.collectionSeo),
  ];
  assert.equal(new Set(pages.map((p) => p.title)).size, pages.length);
  for (const p of pages) {
    assert.ok(p.title.length <= 70);
    assert.ok(p.description.length <= 180);
  }
});
test('robots blocks Admin, POS and private operations while allowing product images', () => {
  const config = pure('app/robots.ts').default();
  const google = config.rules.find((r) => r.userAgent === '*');
  for (const path of ['/admin', '/pos', '/checkout', '/cuenta', '/pedido/'])
    assert.ok(google.disallow.includes(path));
  assert.ok(google.allow.includes('/api/store-image'));
});
test('sitemap contains canonical public URLs and retains products without stock', async () => {
  const sitemap = pure('app/sitemap.ts', (name) =>
    name === '@/lib/store-seo-data'
      ? seo
      : {
          storeCatalog: async () => ({
            sections: [{ name: 'Abrigos' }, { name: 'Camperas' }],
            products: [
              {
                slug: 'campera-prueba',
                category: 'Camperas',
                variants: [{ stock: 0 }],
              },
            ],
          }),
        },
  );
  const urls = (await sitemap.default()).map((p) => p.url);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.includes('https://www.fraguan.com/producto/campera-prueba'));
  assert.ok(urls.includes('https://www.fraguan.com/coleccion/camperas'));
  assert.ok(
    !urls.some((url) =>
      /\/(admin|pos|cuenta|checkout|pedido|carrito|favoritos|gracias)(\/|$)/.test(
        url,
      ),
    ),
  );
  assert.ok(!urls.includes('https://www.fraguan.com/coleccion/abrigos'));
});
test('admin audit covers home, collections, information and published products only', async (t) => {
  const f = fixture(t);
  f.database.exec(
    `INSERT INTO online_product_profiles(productId,slug,shortDescription,description,fit,section,published,updatedAt) VALUES ('product','camisa-prueba','','','Regular','Camisas',1,'2026-10-09');`,
  );
  const audit = await f.load('lib/store-seo.ts').seoAudit(actor);
  for (const path of [
    '/',
    '/coleccion/camisas',
    '/informacion/envios',
    '/producto/camisa-prueba',
  ])
    assert.ok(audit.pages.some((p) => p.path === path));
  assert.ok(
    !audit.pages.some((p) => /^\/(admin|pos|cuenta|checkout)/.test(p.path)),
  );
  assert.ok(
    audit.pages.find((p) => p.path === '/producto/camisa-prueba').issues
      .length > 0,
  );
  await assert.rejects(
    f.load('lib/store-seo.ts').seoAudit({ ...actor, role: 'VENDEDOR' }),
  );
  for (const path of [
    '/admin',
    '/admin/products',
    '/pos',
    '/cuenta',
    '/checkout',
    '/pedido/123',
  ]) {
    await assert.rejects(
      f.load('lib/store-seo.ts').saveStoreSeo(actor, {
        path,
        title: 'No publicar',
        description: '',
        verification: '',
      }),
    );
  }
});
