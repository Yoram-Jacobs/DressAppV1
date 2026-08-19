/**
 * apps/mobile/src/theme/index.ts
 *
 * Theme context for the DressApp mobile app.
 * Provides the active color palette (light/dark) throughout the app.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { lightColors, darkColors } from './tokens';

// ColorTokens accepts either palette so ThemeContext.Provider value typechecks.
export type ColorTokens = typeof lightColors | typeof darkColors;

interface ThemeContextValue {
  colors: ColorTokens;
  isDark: boolean;
  scheme: ColorSchemeName;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<ColorSchemeName>(null);
  const systemScheme = Appearance.getColorScheme();
  const scheme = override ?? systemScheme;
  const isDark = scheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (!override) {
        // Let system changes propagate when there's no manual override
        setOverride(null);
      }
    });
    return () => subscription.remove();
  }, [override]);

  const toggle = () => setOverride(isDark ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ colors, isDark, scheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export { lightColors, darkColors } from './tokens';
export * from './tokens';
