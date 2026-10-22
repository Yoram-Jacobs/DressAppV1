import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import StylistGuidedTour from '../StylistGuidedTour';
import {
  STYLIST_TOUR_PENDING_KEY,
  STYLIST_TOUR_COMPLETED_KEY,
} from '@/lib/onboardingStore';

// Mock react-router-dom
const mockNavigate = jest.fn();
let mockSearchParams = new URLSearchParams();
const mockSetSearchParams = jest.fn((params) => {
  mockSearchParams = new URLSearchParams(params);
});

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key, options) => (options && options.defaultValue) || key,
    i18n: { language: 'en' },
  }),
}));

describe('StylistGuidedTour Component', () => {
  beforeEach(() => {
    localStorage.clear();
    mockSearchParams = new URLSearchParams();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('auto-launches when tour pending flag is set in localStorage', () => {
    localStorage.setItem(STYLIST_TOUR_PENDING_KEY, 'true');

    render(<StylistGuidedTour />);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.getByTestId('stylist-guided-tour-overlay')).toBeInTheDocument();
    expect(screen.getByText('Mix & Match Separates')).toBeInTheDocument();
  });

  test('auto-launches when ?onboarded=1 is in search params', () => {
    mockSearchParams = new URLSearchParams('?onboarded=1');

    render(<StylistGuidedTour />);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.getByTestId('stylist-guided-tour-overlay')).toBeInTheDocument();
  });

  test('navigates through 4 steps and completes', () => {
    mockSearchParams = new URLSearchParams('?tour=1');

    render(<StylistGuidedTour />);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Step 1: Carousels
    expect(screen.getByText('Mix & Match Separates')).toBeInTheDocument();
    const nextBtn = screen.getByTestId('stylist-tour-next-btn');
    fireEvent.click(nextBtn);

    // Step 2: Shuffle
    expect(screen.getByText('Instant AI Outfit Generation')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('stylist-tour-next-btn'));

    // Step 3: Planner
    expect(screen.getByText('Dress for Your Actual Day')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('stylist-tour-next-btn'));

    // Step 4: Save & Explore
    expect(screen.getByText('Save Outfits & Visit Your Closet')).toBeInTheDocument();
    expect(screen.getByTestId('stylist-tour-action-btn')).toBeInTheDocument();

    const finishBtn = screen.getByTestId('stylist-tour-finish-btn');
    fireEvent.click(finishBtn);

    expect(screen.queryByTestId('stylist-guided-tour-overlay')).not.toBeInTheDocument();
    expect(localStorage.getItem(STYLIST_TOUR_COMPLETED_KEY)).toBe('true');
  });

  test('responds to dressapp:start-stylist-tour custom event', () => {
    render(<StylistGuidedTour />);

    act(() => {
      window.dispatchEvent(new CustomEvent('dressapp:start-stylist-tour'));
    });

    expect(screen.getByTestId('stylist-guided-tour-overlay')).toBeInTheDocument();
  });
});
