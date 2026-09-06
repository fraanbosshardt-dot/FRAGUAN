'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('fraguan-theme');
    const value = saved
      ? saved === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(value);
    document.documentElement.classList.toggle('dark', value);
  }, []);
  return (
    <Button
      variant="outline"
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onClick={() => {
        const value = !dark;
        setDark(value);
        localStorage.setItem('fraguan-theme', value ? 'dark' : 'light');
        document.documentElement.classList.toggle('dark', value);
      }}
    >
      {dark ? 'Tema claro' : 'Tema oscuro'}
    </Button>
  );
}
