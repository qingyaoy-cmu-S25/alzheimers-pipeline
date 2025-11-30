import { useEffect, useState } from 'react';
import { loader } from '@monaco-editor/react';

// Function to update Monaco editor theme
const updateMonacoTheme = async (isDark: boolean) => {
  try {
    // Use the loader to get monaco instance
    const monaco = await loader.init();
    
    // Define custom white theme if it doesn't exist
    try {
      monaco.editor.defineTheme('custom-white', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#ffffff',
          'editor.foreground': '#000000',
        }
      });
    } catch (error) {
      // Theme might already be defined, that's okay
    }
    
    // Set the theme
    const theme = isDark ? 'vs-dark' : 'custom-white';
    monaco.editor.setTheme(theme);
    console.log('Monaco theme set to:', theme, 'isDark:', isDark);
  } catch (error) {
    // Monaco might not be loaded yet, that's okay
    console.log('Monaco not available yet, will retry on next change');
  }
};

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
    
    // Try to set Monaco theme on initial load
    updateMonacoTheme(initialDark);
    
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
    
    // Update Monaco editor theme when dark mode changes
    updateMonacoTheme(isDark);
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

