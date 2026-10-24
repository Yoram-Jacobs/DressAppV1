/**
 * dailySuggestionsStore — thread-safe external store for daily proposals, notifications & calendar events.
 *
 * Prevents continuous GET re-fetching on navigation returns.
 */
import { useSyncExternalStore } from 'react';
import { api, userStore } from '@/lib/api';

const FRESH_MS = 15 * 60 * 1000; // 15 minutes cache window

/**
 * Check if the user has access to daily proposals/scheduler based on subscription tier,
 * active trial, or tester/admin roles. Matches backend check_scheduler_access logic.
 */
export function hasDailyProposalAccess(user) {
  if (!user) return false;
  const sub = user.subscription || {};
  const isActive = Boolean(sub.is_active);
  const planType = (sub.plan_type || 'free').toLowerCase();
  const tier = (sub.tier || 'free').toLowerCase();
  const isTester = Boolean(sub.is_tester || planType === 'tester' || user.roles?.includes('tester'));
  const isAdmin = Boolean(user.roles?.includes('admin'));
  if (isTester || isAdmin) return true;

  // 1. Check active trial in trial_info
  const trial = user.trial_info || {};
  if (trial.is_active && trial.expires_at) {
    try {
      const exp = new Date(trial.expires_at).getTime();
      if (!Number.isNaN(exp) && exp > Date.now()) return true;
    } catch { /* ignore */ }
  }

  // 2. Check active paid subscription
  if (isActive && planType !== 'free') {
    if (sub.expires_at) {
      try {
        const exp = new Date(sub.expires_at).getTime();
        if (!Number.isNaN(exp) && exp <= Date.now()) return false;
      } catch { /* ignore */ }
    }
    if (['pro', 'manager', 'business', 'professional'].includes(tier) ||
        ['pro', 'manager', 'business', 'professional'].includes(planType)) {
      return true;
    }
  }
  return false;
}

let _state = {
  proposals: [],
  notifications: [],
  calendarEvents: [],
  calendarConnected: false,
  lastSync: 0,
  loading: false,
  error: null,
  accessDenied: false,
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

    const currentUser = userStore?.get?.();
    const canAccessProposal = !_state.accessDenied && hasDailyProposalAccess(currentUser);

    try {
      const [dailyPropRes, calStatus, notifRes, calEventsRes] = await Promise.allSettled([
        canAccessProposal && api.getDailyProposal
          ? api.getDailyProposal().catch((err) => {
              if (err?.response?.status === 403) {
                _state.accessDenied = true;
                return null;
              }
              throw err;
            })
          : Promise.resolve(null),
        api.calendarStatus ? api.calendarStatus() : Promise.resolve({ connected: false }),
        api.listSimulatedNotifications ? api.listSimulatedNotifications() : Promise.resolve({ notifications: [] }),
        api.calendarUpcoming ? api.calendarUpcoming(24) : Promise.resolve({ events: [] }),
      ]);

      const dailyProposal = dailyPropRes.status === 'fulfilled' ? dailyPropRes.value : null;
      const proposals = Array.isArray(dailyProposal?.all_proposals) && dailyProposal.all_proposals.length > 0
        ? dailyProposal.all_proposals
        : (dailyProposal ? [dailyProposal] : []);
      const calendarConnected = calStatus.status === 'fulfilled' ? !!calStatus.value?.connected : false;
      const notifications = notifRes.status === 'fulfilled' ? (notifRes.value?.notifications || []) : [];
      const calendarEvents = calEventsRes.status === 'fulfilled' ? (calEventsRes.value?.events || []) : [];

      _set({
        proposals,
        dailyProposal,
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

  async act(action, proposalId, date) {
    const currentUser = userStore?.get?.();
    if (!hasDailyProposalAccess(currentUser)) return null;

    if (api.actOnDailyProposal) {
      try {
        const updated = await api.actOnDailyProposal(action, proposalId, date);
        if (updated) {
          if (action === 'wear') {
            _set({
              proposals: [updated, ...(_state.proposals || []).filter(p => p.id !== updated.id)],
              dailyProposal: updated,
            });
          } else {
            _set({
              proposals: _state.proposals.map(p => (p.id === updated.id ? updated : p)),
              dailyProposal: updated,
            });
          }
        }
        return updated;
      } catch (err) {
        if (err?.response?.status === 403) {
          _set({ accessDenied: true });
        }
        throw err;
      }
    }
  },

  async generate(force = true, occasion = 'daily', date = null) {
    const currentUser = userStore?.get?.();
    if (!hasDailyProposalAccess(currentUser)) return null;

    if (api.generateDailyProposal) {
      try {
        const targetDate = date || _state.dailyProposal?.date;
        const proposal = await api.generateDailyProposal(force, occasion, targetDate);
        if (proposal) {
          const nextProps = [proposal, ...(_state.proposals || []).filter(p => p.id !== proposal.id && p.date !== proposal.date)];
          _set({
            proposals: nextProps,
            dailyProposal: proposal,
          });
        }
        return proposal;
      } catch (err) {
        if (err?.response?.status === 403) {
          _set({ accessDenied: true });
        }
        throw err;
      }
    }
  },

  setProposals(proposals) {
    _set({ proposals, dailyProposal: proposals?.[0] || null });
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
      accessDenied: false,
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

export const actDailyProposal = dailySuggestionsStore.act.bind(dailySuggestionsStore);
export const generateDailyProposal = dailySuggestionsStore.generate.bind(dailySuggestionsStore);

export function useDailySuggestionsStore() {
  const snap = useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);

  return {
    ...snap,
    prewarm: prewarmDailySuggestions,
    setProposals: setProposalsDailySuggestions,
    setNotifications: setNotificationsDailySuggestions,
    setCalendarEvents: setCalendarEventsDailySuggestions,
    act: actDailyProposal,
    generate: generateDailyProposal,
  };
}
