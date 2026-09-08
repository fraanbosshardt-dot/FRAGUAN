import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('public', { recursive: true });
await writeFile(
  'public/index.html',
  `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FRAGUAN · Próximamente</title>
    <style>
      :root { color-scheme: dark; font-family: Arial, Helvetica, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111210; color: #f5f2e9; }
      main { width: min(720px, 100%); padding: 32px; text-align: center; }
      .mark { width: 112px; height: 112px; margin: 0 auto 28px; display: block; object-fit: cover; border-radius: 50%; }
      .eyebrow { color: #d8ff45; font-size: 12px; letter-spacing: .18em; }
      h1 { margin: 18px 0; font-size: clamp(42px, 9vw, 96px); line-height: .95; letter-spacing: -.06em; }
      p { color: #b9bbb3; font-size: 18px; line-height: 1.5; }
      small { display: block; margin-top: 32px; color: #777a72; }
    </style>
  </head>
  <body>
    <main>
      <img class="mark" src="/fraguan-logo.jpg" alt="FRAGUAN" />
      <div class="eyebrow">FRAGUAN · FORJÁ TU ESTILO</div>
      <h1>Próximamente disponible.</h1>
      <p>Estamos preparando el lanzamiento oficial de FRAGUAN. Volvé pronto.</p>
      <small>fraguan.com</small>
    </main>
  </body>
</html>`,
  'utf8',
);
