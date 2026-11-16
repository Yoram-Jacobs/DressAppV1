/**
 * Safe SSE sync manager using short-lived single-use opaque tickets
 * instead of passing long-lived Bearer JWTs in EventSource query strings.
 */

const DOMAIN_EVENT_MAP = {
  profile: 'profile_updated',
  closet: 'closet_updated',
  daily_suggestions: 'daily_suggestions_updated',
  stylist: 'stylist_updated',
  lookbook: 'lookbook_updated',
  trend_scout: 'trend_scout_updated',
};

export function createSafeSyncManager(client, apiBase) {
  let _es = null;
  let _reconnectTimer = null;
  let _connected = false;
  let _connGen = 0;
  let _attempt = 0;
  let _lastVersions = null;
  const _listeners = new Set();

  function _emit(event) {
    _listeners.forEach((cb) => {
      try {
        cb(event);
      } catch {
        /* ignore subscriber error */
      }
    });
  }

  function _clearReconnect() {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
  }

  function _scheduleReconnect(gen) {
    _clearReconnect();
    if (!_connected || gen !== _connGen) return;
    const delayMs = Math.min(30000, 2000 * 2 ** Math.min(_attempt, 4));
    _attempt += 1;
    _reconnectTimer = setTimeout(() => {
      if (_connected && gen === _connGen) {
        _openStream(gen);
      }
    }, delayMs);
  }

  async function _openStream(gen) {
    if (!_connected || gen !== _connGen) return;
    if (typeof EventSource === 'undefined') return;

    try {
      const res = await client.post('/sync/ticket');
      const ticket = res?.data?.ticket;
      if (!_connected || gen !== _connGen || !ticket) return;

      const base = (apiBase || '/api/v1').replace(/\/+$/, '');
      const url = `${base}/sync/stream?ticket=${encodeURIComponent(ticket)}`;

      if (_es) {
        try {
          _es.close();
        } catch {
          /* ignore */
        }
        _es = null;
      }

      const es = new EventSource(url);
      _es = es;

      const handlePayload = (raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.domain && typeof parsed.version === 'number') {
            _lastVersions = { ...(_lastVersions || {}), [parsed.domain]: parsed.version };
          }
          _emit(parsed);
        } catch {
          /* ignore malformed SSE frames */
        }
      };

      es.addEventListener('sync', (evt) => handlePayload(evt?.data));
      es.addEventListener('connected', () => {
        _attempt = 0;
      });
      es.onopen = () => {
        _attempt = 0;
      };
      es.onerror = () => {
        try {
          es.close();
        } catch {
          /* ignore */
        }
        if (_es === es) _es = null;
        _scheduleReconnect(gen);
      };
    } catch {
      _scheduleReconnect(gen);
    }
  }

  return {
    connect() {
      if (_connected && _es) return;
      _connected = true;
      _attempt = 0;
      const gen = ++_connGen;
      _openStream(gen);
    },

    disconnect() {
      _connected = false;
      _connGen += 1;
      _clearReconnect();
      if (_es) {
        try {
          _es.close();
        } catch {
          /* ignore */
        }
        _es = null;
      }
    },

    subscribe(cb) {
      if (typeof cb === 'function') _listeners.add(cb);
      return () => _listeners.delete(cb);
    },

    async checkSyncStatus() {
      try {
        const res = await client.get('/sync/status');
        const versions = res?.data?.versions || {};
        if (_lastVersions) {
          for (const [domain, ver] of Object.entries(versions)) {
            if (typeof ver === 'number' && ver > (_lastVersions[domain] || 0)) {
              const eventType = DOMAIN_EVENT_MAP[domain] || `${domain}_updated`;
              _emit({ type: eventType, domain, version: ver, payload: {} });
            }
          }
        }
        _lastVersions = { ...versions };
        return res?.data || null;
      } catch {
        return null;
      }
    },
  };
}
