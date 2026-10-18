import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { resolveCountry } from '../countries';
import { geocodeContactAddress } from '../location';
import { LocationCard } from '../../components/LocationCard';

// Mock Radix Accordion
jest.mock('@/components/ui/accordion', () => ({
  Accordion: ({ children }) => <div>{children}</div>,
  AccordionItem: ({ children, ...props }) => <div {...props}>{children}</div>,
  AccordionTrigger: ({ children, ...props }) => <div {...props}>{children}</div>,
  AccordionContent: ({ children, ...props }) => <div {...props}>{children}</div>,
}));

// Mock location hook for LocationCard testing
const mockUseLocation = jest.fn();
jest.mock('../location', () => {
  const actual = jest.requireActual('../location');
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
  };
});

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => {
      const translations = {
        'location.title': 'מיקום ומזג אוויר',
        'location.denied': 'המיקום חסום בדפדפן',
        'location.granted': 'המיקום פעיל',
        'location.notNow': 'לא עכשיו',
        'location.contactFallbackBadge': 'ברירת מחדל: פרטי קשר',
        'location.sourceLabel': 'מקור',
        'location.sourceContactDetails': 'פרטי קשר',
        'location.sourceBrowserGps': 'GPS דפדפן',
        'location.cityLabel': 'עיר',
        'location.lastKnown': 'נקודה אחרונה',
        'location.statusContactFallback': 'נתוני מזג האוויר והסטייליסט מסונכרנים לפי כתובת הקשר שלך.',
        'location.deniedWithContactFallbackHint': 'המיקום חסום בדפדפן. המערכת משתמשת בכתובת הקשר שלך כברירת מחדל.',
      };
      return translations[key] || opts?.defaultValue || key;
    },
  }),
}));

describe('Contact Location Fallback', () => {
  describe('resolveCountry', () => {
    test('resolves standard ISO-2 and English name', () => {
      expect(resolveCountry('IL')).toEqual({ code: 'IL', name: 'Israel' });
      expect(resolveCountry('Israel')).toEqual({ code: 'IL', name: 'Israel' });
      expect(resolveCountry('US')).toEqual({ code: 'US', name: 'United States' });
    });

    test('resolves localized country names such as Hebrew ישראל', () => {
      const hit = resolveCountry('ישראל');
      expect(hit).toEqual({ code: 'IL', name: 'Israel' });
    });
  });

  describe('geocodeContactAddress', () => {
    test('returns coordinates immediately if lat/lng are already in address object', async () => {
      const address = {
        line1: 'HaNoter Street 11',
        city: "Be'er-Sheva",
        country: 'ישראל',
        lat: 31.2534,
        lng: 34.8047,
      };
      const res = await geocodeContactAddress(address);
      expect(res.coords).toEqual({ lat: 31.2534, lng: 34.8047 });
      expect(res.city).toBe("Be'er-Sheva");
    });

    test('falls back to fetching Nominatim when lat/lng missing', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            lat: '31.2534089',
            lon: '34.8047302',
            display_name: 'HaNoter 11, Be\'er-Sheva, Israel',
            address: {
              city: 'Be\'er-Sheva',
              country: 'Israel',
              country_code: 'il',
            },
          },
        ],
      });

      try {
        const address = {
          line1: 'HaNoter Street 11',
          city: "Be'er-Sheva",
          country: 'ישראל',
        };
        const res = await geocodeContactAddress(address);
        expect(res).not.toBeNull();
        expect(res.coords.lat).toBeCloseTo(31.2534, 3);
        expect(res.coords.lng).toBeCloseTo(34.8047, 3);
        expect(res.country_code).toBe('IL');
      } finally {
        global.fetch = originalFetch;
      }
    });

    test('returns null if address has no searchable fields', async () => {
      expect(await geocodeContactAddress(null)).toBeNull();
      expect(await geocodeContactAddress({})).toBeNull();
    });
  });

  describe('LocationCard UI when browser blocks location', () => {
    test('renders blocked badge and contact details fallback badge and info', () => {
      mockUseLocation.mockReturnValue({
        coords: { lat: 31.2534, lng: 34.8047 },
        city: "Be'er-Sheva",
        country: 'Israel',
        country_code: 'IL',
        permissionState: 'denied',
        available: true,
        isFallback: true,
        source: 'contact_details',
        request: jest.fn(),
        forget: jest.fn(),
      });

      render(<LocationCard />);

      // Blocked badge is rendered
      const deniedBadge = screen.getByTestId('location-denied-badge');
      expect(deniedBadge).toBeTruthy();
      expect(deniedBadge.textContent).toContain('המיקום חסום בדפדפן');

      // Contact fallback badge is rendered
      const fallbackBadge = screen.getByTestId('location-fallback-badge');
      expect(fallbackBadge).toBeTruthy();
      expect(fallbackBadge.textContent).toContain('ברירת מחדל: פרטי קשר');

      // Details dl contains city and coordinates
      const details = screen.getByTestId('location-details');
      expect(details).toBeTruthy();
      expect(screen.getByText("Be'er-Sheva · IL")).toBeTruthy();
      expect(screen.getByText('31.2534, 34.8047')).toBeTruthy();

      // Source is labeled as Contact Details
      expect(screen.getByText('פרטי קשר')).toBeTruthy();

      // Status indicates sync with contact address
      expect(
        screen.getByText('נתוני מזג האוויר והסטייליסט מסונכרנים לפי כתובת הקשר שלך.')
      ).toBeTruthy();
    });
  });
});
