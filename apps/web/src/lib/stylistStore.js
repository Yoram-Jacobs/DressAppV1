/**
 * stylistStore — thread-safe external store for Stylist chat sessions & messages.
 *
 * Implements React 18/19 useSyncExternalStore to eliminate redundant backend
 * GET requests (/api/v1/stylist/sessions and /api/v1/stylist/history) on every
 * page navigation / mount.
 */
import { useSyncExternalStore } from 'react';
import { api } from '@/lib/api';

const FRESH_MS = 5 * 60 * 1000; // 5 minutes fresh window

let _state = {
  sessions: [],
  activeSessionId: null,
  messagesBySession: {}, // { [sessionId]: messagesArray }
  lastSync: 0,
  loading: false,
  error: null,
};

let _inflightPrewarm = null;
const _inflightMessages = new Map();

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

export const stylistStore = {
  getSnapshot() {
    return _state;
  },

  subscribe(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  async prewarm({ force = false } = {}) {
    if (!force && _state.sessions.length > 0 && Date.now() - _state.lastSync < FRESH_MS) {
      return _state;
    }
    if (!force && _inflightPrewarm) {
      return _inflightPrewarm;
    }

    _inflightPrewarm = (async () => {
      _set({ loading: true, error: null });
      try {
        const { sessions } = await api.stylistSessions();
        const rows = sessions || [];
        let activeId = _state.activeSessionId;
        if (rows.length > 0 && (!activeId || !rows.some(s => s.id === activeId))) {
          activeId = rows[0].id;
        }
        _set({
          sessions: rows,
          activeSessionId: activeId,
          lastSync: Date.now(),
        });

        if (activeId && !_state.messagesBySession[activeId]) {
          await this.loadMessages(activeId);
        }
        return _state;
      } catch (err) {
        _set({ error: err });
        return _state;
      } finally {
        _set({ loading: false });
        _inflightPrewarm = null;
      }
    })();

    return _inflightPrewarm;
  },

  async loadMessages(sessionId, { force = false } = {}) {
    if (!sessionId) return [];
    if (!force && _state.messagesBySession[sessionId]) {
      return _state.messagesBySession[sessionId];
    }
    if (!force && _inflightMessages.has(sessionId)) {
      return _inflightMessages.get(sessionId);
    }

    const inflight = (async () => {
      try {
        const h = await api.stylistHistory(sessionId, 200);
        const hydrated = (h.messages || []).map((m) => ({
          id: m.id,
          role: m.role,
          transcript: m.transcript,
          payload: m.assistant_payload,
          outfit_canvas: m.assistant_payload?.outfit_canvas || null,
        }));

        _set({
          messagesBySession: {
            ..._state.messagesBySession,
            [sessionId]: hydrated,
          },
        });
        return hydrated;
      } catch (err) {
        console.debug('[stylistStore] loadMessages failed:', err);
        return [];
      } finally {
        _inflightMessages.delete(sessionId);
      }
    })();

    _inflightMessages.set(sessionId, inflight);
    return inflight;
  },

  setActiveSession(sessionId) {
    if (_state.activeSessionId === sessionId) return;
    _set({ activeSessionId: sessionId });
    if (sessionId && !_state.messagesBySession[sessionId]) {
      this.loadMessages(sessionId).catch(() => {});
    }
  },

  addMessage(sessionId, message) {
    if (!sessionId) return;
    const existing = _state.messagesBySession[sessionId] || [];
    _set({
      messagesBySession: {
        ..._state.messagesBySession,
        [sessionId]: [...existing, message],
      },
    });
  },

  setMessages(sessionId, messages) {
    if (!sessionId) return;
    _set({
      messagesBySession: {
        ..._state.messagesBySession,
        [sessionId]: messages,
      },
    });
  },

  setSessions(sessions) {
    _set({ sessions });
  },

  reset() {
    _state = {
      sessions: [],
      activeSessionId: null,
      messagesBySession: {},
      lastSync: 0,
      loading: false,
      error: null,
    };
    _inflightPrewarm = null;
    _inflightMessages.clear();
    _notify();
  },
};

export const prewarmStylist = stylistStore.prewarm.bind(stylistStore);
export const loadStylistMessages = stylistStore.loadMessages.bind(stylistStore);
export const setStylistActiveSession = stylistStore.setActiveSession.bind(stylistStore);
export const addStylistMessage = stylistStore.addMessage.bind(stylistStore);
export const setStylistMessages = stylistStore.setMessages.bind(stylistStore);
export const setStylistSessions = stylistStore.setSessions.bind(stylistStore);

export function useStylistStore() {
  return useSyncExternalStore(
    stylistStore.subscribe,
    stylistStore.getSnapshot,
    stylistStore.getSnapshot,
  );
}
