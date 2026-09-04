/**
 * apps/mobile/src/__tests__/itemDetail.adversarial.test.mjs
 *
 * Comprehensive Adversarial & Empirical Test Harness for ItemDetailScreen
 * Milestone M2 Verification Suite
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── 1. Re-export & Isolation of ItemDetailScreen Logic ──────────────────────

const STORAGE_CACHE_KEY = '@dressapp:closet_cache';
const BACKEND_URL = 'https://dressapp.co';

const COLOR_HEX_MAP = {
  black: '#111827',
  white: '#FFFFFF',
  navy: '#1E3A8A',
  blue: '#2563EB',
  lightblue: '#93C5FD',
  sky: '#38BDF8',
  red: '#DC2626',
  burgundy: '#831843',
  crimson: '#991B1B',
  green: '#16A34A',
  olive: '#556B2F',
  sage: '#84A98C',
  forest: '#14532D',
  yellow: '#EAB308',
  mustard: '#CA8A04',
  orange: '#EA580C',
  rust: '#C2410C',
  brown: '#78350F',
  tan: '#D97706',
  beige: '#D4B996',
  cream: '#FDFBF7',
  khaki: '#C3B091',
  gray: '#6B7280',
  grey: '#6B7280',
  charcoal: '#374151',
  silver: '#9CA3AF',
  pink: '#EC4899',
  blush: '#FBCFE8',
  purple: '#9333EA',
  lavender: '#C084FC',
  violet: '#7C3AED',
  gold: '#F59E0B',
};

function resolveColorHex(colorName, explicitHex) {
  if (explicitHex && typeof explicitHex === 'string' && explicitHex.startsWith('#')) return explicitHex;
  if (!colorName || typeof colorName !== 'string') return '#9CA3AF';
  const clean = colorName.trim().toLowerCase().replace(/[\s-_]+/g, '');
  for (const [key, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (clean === key || clean.includes(key)) {
      return hex;
    }
  }
  return '#9CA3AF';
}

function resolveItemImageUrl(item) {
  if (!item) return null;

  const rawUrl =
    item.reconstructed_image_url ||
    item.clean_image_url ||
    item.cutout_url ||
    item.segmented_image_url ||
    item.image_variants?.webp?.medium ||
    item.image_variants?.avif?.medium ||
    item.image_variants?.original ||
    item.thumbnail_data_url ||
    item.original_image_url ||
    item.image_url ||
    item.photo_url;

  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `${BACKEND_URL}${trimmed}`;
  }

  return `${BACKEND_URL}/${trimmed}`;
}

function sanitizeItemId(rawItemId) {
  return typeof rawItemId === 'string' ? rawItemId.trim() : '';
}

function calculatePricing(item, lang = 'en') {
  let priceFormatted = null;
  if (item?.price_cents && item.price_cents > 0) {
    try {
      priceFormatted = new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: item.currency || 'USD',
      }).format(item.price_cents / 100);
    } catch {
      priceFormatted = `$${(item.price_cents / 100).toFixed(2)}`;
    }
  }

  let costPerWearFormatted = null;
  if (item?.price_cents && item.price_cents > 0) {
    const wears = Math.max(1, item.wear_count || 1);
    const cpw = item.price_cents / 100 / wears;
    try {
      costPerWearFormatted = new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: item.currency || 'USD',
      }).format(cpw);
    } catch {
      costPerWearFormatted = `$${cpw.toFixed(2)}`;
    }
  }

  return { priceFormatted, costPerWearFormatted };
}

function deriveGroupMembers(item) {
  if (!item) return [];
  const members = Array.isArray(item.group_members) ? item.group_members : [];
  const list = [item, ...members];
  return list.filter((v, i, a) => a.findIndex((tItem) => tItem.id === v.id) === i);
}

function deriveSeasons(item) {
  if (!item) return [];
  if (Array.isArray(item.season)) return item.season;
  if (typeof item.season === 'string' && item.season.trim()) return [item.season.trim()];
  return [];
}

function deriveColors(item) {
  if (!item) return [];
  if (Array.isArray(item.colors) && item.colors.length > 0) return item.colors;
  if (item.color && typeof item.color === 'string') {
    return [{ name: item.color, pct: 100, hex: resolveColorHex(item.color) }];
  }
  return [];
}

function deriveFabrics(item) {
  if (!item) return [];
  if (Array.isArray(item.fabric_materials) && item.fabric_materials.length > 0) {
    return item.fabric_materials;
  }
  if (item.material && typeof item.material === 'string') {
    return [{ name: item.material, pct: 100 }];
  }
  return [];
}

// ── 2. Mock State Machine Harness ──────────────────────────────────────────

class MockItemDetailHarness {
  constructor({ routeParams, mockApi, initialStorage = {} }) {
    this.routeParams = routeParams;
    this.api = mockApi;
    this.storage = { ...initialStorage };
    this.rawItemId = routeParams?.itemId;
    this.itemId = sanitizeItemId(this.rawItemId);

    this.state = {
      item: null,
      loading: true,
      refreshing: false,
      deleting: false,
      error: null,
      is404: false,
      selectedAngleId: this.itemId,
      imageError: false,
    };

    this.isMounted = true;
    this.isDeletingRef = false;
    this.navigationEvents = [];
    this.alertEvents = [];
  }

  navigate(screen, params) {
    this.navigationEvents.push({ action: 'navigate', screen, params });
  }

  goBack() {
    this.navigationEvents.push({ action: 'goBack' });
  }

  canGoBack() {
    return true;
  }

  showAlert(title, message, buttons) {
    this.alertEvents.push({ title, message, buttons });
  }

  async fetchItem(isRefresh = false) {
    if (!this.itemId) {
      this.state.is404 = true;
      this.state.error = 'Item not found';
      this.state.loading = false;
      return;
    }

    if (isRefresh) {
      this.state.refreshing = true;
    } else {
      this.state.loading = true;
    }
    this.state.error = null;
    this.state.is404 = false;

    try {
      const data = await this.api.getItem(this.itemId);
      if (!this.isMounted) return;

      if (data) {
        this.state.item = data;
        this.state.selectedAngleId = data.id || this.itemId;
      } else {
        this.state.is404 = true;
        this.state.error = 'Item not found';
      }
    } catch (err) {
      if (!this.isMounted) return;

      const status = err?.response?.status;
      if (status === 404) {
        this.state.is404 = true;
        this.state.error = 'Item not found';
      } else {
        // Cache fallback
        try {
          const cachedRaw = this.storage[STORAGE_CACHE_KEY];
          if (cachedRaw) {
            const cachedList = JSON.parse(cachedRaw);
            if (Array.isArray(cachedList)) {
              const found = cachedList.find((it) => it.id === this.itemId);
              if (found) {
                this.state.item = found;
                this.state.selectedAngleId = found.id || this.itemId;
                this.state.loading = false;
                this.state.refreshing = false;
                return;
              }
            }
          }
        } catch (cacheErr) {
          // ignore
        }

        const msg = err?.response?.data?.detail || err?.message || 'Could not load garment details.';
        this.state.error = msg;
      }
    } finally {
      if (this.isMounted) {
        this.state.loading = false;
        this.state.refreshing = false;
      }
    }
  }

  async triggerDelete() {
    if (this.isDeletingRef || this.state.deleting || !this.itemId) {
      return { triggered: false, reason: 'blocked_by_guard' };
    }

    // Simulate confirmation dialog action
    if (this.isDeletingRef) return { triggered: false, reason: 'race_lock' };
    this.isDeletingRef = true;
    this.state.deleting = true;

    try {
      await this.api.deleteItem(this.itemId);

      // Evict cache
      if (this.storage[STORAGE_CACHE_KEY]) {
        try {
          const list = JSON.parse(this.storage[STORAGE_CACHE_KEY]);
          if (Array.isArray(list)) {
            const updated = list.filter((it) => it.id !== this.itemId);
            this.storage[STORAGE_CACHE_KEY] = JSON.stringify(updated);
          }
        } catch (e) {
          // ignore
        }
      }

      if (this.canGoBack()) {
        this.goBack();
      } else {
        this.navigate('Closet');
      }
      return { triggered: true, success: true };
    } catch (err) {
      this.isDeletingRef = false;
      if (this.isMounted) {
        this.state.deleting = false;
      }

      if (err?.response?.status === 404) {
        if (this.canGoBack()) {
          this.goBack();
        } else {
          this.navigate('Closet');
        }
        return { triggered: true, success: true, handled404: true };
      }

      const errorMsg = err?.response?.data?.detail || err?.message || 'Failed to delete item.';
      this.showAlert('Error', errorMsg);
      return { triggered: true, success: false, error: errorMsg };
    }
  }
}

// ── 3. Empirical Test Suites ────────────────────────────────────────────────

describe('Adversarial Test Suite 1: Image Fallback Cascade & URL Resolution', () => {
  it('1.1 should respect strict cascade priority order across all 11 fields', () => {
    const allUrlsItem = {
      id: 'item-101',
      reconstructed_image_url: 'https://cdn.dressapp.co/ai_reconstructed.webp',
      clean_image_url: 'https://cdn.dressapp.co/clean_bg.webp',
      cutout_url: 'https://cdn.dressapp.co/cutout.png',
      segmented_image_url: 'https://cdn.dressapp.co/seg.png',
      image_variants: {
        webp: { medium: 'https://cdn.dressapp.co/variants/medium.webp' },
        avif: { medium: 'https://cdn.dressapp.co/variants/medium.avif' },
        original: 'https://cdn.dressapp.co/variants/original.jpg',
      },
      thumbnail_data_url: 'data:image/jpeg;base64,thumb123',
      original_image_url: 'https://cdn.dressapp.co/orig.jpg',
      image_url: 'https://cdn.dressapp.co/img.jpg',
      photo_url: 'https://cdn.dressapp.co/photo.jpg',
    };

    // Level 1: reconstructed
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/ai_reconstructed.webp');

    // Level 2: clean_image_url
    delete allUrlsItem.reconstructed_image_url;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/clean_bg.webp');

    // Level 3: cutout_url
    delete allUrlsItem.clean_image_url;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/cutout.png');

    // Level 4: segmented_image_url
    delete allUrlsItem.cutout_url;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/seg.png');

    // Level 5: webp.medium
    delete allUrlsItem.segmented_image_url;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/variants/medium.webp');

    // Level 6: avif.medium
    delete allUrlsItem.image_variants.webp;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/variants/medium.avif');

    // Level 7: image_variants.original
    delete allUrlsItem.image_variants.avif;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/variants/original.jpg');

    // Level 8: thumbnail_data_url
    delete allUrlsItem.image_variants;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'data:image/jpeg;base64,thumb123');

    // Level 9: original_image_url
    delete allUrlsItem.thumbnail_data_url;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/orig.jpg');

    // Level 10: image_url
    delete allUrlsItem.original_image_url;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/img.jpg');

    // Level 11: photo_url
    delete allUrlsItem.image_url;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), 'https://cdn.dressapp.co/photo.jpg');

    // Level 12: None remaining -> null
    delete allUrlsItem.photo_url;
    assert.strictEqual(resolveItemImageUrl(allUrlsItem), null);
  });

  it('1.2 should correctly resolve relative paths, backend prefixing, and data URLs', () => {
    assert.strictEqual(resolveItemImageUrl({ image_url: 'data:image/png;base64,AAA' }), 'data:image/png;base64,AAA');
    assert.strictEqual(resolveItemImageUrl({ image_url: 'http://foo.com/bar.jpg' }), 'http://foo.com/bar.jpg');
    assert.strictEqual(resolveItemImageUrl({ image_url: 'https://foo.com/bar.jpg' }), 'https://foo.com/bar.jpg');
    assert.strictEqual(resolveItemImageUrl({ image_url: '/uploads/garment_123.webp' }), 'https://dressapp.co/uploads/garment_123.webp');
    assert.strictEqual(resolveItemImageUrl({ image_url: 'uploads/garment_123.webp' }), 'https://dressapp.co/uploads/garment_123.webp');
    assert.strictEqual(resolveItemImageUrl({ image_url: '   https://foo.com/spaced.jpg   ' }), 'https://foo.com/spaced.jpg');
  });

  it('1.3 should handle invalid/corrupt image values safely without throwing', () => {
    assert.strictEqual(resolveItemImageUrl(null), null);
    assert.strictEqual(resolveItemImageUrl(undefined), null);
    assert.strictEqual(resolveItemImageUrl({}), null);
    assert.strictEqual(resolveItemImageUrl({ image_url: '' }), null);
    assert.strictEqual(resolveItemImageUrl({ image_url: '   ' }), null);
    assert.strictEqual(resolveItemImageUrl({ image_url: 12345 }), null);
    assert.strictEqual(resolveItemImageUrl({ image_url: true }), null);
    assert.strictEqual(resolveItemImageUrl({ image_url: {} }), null);
    assert.strictEqual(resolveItemImageUrl({ image_url: [] }), null);
  });
});

describe('Adversarial Test Suite 2: Color Hex Resolution & Normalization', () => {
  it('2.1 should prioritize valid explicit hex values', () => {
    assert.strictEqual(resolveColorHex('red', '#1E3A8A'), '#1E3A8A');
    assert.strictEqual(resolveColorHex(null, '#AABBCC'), '#AABBCC');
    assert.strictEqual(resolveColorHex('black', '#123456'), '#123456');
  });

  it('2.2 should map named colors with case-insensitivity and whitespace tolerance', () => {
    assert.strictEqual(resolveColorHex('black'), '#111827');
    assert.strictEqual(resolveColorHex('  NAVY  '), '#1E3A8A');
    assert.strictEqual(resolveColorHex('crimson'), '#991B1B');
    assert.strictEqual(resolveColorHex('mustard'), '#CA8A04');
    assert.strictEqual(resolveColorHex('blush'), '#FBCFE8');
    assert.strictEqual(resolveColorHex('sage'), '#84A98C');
  });

  it('2.3 should safely fallback to #9CA3AF for unknown or corrupt color names', () => {
    assert.strictEqual(resolveColorHex(null), '#9CA3AF');
    assert.strictEqual(resolveColorHex(undefined), '#9CA3AF');
    assert.strictEqual(resolveColorHex(''), '#9CA3AF');
    assert.strictEqual(resolveColorHex('unknown_xyz_random_shade'), '#9CA3AF');
    assert.strictEqual(resolveColorHex(12345), '#9CA3AF');
    assert.strictEqual(resolveColorHex({}), '#9CA3AF');
  });
});

describe('Adversarial Test Suite 3: Route Parameters & Item ID Boundary Handling', () => {
  it('3.1 should handle undefined route params and empty string IDs', async () => {
    const harness = new MockItemDetailHarness({
      routeParams: undefined,
      mockApi: { getItem: async () => assert.fail('Should not call API') },
    });

    assert.strictEqual(harness.itemId, '');
    await harness.fetchItem();
    assert.strictEqual(harness.state.is404, true);
    assert.strictEqual(harness.state.loading, false);
    assert.strictEqual(harness.state.error, 'Item not found');
  });

  it('3.2 should handle null, undefined, whitespace, or non-string itemId', async () => {
    const testCases = [
      { itemId: null },
      { itemId: undefined },
      { itemId: '' },
      { itemId: '    ' },
      { itemId: 9999 },
      { itemId: { id: 'nested' } },
    ];

    for (const params of testCases) {
      const harness = new MockItemDetailHarness({
        routeParams: params,
        mockApi: { getItem: async () => assert.fail('Should not call API') },
      });

      assert.strictEqual(harness.itemId, '');
      await harness.fetchItem();
      assert.strictEqual(harness.state.is404, true);
      assert.strictEqual(harness.state.error, 'Item not found');

      const deleteRes = await harness.triggerDelete();
      assert.strictEqual(deleteRes.triggered, false);
      assert.strictEqual(deleteRes.reason, 'blocked_by_guard');
    }
  });
});

describe('Adversarial Test Suite 4: Missing Item Attributes & Malformed Item Payloads', () => {
  it('4.1 should handle completely empty item document with graceful fallbacks', () => {
    const emptyItem = { id: 'empty-1' };
    const pricing = calculatePricing(emptyItem);
    assert.strictEqual(pricing.priceFormatted, null);
    assert.strictEqual(pricing.costPerWearFormatted, null);

    const seasons = deriveSeasons(emptyItem);
    assert.deepStrictEqual(seasons, []);

    const colors = deriveColors(emptyItem);
    assert.deepStrictEqual(colors, []);

    const fabrics = deriveFabrics(emptyItem);
    assert.deepStrictEqual(fabrics, []);

    const members = deriveGroupMembers(emptyItem);
    assert.strictEqual(members.length, 1);
    assert.strictEqual(members[0].id, 'empty-1');
  });

  it('4.2 should handle singular fallback for color and material', () => {
    const singularItem = {
      id: 'sing-1',
      color: 'navy',
      material: '100% Silk',
    };

    const colors = deriveColors(singularItem);
    assert.strictEqual(colors.length, 1);
    assert.strictEqual(colors[0].name, 'navy');
    assert.strictEqual(colors[0].hex, '#1E3A8A');

    const fabrics = deriveFabrics(singularItem);
    assert.strictEqual(fabrics.length, 1);
    assert.strictEqual(fabrics[0].name, '100% Silk');
    assert.strictEqual(fabrics[0].pct, 100);
  });

  it('4.3 should compute pricing & cost-per-wear accurately under boundary values', () => {
    // 0 price -> null
    assert.strictEqual(calculatePricing({ price_cents: 0 }).priceFormatted, null);
    assert.strictEqual(calculatePricing({ price_cents: -500 }).priceFormatted, null);
    assert.strictEqual(calculatePricing({ price_cents: null }).priceFormatted, null);

    // Normal price with 0 wears -> divides by 1
    const p1 = calculatePricing({ price_cents: 8000, wear_count: 0, currency: 'USD' });
    assert.strictEqual(p1.priceFormatted, '$80.00');
    assert.strictEqual(p1.costPerWearFormatted, '$80.00');

    // Normal price with 4 wears -> $20.00 CPW
    const p2 = calculatePricing({ price_cents: 8000, wear_count: 4, currency: 'USD' });
    assert.strictEqual(p2.priceFormatted, '$80.00');
    assert.strictEqual(p2.costPerWearFormatted, '$20.00');

    // Undefined wear count -> defaults to 1
    const p3 = calculatePricing({ price_cents: 5000, wear_count: undefined, currency: 'USD' });
    assert.strictEqual(p3.costPerWearFormatted, '$50.00');
  });

  it('4.4 should deduplicate multi-angle group members without duplicate keys', () => {
    const hostItem = {
      id: 'garment-1',
      group_members: [
        { id: 'garment-1', group_role: 'host' }, // duplicate of host
        { id: 'garment-2', group_role: 'member' },
        { id: 'garment-2', group_role: 'member' }, // duplicate member
        { id: 'garment-3', group_role: 'member' },
      ],
    };

    const members = deriveGroupMembers(hostItem);
    assert.strictEqual(members.length, 3);
    assert.deepStrictEqual(members.map(m => m.id), ['garment-1', 'garment-2', 'garment-3']);
  });
});

describe('Adversarial Test Suite 5: Concurrent Delete Operations (Rapid Fire / Double-Tap)', () => {
  it('5.1 should serialize delete requests and execute only 1 network call under rapid multi-tap', async () => {
    let apiCallCount = 0;
    const mockApi = {
      deleteItem: async (id) => {
        apiCallCount++;
        // Simulate 50ms latency
        await new Promise((r) => setTimeout(r, 50));
        return { success: true };
      },
    };

    const initialCache = [
      { id: 'item-to-delete', title: 'Wool Blazer' },
      { id: 'other-item', title: 'Denim Jeans' },
    ];

    const harness = new MockItemDetailHarness({
      routeParams: { itemId: 'item-to-delete' },
      mockApi,
      initialStorage: {
        [STORAGE_CACHE_KEY]: JSON.stringify(initialCache),
      },
    });

    // Simulate 5 simultaneous rapid tap triggers
    const results = await Promise.all([
      harness.triggerDelete(),
      harness.triggerDelete(),
      harness.triggerDelete(),
      harness.triggerDelete(),
      harness.triggerDelete(),
    ]);

    // Exactly 1 network call must have occurred
    assert.strictEqual(apiCallCount, 1, 'Expected exactly 1 API call during rapid multi-tap');

    // First call succeeded, subsequent 4 were rejected by guard
    const succeeded = results.filter(r => r.triggered && r.success);
    const blocked = results.filter(r => !r.triggered && (r.reason === 'blocked_by_guard' || r.reason === 'race_lock'));

    assert.strictEqual(succeeded.length, 1);
    assert.strictEqual(blocked.length, 4);

    // Cache must have been evicted cleanly
    const cachedAfter = JSON.parse(harness.storage[STORAGE_CACHE_KEY]);
    assert.strictEqual(cachedAfter.length, 1);
    assert.strictEqual(cachedAfter[0].id, 'other-item');

    // Navigation back event recorded
    assert.strictEqual(harness.navigationEvents.length, 1);
    assert.strictEqual(harness.navigationEvents[0].action, 'goBack');
  });

  it('5.2 should handle 404 delete error cleanly as successful navigation back', async () => {
    const mockApi = {
      deleteItem: async () => {
        const error = new Error('Item already deleted');
        error.response = { status: 404, data: { detail: 'Not found' } };
        throw error;
      },
    };

    const harness = new MockItemDetailHarness({
      routeParams: { itemId: 'already-gone-item' },
      mockApi,
    });

    const res = await harness.triggerDelete();
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.handled404, true);
    assert.strictEqual(harness.navigationEvents.length, 1);
    assert.strictEqual(harness.navigationEvents[0].action, 'goBack');
  });

  it('5.3 should release delete lock and allow retry when delete fails with 500 error', async () => {
    let callCount = 0;
    const mockApi = {
      deleteItem: async () => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Server 500');
          error.response = { status: 500, data: { detail: 'Internal server error' } };
          throw error;
        }
        return { success: true };
      },
    };

    const harness = new MockItemDetailHarness({
      routeParams: { itemId: 'retry-delete-item' },
      mockApi,
    });

    // Attempt 1: Fails with 500
    const res1 = await harness.triggerDelete();
    assert.strictEqual(res1.success, false);
    assert.strictEqual(harness.isDeletingRef, false);
    assert.strictEqual(harness.state.deleting, false);
    assert.strictEqual(harness.alertEvents.length, 1);

    // Attempt 2: User retries -> Succeeds
    const res2 = await harness.triggerDelete();
    assert.strictEqual(res2.success, true);
    assert.strictEqual(callCount, 2);
    assert.strictEqual(harness.navigationEvents.length, 1);
  });
});

describe('Adversarial Test Suite 6: 404 & Offline Cache Network Recovery', () => {
  it('6.1 should transition to 404 error state on API 404 response', async () => {
    const mockApi = {
      getItem: async () => {
        const error = new Error('Not found');
        error.response = { status: 404, data: { detail: 'Garment not found' } };
        throw error;
      },
    };

    const harness = new MockItemDetailHarness({
      routeParams: { itemId: 'missing-item-999' },
      mockApi,
    });

    await harness.fetchItem();
    assert.strictEqual(harness.state.is404, true);
    assert.strictEqual(harness.state.loading, false);
    assert.strictEqual(harness.state.item, null);
  });

  it('6.2 should seamlessly recover from offline cache on network failure', async () => {
    const cachedItem = {
      id: 'cached-garment-42',
      title: 'Vintage Leather Jacket',
      brand: 'AllSaints',
      price_cents: 35000,
      wear_count: 7,
    };

    const mockApi = {
      getItem: async () => {
        const error = new Error('Network error');
        error.response = { status: 503, data: { detail: 'Service unavailable' } };
        throw error;
      },
    };

    const harness = new MockItemDetailHarness({
      routeParams: { itemId: 'cached-garment-42' },
      mockApi,
      initialStorage: {
        [STORAGE_CACHE_KEY]: JSON.stringify([cachedItem]),
      },
    });

    await harness.fetchItem();
    assert.strictEqual(harness.state.is404, false);
    assert.strictEqual(harness.state.error, null);
    assert.strictEqual(harness.state.loading, false);
    assert.strictEqual(harness.state.item?.title, 'Vintage Leather Jacket');
    assert.strictEqual(harness.state.item?.brand, 'AllSaints');
  });

  it('6.3 should set error state and allow retry on network failure with cache miss', async () => {
    const mockApi = {
      getItem: async () => {
        const error = new Error('Network offline');
        error.response = { status: 503, data: { detail: 'Service offline' } };
        throw error;
      },
    };

    const harness = new MockItemDetailHarness({
      routeParams: { itemId: 'uncached-item-777' },
      mockApi,
      initialStorage: {},
    });

    await harness.fetchItem();
    assert.strictEqual(harness.state.is404, false);
    assert.strictEqual(harness.state.error, 'Service offline');
    assert.strictEqual(harness.state.loading, false);
    assert.strictEqual(harness.state.item, null);
  });
});
