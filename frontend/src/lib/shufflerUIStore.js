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
});
