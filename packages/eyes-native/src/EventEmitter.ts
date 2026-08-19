/**
 * packages/eyes-native/src/EventEmitter.ts
 * Tiny typed event emitter — no external dep needed.
 */
export class EventEmitter<T> {
  private listeners: Array<(value: T) => void> = [];

  emit(value: T): void {
    for (const l of this.listeners) {
      try { l(value); } catch { /* swallow */ }
    }
  }

  /** Returns an unsubscribe function. */
  on(fn: (value: T) => void): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter((l) => l !== fn); };
  }
}
