'use client';

import { useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Get theme from localStorage or system preference
    const stored = localStorage.getItem('theme') as ThemeMode | null;
    if (stored) {
      setTheme(stored);
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(systemPrefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Apply theme to document
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(systemPrefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }

    // Store preference
    localStorage.setItem('theme', theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((current) => {
      if (current === 'dark') return 'light';
      if (current === 'light') return 'system';
      return 'dark';
    });
  };

  const setThemeMode = (mode: ThemeMode) => {
    setTheme(mode);
  };

  return {
    theme,
    mounted,
    toggleTheme,
    setThemeMode,
  };
}
