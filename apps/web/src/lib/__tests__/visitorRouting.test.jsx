import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock framer-motion for Jest
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    span: ({ children, ...props }) => <span {...props}>{children}</span>,
    h2: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
    p: ({ children, ...props }) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock Radix UI components that Jest has issues resolving in CJS
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }) => <div {...props}>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }) => <div>{children}</div>,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <div>{children}</div>,
  DialogDescription: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogFooter: ({ children }) => <div>{children}</div>,
}));

jest.mock('@/components/HelpMenu', () => ({
  __esModule: true,
  default: () => <div data-testid="help-menu">HelpMenu</div>,
}));

jest.mock('@/components/LanguagePicker', () => ({
  LanguagePicker: () => <div data-testid="language-picker">LanguagePicker</div>,
}));

// Mock auth hook to simulate unauthenticated visitor vs logged in user
let mockUser = null;
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    logout: jest.fn(),
  }),
}));

// Mock react-i18next including initReactI18next
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, options) => (options && options.defaultValue) || key,
  }),
}));

// Mock react-router-dom
const mockNavigate = jest.fn();
let mockLocation = { pathname: '/home' };

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
  Link: ({ to, children, onClick, ...props }) => (
    <a href={to} onClick={onClick} {...props}>
      {children}
    </a>
  ),
  NavLink: ({ to, className, children, onClick, ...props }) => {
    const isAct = mockLocation.pathname === to;
    const resolvedClass = typeof className === 'function' ? className({ isActive: isAct }) : className;
    const resolvedChildren = typeof children === 'function' ? children({ isActive: isAct }) : children;
    return (
      <a href={to} className={resolvedClass} onClick={onClick} {...props}>
        {resolvedChildren}
      </a>
    );
  },
}));

import { TopNav } from '@/components/TopNav';
import { BottomTabs } from '@/components/BottomTabs';
import { Footer } from '@/components/Footer';
import MigrationStepShowcase from '@/components/MigrationStepShowcase';

describe('Visitor Access & Onboarding Routing', () => {
  beforeEach(() => {
    mockUser = null;
    mockNavigate.mockClear();
    mockLocation = { pathname: '/home' };
  });

  describe('TopNav visitor routing', () => {
    it('routes feature tabs to /onboarding while keeping /home and /pricing accessible', () => {
      render(<TopNav />);

      const homeLink = screen.getByTestId('topnav-link-home');
      expect(homeLink).toHaveAttribute('href', '/home');

      const pricingLink = screen.getByTestId('topnav-link-pricing');
      expect(pricingLink).toHaveAttribute('href', '/pricing');

      const closetLink = screen.getByTestId('topnav-link-closet');
      expect(closetLink).toHaveAttribute('href', '/onboarding');

      const stylistLink = screen.getByTestId('topnav-link-stylist');
      expect(stylistLink).toHaveAttribute('href', '/onboarding');

      const marketLink = screen.getByTestId('topnav-link-market');
      expect(marketLink).toHaveAttribute('href', '/onboarding');

      const expertsLink = screen.getByTestId('topnav-link-experts');
      expect(expertsLink).toHaveAttribute('href', '/onboarding');
    });

    it('routes feature tabs to their actual paths when user is logged in', () => {
      mockUser = { id: 'u1', email: 'test@example.com' };
      render(<TopNav />);

      expect(screen.getByTestId('topnav-link-closet')).toHaveAttribute('href', '/closet');
      expect(screen.getByTestId('topnav-link-stylist')).toHaveAttribute('href', '/stylist');
      expect(screen.getByTestId('topnav-link-market')).toHaveAttribute('href', '/market');
      expect(screen.getByTestId('topnav-link-experts')).toHaveAttribute('href', '/experts');
    });
  });

  describe('BottomTabs visitor routing', () => {
    it('routes all bottom tabs to /onboarding for visitors', () => {
      render(<BottomTabs />);

      expect(screen.getByTestId('bottom-tab-closet')).toHaveAttribute('href', '/onboarding');
      expect(screen.getByTestId('bottom-tab-stylist')).toHaveAttribute('href', '/onboarding');
      expect(screen.getByTestId('bottom-tab-capture')).toHaveAttribute('href', '/onboarding');
      expect(screen.getByTestId('bottom-tab-market')).toHaveAttribute('href', '/onboarding');
      expect(screen.getByTestId('bottom-tab-me')).toHaveAttribute('href', '/onboarding');
    });

    it('routes bottom tabs to feature paths for authenticated users', () => {
      mockUser = { id: 'u1', email: 'test@example.com' };
      render(<BottomTabs />);

      expect(screen.getByTestId('bottom-tab-closet')).toHaveAttribute('href', '/closet');
      expect(screen.getByTestId('bottom-tab-stylist')).toHaveAttribute('href', '/stylist');
      expect(screen.getByTestId('bottom-tab-capture')).toHaveAttribute('href', '/closet/add?source=camera');
      expect(screen.getByTestId('bottom-tab-market')).toHaveAttribute('href', '/market');
      expect(screen.getByTestId('bottom-tab-me')).toHaveAttribute('href', '/me');
    });
  });

  describe('Footer visitor routing', () => {
    it('keeps allowed public links accessible while routing feature links to /onboarding', () => {
      render(<Footer />);

      // Allowed public links
      const aboutLink = screen.getByText('About Us');
      expect(aboutLink.closest('a')).toHaveAttribute('href', '/about');

      const pricingLink = screen.getByText('Pricing & Plans');
      expect(pricingLink.closest('a')).toHaveAttribute('href', '/pricing');

      const extensionLink = screen.getByText('Browser Extension Bridge');
      expect(extensionLink.closest('a')).toHaveAttribute('href', '/extension/connect');

      const privacyLinks = screen.getAllByText('Privacy Policy');
      expect(privacyLinks[0].closest('a')).toHaveAttribute('href', '/privacy');

      const termsLinks = screen.getAllByText(/Terms of/);
      expect(termsLinks[0].closest('a')).toHaveAttribute('href', '/terms');

      // Best Practices & Q&A & FAQ buttons
      expect(screen.getByTestId('footer-best-practices')).toBeInTheDocument();
      expect(screen.getByTestId('footer-qa-faq')).toBeInTheDocument();

      // Feature links should route to /onboarding for visitors
      const closetLink = screen.getByText('Digital Closet');
      expect(closetLink.closest('a')).toHaveAttribute('href', '/onboarding');

      const stylistLink = screen.getByText('AI Stylist Chat');
      expect(stylistLink.closest('a')).toHaveAttribute('href', '/onboarding');

      const trendLink = screen.getByText('Trend Scout');
      expect(trendLink.closest('a')).toHaveAttribute('href', '/onboarding');

      const travelLink = screen.getByText('Travel Capsule');
      expect(travelLink.closest('a')).toHaveAttribute('href', '/onboarding');

      const buySellLink = screen.getByText('Buy & Sell');
      expect(buySellLink.closest('a')).toHaveAttribute('href', '/onboarding');

      const swapLink = screen.getByText('Direct Swaps');
      expect(swapLink.closest('a')).toHaveAttribute('href', '/onboarding');
    });
  });

  describe('MigrationStepShowcase visitor routing', () => {
    it('redirects unauthenticated visitors to /onboarding when clicking Migrate your Wardrobe', () => {
      const mockSetModalOpen = jest.fn();
      render(
        <MigrationStepShowcase
          t={(k, opts) => (opts && opts.defaultValue) || k}
          setIsMigrationModalOpen={mockSetModalOpen}
        />
      );

      const ctaBtn = screen.getByTestId('home-migrate-wardrobe-closet-cta');
      fireEvent.click(ctaBtn);

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding');
      expect(mockSetModalOpen).not.toHaveBeenCalled();
    });

    it('opens migration modal when user is logged in', () => {
      mockUser = { id: 'u1', email: 'test@example.com' };
      const mockSetModalOpen = jest.fn();
      render(
        <MigrationStepShowcase
          t={(k, opts) => (opts && opts.defaultValue) || k}
          setIsMigrationModalOpen={mockSetModalOpen}
        />
      );

      const ctaBtn = screen.getByTestId('home-migrate-wardrobe-closet-cta');
      fireEvent.click(ctaBtn);

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockSetModalOpen).toHaveBeenCalledWith(true);
    });
  });
});
