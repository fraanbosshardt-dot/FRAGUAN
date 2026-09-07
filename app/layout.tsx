import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'FRAGUAN | Tienda oficial',
  description:
    'Indumentaria FRAGUAN. Comprá online por talle y color, con envíos a todo el país y beneficios del Club.',
  openGraph: {
    title: 'FRAGUAN | Tienda oficial',
    description: 'Indumentaria FRAGUAN con envíos a todo el país.',
  },
  twitter: { card: 'summary', title: 'FRAGUAN | Tienda oficial' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
