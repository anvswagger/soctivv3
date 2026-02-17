import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes/dist/types";

interface ExtendedThemeProviderProps extends Omit<ThemeProviderProps, 'defaultTheme'> {
  children: React.ReactNode;
  defaultTheme?: 'system' | 'light' | 'dark' | 'sepia' | 'high-contrast';
  enableAutoTime?: boolean;
}

const THEMES = ['light', 'dark', 'sepia', 'high-contrast'] as const;
type Theme = typeof THEMES[number];

export { THEMES, type Theme };

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  enableAutoTime = true,
  ...props
}: ExtendedThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false);
  const [autoTheme, setAutoTheme] = React.useState<Theme>('light');

  // Handle auto time-based theme switching
  React.useEffect(() => {
    if (!enableAutoTime) {
      setAutoTheme('light');
      return;
    }

    const updateThemeBasedOnTime = () => {
      const hour = new Date().getHours();
      // Light theme: 6 AM - 8 PM
      // Dark theme: 8 PM - 6 AM
      // Sepia: optional for reading (6 AM - 10 PM)
      // High-contrast: manual only
      let theme: Theme;
      if (hour >= 6 && hour < 20) {
        theme = 'light';
      } else if (hour >= 20 || hour < 6) {
        theme = 'dark';
      } else {
        theme = 'light';
      }
      setAutoTheme(theme);
    };

    // Initial update
    updateThemeBasedOnTime();

    // Update at theme transition points
    const checkInterval = setInterval(() => {
      updateThemeBasedOnTime();
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [enableAutoTime]);

  // Handle system preference changes
  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (defaultTheme === 'system' && !enableAutoTime) {
        setAutoTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [defaultTheme, enableAutoTime]);

  // Mount check for SSR compatibility
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Calculate the actual theme to use
  const resolvedTheme = React.useMemo(() => {
    if (!mounted) return 'light';

    // If user has set a manual theme, use that
    if (defaultTheme !== 'system') {
      return defaultTheme;
    }

    // If auto-time is enabled, use the calculated theme
    if (enableAutoTime) {
      return autoTheme;
    }

    // Otherwise, let next-themes handle system preference
    return 'system';
  }, [mounted, defaultTheme, enableAutoTime, autoTheme]);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={resolvedTheme}
      enableSystem={!enableAutoTime}
      themes={['light', 'dark', 'sepia', 'high-contrast']}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

// Custom hook for theme management
export function useTheme() {
  const { theme, setTheme, resolvedTheme, themes } = (window as any).__next_themes_context?.() || {
    theme: 'light',
    setTheme: () => { },
    resolvedTheme: 'light',
    themes: ['light', 'dark'],
  };

  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const actualTheme = mounted ? resolvedTheme : 'light';

  return {
    theme: actualTheme,
    setTheme: (newTheme: string) => {
      setTheme(newTheme);
      // Save user preference
      try {
        localStorage.setItem('soctiv_theme_preference', newTheme);
      } catch {
        // ignore storage errors
      }
    },
    resolvedTheme: actualTheme,
    themes: THEMES,
    isDark: actualTheme === 'dark',
    isLight: actualTheme === 'light',
    isSepia: actualTheme === 'sepia',
    isHighContrast: actualTheme === 'high-contrast',
    mounted,
  };
}

// Theme-aware color utilities
export const themeColors = {
  light: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(222 47% 11%)',
    primary: 'hsl(221 83% 53%)',
    secondary: 'hsl(210 40% 96%)',
    muted: 'hsl(210 40% 96%)',
    accent: 'hsl(210 40% 96%)',
  },
  dark: {
    background: 'hsl(222 47% 11%)',
    foreground: 'hsl(210 40% 98%)',
    primary: 'hsl(217 91% 60%)',
    secondary: 'hsl(217 33% 17%)',
    muted: 'hsl(217 33% 17%)',
    accent: 'hsl(217 33% 17%)',
  },
  sepia: {
    background: 'hsl(40 30% 92%)',
    foreground: 'hsl(35 20% 25%)',
    primary: 'hsl(25 85% 45%)',
    secondary: 'hsl(40 30% 85%)',
    muted: 'hsl(40 30% 85%)',
    accent: 'hsl(40 30% 85%)',
  },
  highContrast: {
    background: 'hsl(0 0% 0%)',
    foreground: 'hsl(0 0% 100%)',
    primary: 'hsl(60 100% 50%)',
    secondary: 'hsl(0 0% 20%)',
    muted: 'hsl(0 0% 20%)',
    accent: 'hsl(0 0% 20%)',
  },
};

export function getThemeColors(theme: string) {
  return themeColors[theme as keyof typeof themeColors] || themeColors.light;
}
