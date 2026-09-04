import { createSimpleStore } from './createSimpleStore';

export const shufflerUIStore = createSimpleStore({
  selectedStyle: 'all',
  tagInput: '',
  selectedTag: '',
  showSuggestions: false,
  coords: null,
  weatherSummary: '',
  includeCalendar: false,
  calendarEvents: [],
  calendarLoading: false,
  aiRationale: '',
  topFocusIdx: 0,
  bottomFocusIdx: 0,
  shoeFocusIdx: 0,
  topSelectedIdx: null,
  bottomSelectedIdx: null,
  shoeSelectedIdx: null,
  activeFloaterItemId: null,
  isSpinning: false,
  saving: false
}, {
  storageKey: 'dressapp_shuffler_store',
  persistKeys: [
    'selectedStyle',
    'tagInput',
    'selectedTag',
    'coords',
    'weatherSummary',
    'includeCalendar',
    'calendarEvents',
    'aiRationale',
    'topFocusIdx',
    'bottomFocusIdx',
    'shoeFocusIdx',
    'topSelectedIdx',
    'bottomSelectedIdx',
    'shoeSelectedIdx'
  ]
});
