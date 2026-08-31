/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4: scan source files + workspace packages for class names
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/api-client/src/**/*.{js,ts}',
    '../../packages/i18n/src/**/*.{js,ts}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // DressApp design tokens — mirroring index.css HSL variables
        background:   'hsl(40, 20%, 98%)',
        foreground:   'hsl(240, 10%, 12%)',
        card:         'hsl(0, 0%, 100%)',
        primary:      'hsl(240, 10%, 12%)',
        secondary:    'hsl(40, 15%, 93%)',
        muted:        'hsl(240, 5%, 94%)',
        'muted-fg':   'hsl(240, 5%, 45%)',
        accent:       'hsl(174, 44%, 33%)',   // ocean-teal
        'accent-fg':  'hsl(0, 0%, 100%)',
        brand:        'hsl(271, 81%, 56%)',   // brand purple
        'brand-fg':   'hsl(0, 0%, 100%)',
        'accent-green': 'hsl(142, 71%, 45%)',
        'accent-lilac': 'hsl(270, 60%, 90%)',
        destructive:  'hsl(0, 72%, 52%)',
        border:       'hsl(240, 6%, 90%)',
        input:        'hsl(240, 6%, 90%)',
        ring:         'hsl(271, 81%, 56%)',
        persimmon:    'hsl(18, 78%, 56%)',
        'sea-glass':  'hsl(170, 30%, 80%)',
        sand:         'hsl(40, 20%, 90%)',
      },
      borderRadius: {
        sm:  '8px',
        md:  '10px',
        lg:  '20px',
        xl:  '24px',
        '2xl': '28px',
        '3xl': '32px',
      },
      fontFamily: {
        display: ['PlayfairDisplay_400Regular'],
        'display-italic': ['PlayfairDisplay_400Regular_Italic'],
        body:   ['Manrope_400Regular'],
        medium: ['Manrope_500Medium'],
        semibold: ['Manrope_600SemiBold'],
        bold:   ['Manrope_700Bold'],
      },
    },
  },
  plugins: [],
};
