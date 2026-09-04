# ADR-0004: Mobile Closet Repository & Offline-First Cache

## Context

Mobile screens previously mixed direct `api.listCloset()` network calls, manual projection flags (`ids_only`), direct Zustand store mutations, and unsynchronized `AsyncStorage` operations.

This caused:
1. Screen-load latency when navigating between tabs (e.g. ProfileScreen fetching wardrobe counts).
2. Fragile optimistic updates without automated error rollback.
3. Multiple duplicate network fetches across sibling screens.

## Decision

We establish a deep repository module at `apps/mobile/src/lib/repositories/closetRepository.ts` (`closetRepo` and `useCloset()`).

### Invariants

1. **Zero-Latency In-Memory Reads**:
   - All screen reads are synchronous and instant from in-memory cache.
   - Initial hydration loads from `AsyncStorage` on application startup.

2. **Optimistic Mutations with Automatic Rollback**:
   - `saveItem()`, `deleteItem()`, and `deleteMany()` immediately update memory and local storage.
   - If the background network API call fails, the prior item snapshot is restored automatically.

3. **Stale-While-Revalidate (SWR)**:
   - Cache remains valid for 5 minutes (`FRESH_MS = 300_000`).
   - Stale data triggers background revalidation without showing blocking full-screen loaders.

4. **Synchronous Slot Summaries**:
   - `getSummary()` computes wardrobe slot metrics (`total`, `tops`, `bottoms`, `shoes`, `dresses`, `outerwear`, `accessories`) without async roundtrips.

## Consequences

- **Positive**: Instant UI rendering across Closet, Profile, Daily Suggestion, and Outfit Canvas.
- **Positive**: Robust offline support with automated error recovery.
- **Positive**: Single source of truth for wardrobe state across all mobile screens.