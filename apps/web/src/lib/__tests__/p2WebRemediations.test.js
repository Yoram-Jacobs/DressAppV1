import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

jest.mock('react-router-dom', () => {
  const ReactLib = require('react');
  return {
    __esModule: true,
    useNavigate: () => jest.fn(),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    useLocation: () => ({ pathname: '/pricing', search: '', state: null }),
    MemoryRouter: ({ children }) => ReactLib.createElement(ReactLib.Fragment, null, children),
    Link: ({ children, to, ...props }) =>
      ReactLib.createElement('a', { href: to || '#', ...props }, children),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => opts?.defaultValue || key,
    i18n: { language: 'en', dir: () => 'ltr' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: null, refresh: jest.fn() }),
}));

jest.mock('@/lib/api', () => ({
  api: {
    getPricingInfo: () =>
      Promise.resolve({
        pricing_tiers: [
          { name: 'Free', price: 0, features: ['Up to 100 closet items'] },
          { name: 'Manager', price: 10, features: ['Unlimited closet items'] },
          { name: 'Professional', price: 15, features: ['Ad Campaigns included'] },
        ],
        credit_packs: [
          { pack: '10', credits: 10, price_usd: 3.0 },
          { pack: '50', credits: 50, price_usd: 12.0 },
          { pack: '100', credits: 100, price_usd: 20.0 },
        ],
      }),
  },
}));

jest.mock('@/lib/closetStore', () => ({
  useClosetStore: () => ({ total: 0 }),
  closetStore: { prewarm: jest.fn() },
}));

jest.mock('@/lib/useClosetStore', () => ({
  useClosetStore: () => ({ total: 0 }),
}));

jest.mock('@/components/ui/dialog', () => {
  const ReactLib = require('react');
  const Pass = ({ children }) => ReactLib.createElement('div', null, children);
  return {
    Dialog: ({ open, children }) => (open ? ReactLib.createElement('div', null, children) : null),
    DialogContent: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
  };
});

jest.mock('@/components/ui/tooltip', () => {
  const ReactLib = require('react');
  const Pass = ({ children }) => ReactLib.createElement('div', null, children);
  return {
    TooltipProvider: Pass,
    Tooltip: Pass,
    TooltipTrigger: Pass,
    TooltipContent: Pass,
  };
});

jest.mock('@/components/ui/progress', () => {
  const ReactLib = require('react');
  return {
    Progress: ({ value }) => ReactLib.createElement('div', { 'data-value': value }),
  };
});

import Pricing from '../../pages/Pricing';

describe('P2 Web & Locale Remediations', () => {
  test('BUG-I18N-01: all 92 AboutUs keys & pricing.startFree exist in all 13 locales (web & packages)', () => {
    const aboutSrc = fs.readFileSync(
      path.resolve(__dirname, '../../pages/AboutUs.jsx'),
      'utf8'
    );
    const matches = Array.from(aboutSrc.matchAll(/t\(\s*['"](about\.[^'"]+)['"]/g));
    const expectedKeys = Array.from(new Set(matches.map((m) => m[1].slice(6))));
    expect(expectedKeys.length).toBe(92);

    const langs = ['en', 'he', 'ar', 'de', 'es', 'fr', 'hi', 'it', 'ja', 'nl', 'pt', 'ru', 'zh'];
    const roots = [
      path.resolve(__dirname, '../../locales'),
      path.resolve(__dirname, '../../../../../packages/i18n/locales'),
    ];
    for (const root of roots) {
      for (const lang of langs) {
        const json = JSON.parse(fs.readFileSync(path.join(root, `${lang}.json`), 'utf8'));
        for (const k of expectedKeys) {
          expect(typeof json.about?.[k]).toBe('string');
          expect(json.about[k].trim().length).toBeGreaterThan(0);
        }
        expect(typeof json.pricing?.startFree).toBe('string');
      }
    }
  });

  test('BUG-WEB-03: Pricing does not disable Free plan as Current Plan for logged-out visitors', async () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByTestId('pricing-tiers-grid')).toBeInTheDocument());
    expect(screen.queryByTestId('tier-select-current-free')).not.toBeInTheDocument();
    expect(screen.getByTestId('tier-select-free')).toBeEnabled();
    expect(screen.getByTestId('tier-select-free')).toHaveTextContent('Start Free');
  });
});
