'use client';
// Dark is the default; light is a full theme. Remembers the choice.
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light' | null>(null);
  useEffect(() => setTheme((document.documentElement.dataset.theme as 'dark' | 'light') ?? 'dark'), []);
  const flip = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'light' ? '#ffffff' : '#000000');
    try { localStorage.setItem('tx-theme', next); } catch { /* private mode */ }
    setTheme(next);
  };
  return (
    <button className="tx-iconbtn" onClick={flip} aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
      {theme === 'light' ? <Moon /> : <Sun />}
    </button>
  );
}
