/**
 * Mobile safe sync manager using short-lived single-use opaque tickets
 * instead of passing long-lived Bearer JWTs in query parameters.
 */

const DOMAIN_EVENT_MAP: Record<string, string> = {
  profile: 'profile_updated',
  closet: 'closet_updated',
  daily_suggestions: 'daily_suggestions_updated',
  stylist: 'stylist_updated',
  lookbook: 'lookbook_updated',
  trend_scout: 'trend_scout_updated',
};

export function createMobileSyncManager(client: any, apiBase: string) {
  let _es: any = null;
  let _reconnectTimer: any = null;
  let _pollTimer: any = null;
  let _connected = false;
  let _connGen = 0;
  let _attempt = 0;
  let _lastVersions: Record<string, number> | null = null;
  const _listeners = new Set<(event: any) => void>();

  function emit(event: any) {
    _listeners.forEach((cb) => {
      try {
        cb(event);
      } catch {
        // swallow listener errors
      }
    });
  }

  function clearTimers() {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    }
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  }

  async function checkSyncStatus() {
    try {
      const res = await client.get('/sync/status');
      const versions: Record<string, number> = res?.data?.versions || {};
      if (_lastVersions) {
        for (const [domain, ver] of Object.entries(versions)) {
          if (typeof ver === 'number' && ver > (_lastVersions[domain] || 0)) {
            const eventType = DOMAIN_EVENT_MAP[domain] || `${domain}_updated`;
            emit({ type: eventType, domain, version: ver, payload: {} });
          }
        }
      }
      _lastVersions = { ...versions };
      return res?.data || null;
    } catch {
      return null;
    }
  }

  function scheduleReconnect(gen: number) {
    if (_reconnectTimer) clearTimeout(_reconnectTimer);
    if (!_connected || gen !== _connGen) return;
    const delayMs = Math.min(30000, 2000 * 2 ** Math.min(_attempt, 4));
    _attempt += 1;
    _reconnectTimer = setTimeout(() => {
      if (_connected && gen === _connGen) {
        void openStream(gen);
      }
    }, delayMs);
  }

  async function openStream(gen: number) {
    if (!_connected || gen !== _connGen) return;
    const EventSourceCtor = (globalThis as any)?.EventSource;
    if (!EventSourceCtor) {
      // React Native environments without native EventSource use foreground polling.
      if (!_pollTimer) {
        await checkSyncStatus();
        _pollTimer = setInterval(() => {
          if (_connected && gen === _connGen) void checkSyncStatus();
        }, 30000);
      }
      return;
    }

    try {
      const res = await client.post('/sync/ticket');
      const ticket = res?.data?.ticket;
      if (!_connected || gen !== _connGen || !ticket) return;

      const base = (apiBase || '').replace(/\/+$/, '');
      const url = `${base}/sync/stream?ticket=${encodeURIComponent(ticket)}`;

      if (_es) {
        try {
          _es.close();
        } catch {
          // ignore
        }
        _es = null;
      }

      const es = new EventSourceCtor(url);
      _es = es;
      es.addEventListener?.('sync', (evt: any) => {
        try {
          const parsed = JSON.parse(evt?.data || '{}');
          if (parsed?.domain && typeof parsed.version === 'number') {
            _lastVersions = { ...(_lastVersions || {}), [parsed.domain]: parsed.version };
          }
          emit(parsed);
        } catch {
          // ignore parse errors
        }
      });
      es.onopen = () => {
        _attempt = 0;
      };
      es.onerror = () => {
        try {
          es.close();
        } catch {
          // ignore
        }
        if (_es === es) _es = null;
        scheduleReconnect(gen);
      };
    } catch {
      scheduleReconnect(gen);
    }
  }

  return {
    connect() {
      if (_connected && (_es || _pollTimer)) return;
      _connected = true;
      _attempt = 0;
      const gen = ++_connGen;
      void openStream(gen);
    },
    disconnect() {
      _connected = false;
      _connGen += 1;
      clearTimers();
      if (_es) {
        try {
          _es.close();
        } catch {
          // ignore
        }
        _es = null;
      }
    },
    subscribe(cb: (event: any) => void) {
      _listeners.add(cb);
      return () => _listeners.delete(cb);
    },
    checkSyncStatus,
  };
}
