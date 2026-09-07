// Vercel ignoreCommand: GitHub remains the source of truth while production
// deploys stay paused until the owner explicitly enables them.
const enabled = process.env.FRAGUAN_DEPLOY_ENABLED === 'true';
process.exit(enabled ? 1 : 0);
