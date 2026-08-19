/**
 * dailySuggestionsStore — thread-safe external store for daily proposals, notifications & calendar events.
 *
 * Prevents continuous GET re-fetching on navigation returns.
 */
import { useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

const FRESH_MS = 15 * 60 * 1000; // 15 minutes cache window

let _state = {
  proposals: [],
  notifications: [],
  calendarEvents: [],
  calendarConnected: false,
  lastSync: 0,
  loading: false,
  error: null,
};

const _listeners = new Set();

function _notify() {
  _listeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

function _set(patch) {
  _state = { ..._state, ...patch };
  _notify();
}

export const dailySuggestionsStore = {
  getSnapshot() {
    return _state;
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  async prewarm({ force = false } = {}) {
    if (!force && _state.lastSync && Date.now() - _state.lastSync < FRESH_MS) {
      return _state;
    }
    _set({ loading: true, error: null });
    try {
      const [proposalsRes, calStatus, notifRes, calEventsRes] = await Promise.allSettled([
        api.listScheduledProposals ? api.listScheduledProposals() : Promise.resolve([]),
        api.calendarStatus ? api.calendarStatus() : Promise.resolve({ connected: false }),
        api.listSimulatedNotifications ? api.listSimulatedNotifications() : Promise.resolve({ notifications: [] }),
        api.calendarUpcoming ? api.calendarUpcoming(24) : Promise.resolve({ events: [] }),
      ]);

      const proposals = proposalsRes.status === 'fulfilled' ? (proposalsRes.value?.proposals || proposalsRes.value || []) : [];
      const calendarConnected = calStatus.status === 'fulfilled' ? !!calStatus.value?.connected : false;
      const notifications = notifRes.status === 'fulfilled' ? (notifRes.value?.notifications || []) : [];
      const calendarEvents = calEventsRes.status === 'fulfilled' ? (calEventsRes.value?.events || []) : [];

      _set({
        proposals,
        calendarConnected,
        notifications,
        calendarEvents,
        lastSync: Date.now(),
      });
      return _state;
    } catch (err) {
      _set({ error: err });
      return _state;
    } finally {
      _set({ loading: false });
    }
  },

  setProposals(proposals) {
    _set({ proposals });
  },

  setNotifications(notifications) {
    _set({ notifications });
  },

  setCalendarEvents(calendarEvents) {
    _set({ calendarEvents });
  },

  reset() {
    _state = {
      proposals: [],
      notifications: [],
      calendarEvents: [],
      calendarConnected: false,
      lastSync: 0,
      loading: false,
      error: null,
    };
    _notify();
  },
};

const _subscribe = dailySuggestionsStore.subscribe.bind(dailySuggestionsStore);
const _getSnapshot = dailySuggestionsStore.getSnapshot.bind(dailySuggestionsStore);

export const prewarmDailySuggestions = dailySuggestionsStore.prewarm.bind(dailySuggestionsStore);
export const setProposalsDailySuggestions = dailySuggestionsStore.setProposals.bind(dailySuggestionsStore);
export const setNotificationsDailySuggestions = dailySuggestionsStore.setNotifications.bind(dailySuggestionsStore);
export const setCalendarEventsDailySuggestions = dailySuggestionsStore.setCalendarEvents.bind(dailySuggestionsStore);

export function useDailySuggestionsStore() {
  const snap = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);

  return {
    ...snap,
    prewarm: prewarmDailySuggestions,
    setProposals: setProposalsDailySuggestions,
    setNotifications: setNotificationsDailySuggestions,
    setCalendarEvents: setCalendarEventsDailySuggestions,
  };
}
