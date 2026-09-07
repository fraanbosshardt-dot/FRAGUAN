import ProductPage from './product-page';
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <ProductPage slug={(await params).slug} />;
}
