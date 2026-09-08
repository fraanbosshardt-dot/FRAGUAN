export function isProductionComingSoon() {
  if (process.env.FRAGUAN_DEPLOY_ENABLED === 'true') return false;
  return (
    process.env.FRAGUAN_COMING_SOON === 'true' ||
    process.env.VERCEL_ENV === 'production'
  );
}
