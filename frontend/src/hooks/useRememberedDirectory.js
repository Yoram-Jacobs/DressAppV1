/**
 * useRememberedDirectory.js
 * =========================
 * Remembers the last-used file-picker directory across sessions using the
 * File System Access API (Chrome/Edge 86+) with an IndexedDB-backed
 * FileSystemDirectoryHandle.  Falls back silently to the standard
 * <input type="file"> .click() approach on Safari / Firefox.
 *
 * Usage:
 *   const { openFilePicker } = useRememberedDirectory('images');
 *   // or
 *   const { openFilePicker } = useRememberedDirectory('receipts');
 *
 *   // In a button handler:
 *   openFilePicker({
 *     accept: [{ description: 'Images', accept: { 'image/*': [] } }],
 *     multiple: true,
 *     fallbackInputRef,   // ref to a hidden <input type="file"> for fallback
 *     onFiles: (files) => handleFiles(files),
 *   });
 *
 * The `key` argument namespaces the stored handle so image uploads and
 * receipt uploads each remember their own last directory independently.
 */

import { useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// IndexedDB helpers — lightweight, no dependency on idb library
// ---------------------------------------------------------------------------
const DB_NAME = 'dressapp_fspicker';
const STORE   = 'directory_handles';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function getHandle(key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = (e) => resolve(e.target.result ?? null);
      req.onerror   = (e) => reject(e.target.error);
    });
  } catch {
    return null;
  }
}

async function putHandle(key, handle) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(handle, key);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  } catch {
    // Non-fatal — we simply won't remember the directory this time.
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param {'images'|'receipts'} key  Namespace for the stored directory handle.
 */
export function useRememberedDirectory(key) {
  const fsApiSupported = typeof window !== 'undefined' &&
                         typeof window.showOpenFilePicker === 'function';

  /**
   * Open a file picker, remembering (and restoring) the last-used directory.
   *
   * @param {object}   opts
   * @param {Array}    opts.accept           MIME-type descriptors for showOpenFilePicker
   * @param {boolean}  [opts.multiple=false] Allow multiple file selection
   * @param {React.RefObject} opts.fallbackInputRef  Hidden <input> ref for non-FSAPI browsers
   * @param {function} opts.onFiles          Called with a File[] when the user picks files
   */
  const openFilePicker = useCallback(async ({
    accept,
    multiple = false,
    fallbackInputRef,
    onFiles,
  }) => {
    // -----------------------------------------------------------------------
    // Branch A: File System Access API (Chrome / Edge) — supports startIn
    // -----------------------------------------------------------------------
    if (fsApiSupported) {
      try {
        // Retrieve the previously saved directory handle (may be null)
        const savedHandle = await getHandle(key);

        // Verify we still have permission; if not, prompt silently.
        let startIn = 'downloads'; // sensible OS-level default
        if (savedHandle) {
          try {
            const perm = await savedHandle.queryPermission({ mode: 'read' });
            if (perm === 'granted' || perm === 'prompt') {
              startIn = savedHandle;
            }
          } catch {
            // Handle is stale — fall through to the default start location.
          }
        }

        const pickerOpts = {
          multiple,
          startIn,
          ...(accept ? { types: accept } : {}),
        };

        const fileHandles = await window.showOpenFilePicker(pickerOpts);
        if (!fileHandles?.length) return;

        // Persist the parent directory for next time.
        // FileSystemFileHandle doesn't expose its parent directly, but we can
        // ask for it via the root handle's resolve() — not universally
        // available. Instead, use the OPFS-friendly workaround: store the
        // first file's handle under a directory-sentinel key, and on next
        // open the browser will start the picker in the same folder.
        // A simpler and reliable way: store the handle itself as the "directory"
        // since startIn also accepts a FileSystemFileHandle on Chrome 91+.
        await putHandle(key, fileHandles[0]);

        const files = await Promise.all(fileHandles.map((h) => h.getFile()));
        onFiles?.(files);
        return;
      } catch (err) {
        // User cancelled (AbortError) or permission denied — fall through
        if (err?.name !== 'AbortError') {
          console.warn('[useRememberedDirectory] FSAPI error, falling back:', err);
        } else {
          return; // User cancelled — don't open the fallback input
        }
      }
    }

    // -----------------------------------------------------------------------
    // Branch B: Fallback — standard <input type="file"> .click()
    // The browser will remember its own last directory for the session
    // (OS-level behaviour), so no extra work needed here.
    // -----------------------------------------------------------------------
    fallbackInputRef?.current?.click();
  }, [fsApiSupported, key]);

  return { openFilePicker, fsApiSupported };
}
