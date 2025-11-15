import { useEffect, useState } from 'react';

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    // Check localStorage first, then system preference
    const stored = localStorage.getItem('darkMode');
    let initialDark = false;
    if (stored !== null) {
      initialDark = stored === 'true';
    } else {
      initialDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    // Apply immediately to avoid flash
    const root = document.documentElement;
    if (initialDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    return initialDark;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(isDark));
  }, [isDark]);

  const toggleDarkMode = (value?: boolean) => {
    if (value !== undefined) {
      setIsDark(value);
    } else {
      setIsDark(prev => !prev);
    }
  };

  return { isDark, toggleDarkMode };
}

