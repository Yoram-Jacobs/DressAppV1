import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { trendScoutStore, prewarmTrendScout } from '../trendScoutStore';
import { isTTSSupported, ensureVoicesLoaded, speak, cancelSpeak } from '../speech';
import { AIConfiguration } from '../../components/profile/AIConfiguration';
import HelpMenu from '../../components/HelpMenu';
import { api } from '../api';

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/closet', search: '' }),
  useNavigate: () => jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../../components/ui/select', () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ value, children }) => <div data-value={value}>{children}</div>,
}));

jest.mock('../../components/ui/accordion', () => ({
  AccordionItem: ({ children }) => <div>{children}</div>,
  AccordionTrigger: ({ children }) => <button type="button">{children}</button>,
  AccordionContent: ({ children }) => <div>{children}</div>,
}));

jest.mock('../../components/ui/dialog', () => ({
  Dialog: ({ children }) => <div>{children}</div>,
  DialogTrigger: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogDescription: ({ children }) => <p>{children}</p>,
}));

jest.mock('../../components/ui/scroll-area', () => ({
  ScrollArea: ({ children }) => <div>{children}</div>,
}));

jest.mock('../../components/ui/label', () => ({
  Label: ({ children, ...props }) => <label {...props}>{children}</label>,
}));

jest.mock('../api', () => ({
  api: {
    fashionScoutFeed: jest.fn(),
    patchMe: jest.fn(),
    getMe: jest.fn(() => Promise.resolve(null)),
  },
}));

const mockUpdateUserLocal = jest.fn();
jest.mock('../auth', () => ({
  useAuth: () => ({
    user: {
      id: 'tester-1',
      subscription: { is_tester: true, plan_type: 'tester' },
      ai_configuration: {
        selected_provider: 'google_ai',
        selected_model: 'gemini-3.5-flash',
        custom_keys: {},
      },
    },
    updateUserLocal: mockUpdateUserLocal,
  }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, opts) => {
      // Simulate i18next returnEmptyString: false when en.json has "" for profile_item13..16 & stylist_step7
      if (
        key.includes('profile_item13') ||
        key.includes('profile_item14') ||
        key.includes('profile_item15') ||
        key.includes('profile_item16') ||
        key === 'help.stylist_step7'
      ) {
        return key;
      }
      if (opts && Object.prototype.hasOwnProperty.call(opts, 'defaultValue')) {
        return opts.defaultValue || key;
      }
      return key;
    },
    i18n: {
      language: 'en',
      dir: () => 'ltr',
    },
  }),
}));

describe('P1 Web Remediations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.getMe.mockResolvedValue(null);
    trendScoutStore.reset();
  });

  test('QA-14: trendScoutStore dedups per (language, country, gender) and preserves both genders', async () => {
    let resolveFemale;
    const femalePromise = new Promise((res) => { resolveFemale = res; });
    api.fashionScoutFeed.mockImplementation((_limit, params) => {
      if (params.gender === 'female') return femalePromise;
      return Promise.resolve({
        cards: [
          { id: 'm1', headline: 'Tailored Menswear', source_url: 'https://example.org/m1', gender: 'male' },
        ],
      });
    });

    const pFemale = prewarmTrendScout({ language: 'en', country: 'US', gender: 'female' });
    const pMale = prewarmTrendScout({ language: 'en', country: 'US', gender: 'male' });

    // Male should resolve independently even while female is still in-flight!
    await pMale;
    expect(api.fashionScoutFeed).toHaveBeenCalledTimes(2);
    expect(trendScoutStore.isKeyLoading({ language: 'en', country: 'US', gender: 'female' })).toBe(true);
    expect(trendScoutStore.isKeyLoading({ language: 'en', country: 'US', gender: 'male' })).toBe(false);

    resolveFemale({
      cards: [
        { id: 'f1', headline: 'Silk Midi Edit', source_url: 'https://example.org/f1', gender: 'female' },
      ],
    });
    await pFemale;

    const snap = trendScoutStore.getSnapshot();
    const genders = snap.cards.map((c) => c.gender).sort();
    expect(genders).toEqual(['female', 'male']);
    expect(snap.loading).toBe(false);

    // Switching back to female hits fresh per-key cache without extra API calls
    await prewarmTrendScout({ language: 'en', country: 'US', gender: 'female' });
    expect(api.fashionScoutFeed).toHaveBeenCalledTimes(2);
  });

  test('QA-17: speech helpers fail safely when window.speechSynthesis is null or incomplete', async () => {
    const origDesc = Object.getOwnPropertyDescriptor(window, 'speechSynthesis');
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: null,
    });

    try {
      expect(isTTSSupported()).toBe(false);
      await expect(ensureVoicesLoaded()).resolves.toEqual([]);
      const onEnd = jest.fn();
      await expect(speak('Hello DressApp', 'en', { onEnd })).resolves.toBeNull();
      expect(onEnd).toHaveBeenCalledTimes(1);
      expect(() => cancelSpeak()).not.toThrow();
    } finally {
      if (origDesc) {
        Object.defineProperty(window, 'speechSynthesis', origDesc);
      } else {
        delete window.speechSynthesis;
      }
    }
  });

  test('QA-15: HelpMenu filters unresolved empty help.* keys in AI Stylist and Profile Matters tabs', () => {
    render(<HelpMenu onClose={() => {}} />);

    fireEvent.click(screen.getByText('help.stylist_title', { selector: 'button' }));
    expect(screen.queryByText('help.stylist_step7')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('help.profile_title', { selector: 'button' }));
    expect(screen.queryByText('help.profile_item13_title')).not.toBeInTheDocument();
    expect(screen.queryByText('help.profile_item16_desc')).not.toBeInTheDocument();
  });

  test('QA-19: AIConfiguration exposes only supported DressApp & Google Gemini providers normalized to gemini-3.5-flash-lite', () => {
    render(<AIConfiguration />);
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('gemini-3.5-flash-lite')).toBeInTheDocument();
    expect(screen.queryByText('OpenAI ChatGPT')).not.toBeInTheDocument();
    expect(screen.queryByText('Anthropic Claude')).not.toBeInTheDocument();
    expect(screen.queryByText('DeepSeek')).not.toBeInTheDocument();
    expect(screen.queryByText('Alibaba Qwen')).not.toBeInTheDocument();
  });
});
