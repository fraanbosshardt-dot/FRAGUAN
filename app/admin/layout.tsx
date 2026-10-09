import '../internal-workspace.css';
import type { ReactNode } from 'react';
import './admin-design.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-theme">{children}</div>;
}
