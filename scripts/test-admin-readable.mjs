import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

// Read-only HTTP verification of every registered admin page. No JavaScript,
// form submissions, databases, cookies or real transactions are modified.
const origin = process.argv[2] || 'https://www.fraguan.com';
const source = readFileSync('app/admin/[section]/page.tsx', 'utf8');
const registered = source.match(
  /const adminSections = new Set\(\[([\s\S]*?)\]\)/,
)?.[1];
assert.ok(registered, 'Registered admin routes must be found in the project');
const sections = [...registered.matchAll(/'([^']+)'/g)].map(
  (match) => match[1],
);
const headers = { 'User-Agent': 'Claude-User' };
const robotsResponse = await fetch(new URL('/robots.txt', origin), { headers });
assert.equal(robotsResponse.status, 200);
const robots = await robotsResponse.text();
assert.match(robots, /User-Agent: Claude-User[\s\S]*?Allow: \/admin/i);
const results = [];
for (let at = 0; at < sections.length; at += 3) {
  results.push(
    ...(await Promise.all(
      sections.slice(at, at + 3).map(async (section) => {
        const path = section === 'dashboard' ? '/admin' : '/admin/' + section;
        const response = await fetch(new URL(path, origin), {
          headers,
          signal: AbortSignal.timeout(60000),
        });
        const html = await response.text();
        const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
        const title =
          markup
            .match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]
            ?.replace(/<[^>]+>/g, '')
            .trim() ?? '';
        const main = markup.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '';
        const alerts = [
          ...main.matchAll(/<p\b[^>]*role="alert"[^>]*>([\s\S]*?)<\/p>/g),
        ].map((match) => match[1].replace(/<[^>]+>/g, ''));
        return {
          path,
          status: response.status,
          title,
          contentLength: main.length,
          ready:
            response.status === 200 &&
            Boolean(title) &&
            main.length > 300 &&
            !/loading-state/.test(main) &&
            !/Acceso denegado|Ingresá a Administración/.test(title) &&
            !alerts.length,
          alerts,
        };
      }),
    )),
  );
}
writeFileSync(
  'outputs/admin-readability-check.json',
  JSON.stringify(
    { origin, checkedAt: new Date().toISOString(), results },
    null,
    2,
  ),
);
const failed = results.filter((result) => !result.ready);
console.log(
  JSON.stringify(
    { pages: results.length, readable: results.length - failed.length, failed },
    null,
    2,
  ),
);
assert.equal(
  failed.length,
  0,
  'Every registered admin page must expose real content in its initial HTML',
);
