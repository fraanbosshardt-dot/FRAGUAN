import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'FRAGUAN · Gestión & Punto de venta',
  description:
    'El espacio de trabajo de FRAGUAN. Ventas, colección y gestión del negocio.',
  openGraph: {
    title: 'FRAGUAN · Gestión & Punto de venta',
    description: 'Ventas, colección y gestión del negocio.',
  },
  twitter: { card: 'summary', title: 'FRAGUAN · Gestión & Punto de venta' },
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
