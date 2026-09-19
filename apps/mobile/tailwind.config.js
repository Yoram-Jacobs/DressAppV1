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
        // DressApp design tokens — mirroring index.css & web tailwind
        background:   '#F7F7F2',
        foreground:   '#000000',
        card:         '#FFFFFF',
        primary:      '#1F5C45',   // signature emerald forest green
        secondary:    '#F5EEE9',   // warm accent beige
        muted:        'hsl(240, 5%, 94%)',
        'muted-fg':   '#666666',
        accent:       '#1F5C45',
        'accent-fg':  '#FFFFFF',
        brand:        '#1F5C45',
        'brand-fg':   '#FFFFFF',
        'primary-brand': '#1F5C45',
        'primary-hover': '#174533',
        'light-bg':   '#F7F7F2',
        'accent-beige': '#F5EEE9',
        'dark-brand': '#000000',
        'text-brand': '#666666',
        'primary-shadow': 'rgba(31, 92, 69, 0.06)',
        'yellow-brand': '#FAD459',
        'yellow-shadow': 'rgba(250, 212, 89, 0.26)',
        'yellow-border': '#FFE48F',
        glass:        'rgba(255, 255, 255, 0.85)',
        'accent-green': 'hsl(142, 71%, 45%)',
        'accent-lilac': 'hsl(270, 60%, 90%)',
        destructive:  'hsl(0, 72%, 52%)',
        border:       '#E5E7EB',
        input:        '#E5E7EB',
        ring:         '#1F5C45',
        persimmon:    'hsl(18, 78%, 56%)',
        'sea-glass':  'hsl(170, 30%, 80%)',
        sand:         '#F5EEE9',
      },
      borderRadius: {
        sm:  '8px',
        md:  '10px',
        lg:  '20px',
        xl:  '24px',
        '2xl': '28px',
        '3xl': '32px',
        full: '9999px',
      },
      fontFamily: {
        display: ['PlusJakartaSans_700Bold'],
        'display-italic': ['PlusJakartaSans_500Medium_Italic'],
        body:   ['PlusJakartaSans_400Regular'],
        medium: ['PlusJakartaSans_500Medium'],
        semibold: ['PlusJakartaSans_600SemiBold'],
        bold:   ['PlusJakartaSans_700Bold'],
      },
    },
  },
  plugins: [],
};
