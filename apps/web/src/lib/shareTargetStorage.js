/**
 * Helper to retrieve and clear media files stored in IndexedDB by the Web Share Target Service Worker.
 */
export function getSharedMediaFromStorage() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    try {
      const req = window.indexedDB.open('dressapp_share_store', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('shares')) {
          req.result.createObjectStore('shares');
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('shares')) {
          db.close();
          resolve(null);
          return;
        }
        const tx = db.transaction('shares', 'readwrite');
        const store = tx.objectStore('shares');
        const getReq = store.get('latest_shared_image');
        getReq.onsuccess = () => {
          const file = getReq.result;
          try {
            store.delete('latest_shared_image');
          } catch (_) {}
          db.close();
          resolve(file || null);
        };
        getReq.onerror = () => {
          db.close();
          resolve(null);
        };
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
