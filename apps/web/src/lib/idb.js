/**
 * A lightweight, vanilla JavaScript wrapper for IndexedDB.
 * Used for storing data that exceeds localStorage quotas (like the closet items).
 */

export function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open('dressapp_db', 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('closet')) {
        db.createObjectStore('closet');
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function setItem(key, val) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('closet', 'readwrite');
      const store = tx.objectStore('closet');
      const req = store.put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IndexedDB setItem error:', e);
  }
}

export async function getItem(key) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('closet', 'readonly');
      const store = tx.objectStore('closet');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('IndexedDB getItem error:', e);
    return null;
  }
}
