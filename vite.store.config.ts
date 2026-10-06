import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: [
      {
        find: /^tailwindcss$/,
        replacement: require.resolve('tailwindcss/index.css'),
      },
      {
        find: /^tw-animate-css$/,
        replacement: fileURLToPath(
          new URL(
            './node_modules/tw-animate-css/dist/tw-animate.css',
            import.meta.url,
          ),
        ),
      },
      {
        find: /^shadcn\/tailwind\.css$/,
        replacement: require.resolve('shadcn/tailwind.css'),
      },
      {
        find: /^animate\.css\/animate\.min\.css$/,
        replacement: require.resolve('animate.css/animate.min.css'),
      },
      {
        find: 'cloudflare:workers',
        replacement: fileURLToPath(
          new URL('./lib/node-worker-env.ts', import.meta.url),
        ),
      },
    ],
  },
  define: {
    'process.env.FRAGUAN_SURFACE': JSON.stringify('business'),
    'process.env.FRAGUAN_STAFF_OPEN_ACCESS': JSON.stringify(
      process.env.FRAGUAN_STAFF_OPEN_ACCESS ?? 'false',
    ),
    'process.env.FRAGUAN_DEPLOY_ENABLED': JSON.stringify('true'),
  },
  plugins: [vinext(), nitro()],
});
