export function isProductionComingSoon() {
  return (
    process.env.FRAGUAN_COMING_SOON === 'true' ||
    process.env.VERCEL_ENV === 'production'
  );
}
