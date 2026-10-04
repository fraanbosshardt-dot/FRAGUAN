import { spawnSync } from 'node:child_process';

const preset = process.argv[2] ?? 'vercel';
if (!['vercel', 'node-server'].includes(preset))
  throw new Error('El destino debe ser vercel o node-server.');
const result = spawnSync(process.execPath, [
  'node_modules/vite/bin/vite.js', 'build', '--config', 'vite.store.config.ts',
], {
  stdio: 'inherit',
  env: { ...process.env, NITRO_PRESET: preset },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
