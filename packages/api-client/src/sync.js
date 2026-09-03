/**
 * packages/api-client/src/sync.js
 *
 * Universal Real-Time Synchronization Engine for DressApp.
 * Handles SSE streams, version vector status reconciliation, and daily proposal actions
 * across Web, Desktop, and Mobile interfaces.
 */

import { client } from './_singleton.js';

export const sync = {
  /**
   * Fetch current sync version vector for the authenticated user.
   */
  getSyncStatus: () => client.get('/sync/status').then((r) => r.data),

  /**
   * Manually notify other connected devices of a client-side mutation.
   */
  notifySyncEvent: (eventType, payload = {}) =>
    client.post('/sync/notify', { event_type: eventType, payload }).then((r) => r.data),

  /**
   * Unified Daily Proposal endpoints.
   */
  getDailyProposal: () => client.get('/stylist/daily-proposal').then((r) => r.data),

  generateDailyProposal: (force = false) =>
    client.post('/stylist/daily-proposal/generate', { force }).then((r) => r.data),

  actOnDailyProposal: (action, proposalId = null, date = null) =>
    client.post('/stylist/daily-proposal/action', { action, proposal_id: proposalId, date }).then((r) => r.data),
};

/**
 * Universal Sync Manager singleton.
 */
class UniversalSyncManager {
  constructor() {
    this.listeners = new Set();
    this.activeSource = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isConnected = false;
    this.lastVersions = {};
    this.tokenGetter = null;
    this.baseUrl = '';
  }

  /**
   * Configure token getter and base url.
   */
  init({ getToken, backendUrl }) {
    this.tokenGetter = getToken;
    this.baseUrl = (backendUrl || '').replace(/\/+$/, '');
  }

  /**
   * Subscribe to real-time sync events.
   * @param {(event: { type: string, domain: string, version: number, payload: any }) => void} fn
   * @returns {() => void} unsubscribe function
   */
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _notify(event) {
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        // Safe guard against listener errors
      }
    });
  }

  /**
   * Start periodic heartbeat check for instant recovery if SSE stream pauses.
   */
  startHeartbeat(intervalMs = 4000) {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      if (this.listeners.size > 0) {
        this.checkSyncStatus().catch(() => {});
      }
    }, intervalMs);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Start real-time SSE sync connection if token is available.
   * Works universally on Web (EventSource) and React Native (XMLHttpRequest chunk streaming).
   */
  async connect() {
    this.startHeartbeat(4000);

    if (this.activeSource || !this.tokenGetter) return;

    let token = this.tokenGetter();
    if (token && typeof token.then === 'function') {
      token = await token;
    }
    if (!token) return;

    const streamUrl = `${this.baseUrl || ''}/api/v1/sync/stream?token=${encodeURIComponent(token)}`;

    try {
      if (typeof EventSource !== 'undefined') {
        // Web / Standard Browser
        const es = new EventSource(streamUrl);

        es.addEventListener('open', () => {
          this.isConnected = true;
        });

        es.addEventListener('connected', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data?.status?.versions) {
              this.lastVersions = data.status.versions;
            }
          } catch {}
        });

        es.addEventListener('sync', (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data && data.domain && data.version) {
              this.lastVersions[data.domain] = data.version;
            }
            this._notify(data);
          } catch {}
        });

        es.onerror = () => {
          this.isConnected = false;
          es.close();
          this.activeSource = null;
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect();
            }, 3000);
          }
        };

        this.activeSource = es;
      } else if (typeof XMLHttpRequest !== 'undefined') {
        // React Native (Expo) - Native XMLHttpRequest chunk streaming
        const xhr = new XMLHttpRequest();
        xhr.open('GET', streamUrl, true);
        xhr.setRequestHeader('Accept', 'text/event-stream');
        xhr.setRequestHeader('Cache-Control', 'no-cache');

        let seenIndex = 0;
        let buffer = '';

        const parseSSEChunk = (text) => {
          buffer += text;
          const messages = buffer.split('\n\n');
          buffer = messages.pop() || '';

          for (const rawMsg of messages) {
            if (!rawMsg.trim() || rawMsg.startsWith(':')) {
              continue; // Heartbeat or comment
            }
            let eventType = 'message';
            let dataStr = '';
            const lines = rawMsg.split('\n');
            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataStr += (dataStr ? '\n' : '') + line.slice(5).trim();
              }
            }
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);
                if (eventType === 'connected' && data?.status?.versions) {
                  this.lastVersions = data.status.versions;
                } else if (eventType === 'sync' && data?.domain && data?.version) {
                  this.lastVersions[data.domain] = data.version;
                  this._notify(data);
                } else if (data?.type) {
                  this._notify(data);
                }
              } catch (e) {}
            }
          }
        };

        xhr.onprogress = () => {
          try {
            const currentText = xhr.responseText || '';
            if (currentText.length > seenIndex) {
              const chunk = currentText.slice(seenIndex);
              seenIndex = currentText.length;
              parseSSEChunk(chunk);
            }
          } catch {}
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 2 || xhr.readyState === 3) {
            this.isConnected = true;
            try {
              const currentText = xhr.responseText || '';
              if (currentText.length > seenIndex) {
                const chunk = currentText.slice(seenIndex);
                seenIndex = currentText.length;
                parseSSEChunk(chunk);
              }
            } catch {}
          } else if (xhr.readyState === 4) {
            this.isConnected = false;
            this.activeSource = null;
            if (!this.reconnectTimer) {
              this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this.connect();
              }, 3000);
            }
          }
        };

        xhr.onerror = () => {
          this.isConnected = false;
          this.activeSource = null;
          if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.connect();
            }, 3000);
          }
        };

        this.activeSource = {
          close: () => {
            try { xhr.abort(); } catch {}
          },
        };

        xhr.send();
      }
    } catch (err) {
      this.activeSource = null;
      this.isConnected = false;
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.activeSource) {
      try {
        this.activeSource.close();
      } catch {}
      this.activeSource = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isConnected = false;
  }

  /**
   * Check sync status and reconcile stale domains.
   * Useful when returning from background or focusing browser tab.
   */
  async checkSyncStatus() {
    try {
      const status = await sync.getSyncStatus();
      if (!status || !status.versions) return;

      const serverVersions = status.versions;
      const outdatedDomains = [];

      for (const [domain, serverVer] of Object.entries(serverVersions)) {
        const clientVer = this.lastVersions[domain] || 0;
        if (serverVer > clientVer) {
          outdatedDomains.push(domain);
          this.lastVersions[domain] = serverVer;
        }
      }

      if (outdatedDomains.length > 0) {
        outdatedDomains.forEach((domain) => {
          this._notify({
            type: `${domain}_updated`,
            domain,
            version: serverVersions[domain],
            payload: { reason: 'reconciliation' },
          });
        });
      }
    } catch {}
  }
}

export const syncManager = new UniversalSyncManager();
