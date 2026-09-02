import { createSimpleStore } from './createSimpleStore';

export const stylistUIStore = createSimpleStore({
  messages: [],
  sessions: [],
  activeSessionId: null,
  notifications: [],
  calendarStartDate: new Date(),
  dragOverDay: null,
  selectedOutfitForDetail: null,
  shareDetailModalOpen: false,
  calendarModalOpen: false,
  schedulingDate: null,
  currentCalendarMonth: new Date(),
  isEditingOutfit: false,
  editOutfitName: '',
  editOutfitDescription: '',
  hasAutoSelected: false,
  eventModalOpen: false,
  eventForm: { title: '', date: '', location: '', notes: '' },
  text: '',
  imageFile: null,
  extraImages: [],
  includeCalendar: false,
  occasion: '',
  calendarConnected: false,
  busy: false,
  recording: false,
  interim: '',
  speakingId: null,
  sidebarOpen: false,
  floaterItemId: null,
}, {
  storageKey: 'dressapp_stylist_store',
  persistKeys: [
    'activeSessionId',
    'notifications',
    'calendarStartDate',
    'currentCalendarMonth',
    'text',
    'includeCalendar',
    'occasion',
    'sidebarOpen',
    'eventForm'
  ],
  deserialize: (parsed) => {
    const result = { ...parsed };
    if (result.calendarStartDate) {
      result.calendarStartDate = new Date(result.calendarStartDate);
    }
    if (result.currentCalendarMonth) {
      result.currentCalendarMonth = new Date(result.currentCalendarMonth);
    }
    return result;
  }
});
