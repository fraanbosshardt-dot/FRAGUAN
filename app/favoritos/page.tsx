import { DesignFavorites } from '@/components/store-design';
export const metadata = {
  title: 'Favoritos | FRAGUAN',
  robots: { index: false, follow: false },
};
export default function Page() {
  return <DesignFavorites />;
}
