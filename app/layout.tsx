import type { Metadata } from 'next';
import { env } from 'cloudflare:workers';
import './globals.css';
export function generateMetadata(): Metadata {
  const title = 'FRAGUAN · Gestión & Punto de venta',
    description =
      'El espacio de trabajo de FRAGUAN. Ventas, colección y gestión del negocio.';
  const origin = env.SITE_ORIGIN;
  const image = origin ? new URL('/og.png', origin).href : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(image ? { images: [{ url: image, width: 1736, height: 906 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
