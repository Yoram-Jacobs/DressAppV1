/**
 * LocationProvider — centralises device geolocation + permission state and
 * optionally persists the coords to the authenticated user's profile.
 *
 * The web has no native-app-style "first run" lifecycle, so we approximate
 * it with a `localStorage` flag per device. Components can use the
 * `LocationBanner` to show a soft in-app rationale before we trigger the
 * browser permission prompt — matching the UX users expect on mobile.
 *
 * When the app is eventually wrapped with Capacitor/Expo, the same hook
 * interface maps 1:1 onto the native plugin, so UI code does not need to
 * change.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api } from './api';
import { AuthContext } from './auth';
import { resolveCountry } from './countries';

const LocationContext = createContext(null);

const STORAGE_KEY = 'dressapp.location.v1';
// When the user has never opened the location prompt on this device, we
// record it here so we don't nag them across every page.
const PROMPT_FLAG_KEY = 'dressapp.location.promptedAt.v1';
const CONTACT_GEOCODE_CACHE_PREFIX = 'dressapp.location.contact_geocoded.v1:';

export const geocodeContactAddress = async (address) => {
  if (!address || typeof address !== 'object') return null;
  const { line1, city, region, postal_code, country, lat, lng, lon } = address;

  if (lat != null && (lng != null || lon != null)) {
    const latNum = Number(lat);
    const lngNum = Number(lng != null ? lng : lon);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      return {
        coords: { lat: latNum, lng: lngNum },
        city: city || null,
        region: region || null,
        country: country || null,
        country_code: (address.country_code || '').toUpperCase() || null,
      };
    }
  }

  if (!city && !line1 && !country) return null;

  const keyParts = [line1, city, region, postal_code, country]
    .filter(Boolean)
    .map((s) => String(s).trim());
  const cacheKey = `${CONTACT_GEOCODE_CACHE_PREFIX}${keyParts.join('|')}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.coords?.lat != null && parsed?.coords?.lng != null) {
        return parsed;
      }
    }
  } catch {
    /* ignore storage quota/parse errors */
  }

  const resolvedC = resolveCountry(country);
  const countryCode = resolvedC?.code?.toLowerCase() || '';

  const cleanLine1 = line1
    ? line1
        .replace(/\b(street|st\.|st|str\.|avenue|ave\.|ave|road|rd\.|rd)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

  const candidates = [
    cleanLine1 && city ? `${cleanLine1}, ${city}, ${country || ''}` : null,
    line1 && city ? `${line1}, ${city}, ${country || ''}` : null,
    city && country ? `${city}, ${country}` : null,
    city || null,
    country || null,
  ].filter(Boolean);

  for (const query of candidates) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        addressdetails: '1',
        limit: '1',
        'accept-language': typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en',
      });
      if (countryCode) params.set('countrycodes', countryCode);

      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const addr = item.address || {};
        const result = {
          coords: {
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          },
          city: city || addr.city || addr.town || addr.village || addr.municipality || null,
          region: region || addr.state || addr.region || null,
          country: country || addr.country || null,
          country_code: (addr.country_code || countryCode || '').toUpperCase() || null,
          displayName: item.display_name,
        };
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {
          /* ignore */
        }
        return result;
      }
    } catch {
      // Continue to next candidate query
    }
  }

  return null;
};

const loadCached = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveCached = (value) => {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* quota / private mode — ignore */
  }
};

/**
 * Reverse-geocode via OpenStreetMap Nominatim. We round coordinates to ~1km
 * granularity for the cache key to keep the request count low and honor the
 * service's fair-use policy. No API key required.
 */
const reverseGeocode = async (lat, lng) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(
      2,
    )}&lon=${lng.toFixed(2)}&zoom=10&addressdetails=1&accept-language=${
      navigator.language || 'en'
    }`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const addr = json?.address || {};
    return {
      city:
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.county ||
        null,
      region: addr.state || addr.region || null,
      country: addr.country || null,
      country_code: (addr.country_code || '').toUpperCase() || null,
    };
  } catch {
    return null;
  }
};

export function LocationProvider({ children }) {
  const cached = loadCached();
  const auth = useContext(AuthContext);
  const user = auth?.user;

  const [state, setState] = useState({
    coords: cached?.coords || null,
    accuracy_m: cached?.accuracy_m || null,
    city: cached?.city || null,
    country: cached?.country || null,
    country_code: cached?.country_code || null,
    lastUpdatedAt: cached?.lastUpdatedAt || null,
    permissionState: 'unknown',
    available: typeof navigator !== 'undefined' && !!navigator.geolocation,
    isFallback: Boolean(cached?.isFallback),
    source: cached?.source || (cached?.coords ? 'browser' : null),
  });

  // Probe the Permissions API non-intrusively so the UI knows whether to
  // show the soft rationale or immediately reflect a granted/denied state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.permissions?.query) {
        setState((s) => ({
          ...s,
          permissionState: s.coords && !s.isFallback ? 'granted' : 'prompt',
        }));
        return;
      }
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (cancelled) return;
        setState((s) => ({ ...s, permissionState: status.state }));
        status.onchange = () => {
          setState((s) => ({ ...s, permissionState: status.state }));
        };
      } catch {
        setState((s) => ({ ...s, permissionState: 'prompt' }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When browser blocks location ('denied' or 'unavailable'), default to the
  // user's contact details location from their profile (address or home_location).
  useEffect(() => {
    let cancelled = false;
    const isBlocked = state.permissionState === 'denied' || state.permissionState === 'unavailable';
    if (!isBlocked) return;

    // If we already have live browser GPS coords active in this session, keep them
    if (state.coords && !state.isFallback && state.source === 'browser') {
      return;
    }

    const addr = user?.address;
    const homeLoc = user?.home_location;

    // Fast path: home_location already contains resolved coordinates
    if (homeLoc?.lat != null && (homeLoc?.lng != null || homeLoc?.lon != null)) {
      const lat = Number(homeLoc.lat);
      const lng = Number(homeLoc.lng ?? homeLoc.lon);
      if (!isNaN(lat) && !isNaN(lng)) {
        setState((s) => ({
          ...s,
          coords: { lat, lng },
          accuracy_m: null,
          city: homeLoc.city || addr?.city || s.city,
          country: homeLoc.country || addr?.country || s.country,
          country_code: (homeLoc.country_code || addr?.country_code || s.country_code || '').toUpperCase() || null,
          isFallback: true,
          source: 'contact_details',
          lastUpdatedAt: homeLoc.updated_at || s.lastUpdatedAt || new Date().toISOString(),
        }));
        return;
      }
    }

    // Otherwise geocode from contact address (line1, city, country)
    if (addr && (addr.city || addr.line1 || addr.country)) {
      geocodeContactAddress(addr).then((resolved) => {
        if (cancelled || !resolved) return;
        setState((s) => ({
          ...s,
          coords: resolved.coords,
          accuracy_m: null,
          city: resolved.city,
          country: resolved.country,
          country_code: resolved.country_code,
          isFallback: true,
          source: 'contact_details',
          lastUpdatedAt: new Date().toISOString(),
        }));

        // Silently persist coordinates to home_location if not yet recorded
        if (!homeLoc?.lat) {
          api.patchMe({
            home_location: {
              lat: resolved.coords.lat,
              lng: resolved.coords.lng,
              city: resolved.city,
              country: resolved.country,
              country_code: resolved.country_code,
              updated_at: new Date().toISOString(),
            },
          }).catch(() => {});
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [state.permissionState, user?.address, user?.home_location, state.coords, state.isFallback, state.source]);

  const persistToServer = useCallback(async (payload) => {
    try {
      await api.patchMe({
        home_location: {
          lat: payload.coords.lat,
          lng: payload.coords.lng,
          city: payload.city || null,
          country: payload.country || null,
          country_code: payload.country_code || null,
          updated_at: payload.lastUpdatedAt,
        },
      });
    } catch {
      // Profile may be unauthenticated on the login page — swallow silently.
    }
  }, []);

  /**
   * Ask the browser for the user's current position. Shows the native
   * permission prompt if required. Resolves with the new state payload on
   * success; rejects with a typed error on failure.
   */
  const request = useCallback(
    ({ persist = true } = {}) =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          setState((s) => ({ ...s, permissionState: 'unavailable' }));
          reject(new Error('unavailable'));
          return;
        }
        try {
          localStorage.setItem(PROMPT_FLAG_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const coords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            };
            const payload = {
              coords,
              accuracy_m: pos.coords.accuracy || null,
              city: null,
              country: null,
              country_code: null,
              lastUpdatedAt: new Date().toISOString(),
              isFallback: false,
              source: 'browser',
            };
            // Best-effort reverse geocode (non-blocking for the UI state update).
            const geo = await reverseGeocode(coords.lat, coords.lng);
            if (geo) Object.assign(payload, geo);
            setState((s) => ({
              ...s,
              ...payload,
              permissionState: 'granted',
            }));
            saveCached(payload);
            if (persist) persistToServer(payload);
            resolve(payload);
          },
          (err) => {
            const isDenied = err.code === 1;
            setState((s) => ({
              ...s,
              permissionState: isDenied ? 'denied' : s.permissionState,
            }));
            // Immediately activate contact fallback if denied
            if (isDenied && user?.address) {
              geocodeContactAddress(user.address).then((resolved) => {
                if (resolved) {
                  setState((s) => ({
                    ...s,
                    coords: resolved.coords,
                    accuracy_m: null,
                    city: resolved.city,
                    country: resolved.country,
                    country_code: resolved.country_code,
                    isFallback: true,
                    source: 'contact_details',
                    lastUpdatedAt: new Date().toISOString(),
                  }));
                }
              });
            }
            reject(err);
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
        );
      }),
    [persistToServer, user?.address],
  );

  const forget = useCallback(async () => {
    saveCached(null);
    setState((s) => ({
      ...s,
      coords: null,
      accuracy_m: null,
      city: null,
      country: null,
      country_code: null,
      lastUpdatedAt: null,
      isFallback: false,
      source: null,
    }));
    try {
      await api.patchMe({ home_location: null });
    } catch {
      /* ignore */
    }
  }, []);

  const shouldPrompt = useCallback(() => {
    if (!state.available) return false;
    if (state.coords) return false;
    if (state.permissionState === 'denied') return false;
    try {
      return !localStorage.getItem(PROMPT_FLAG_KEY);
    } catch {
      return true;
    }
  }, [state.available, state.coords, state.permissionState]);

  const dismissPrompt = useCallback(() => {
    try {
      localStorage.setItem(PROMPT_FLAG_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ ...state, request, forget, shouldPrompt, dismissPrompt }),
    [state, request, forget, shouldPrompt, dismissPrompt],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocation must be used within <LocationProvider>');
  }
  return ctx;
}
