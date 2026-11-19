import { TextDecoder as UtilTextDecoder, TextEncoder as UtilTextEncoder } from 'util';
import {
  createApiClient,
  closet,
  streamNdjson,
} from '@dressapp/api-client';
import { client as singletonClient } from '@dressapp/api-client/src/_singleton.js';

if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = UtilTextDecoder;
}
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = UtilTextEncoder;
}

describe('@dressapp/api-client browser cookie & CSRF protections', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    document.cookie = 'dressapp_csrf=test-csrf-abc; path=/';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    document.cookie = 'dressapp_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    jest.restoreAllMocks();
  });

  test('createApiClient preserves withCredentials and attaches X-CSRF-Token on unsafe methods after _setSingleton', async () => {
    const { client } = createApiClient({
      getToken: () => null,
      setToken: () => {},
      clearToken: () => {},
    });

    expect(client.defaults.withCredentials).toBe(true);
    expect(singletonClient.defaults.withCredentials).toBe(true);

    for (const targetClient of [client, singletonClient]) {
      const handler = targetClient.interceptors.request.handlers.find((h) => h && h.fulfilled);
      expect(handler).toBeDefined();

      for (const method of ['post', 'patch', 'delete']) {
        const cfg = await handler.fulfilled({ method, headers: {} });
        expect(cfg.headers['X-CSRF-Token']).toBe('test-csrf-abc');
        expect(cfg.headers.Authorization).toBeUndefined();
      }

      const getCfg = await handler.fulfilled({ method: 'get', headers: {} });
      expect(getCfg.headers['X-CSRF-Token']).toBeUndefined();
    }
  });

  test('closet.analyzeItemImage sends credentials: include and X-CSRF-Token header on POST', async () => {
    createApiClient({
      getToken: () => null,
      setToken: () => {},
      clearToken: () => {},
    });

    const encoder = new TextEncoder();
    const ndjsonPayload = [
      JSON.stringify({ type: 'item', index: 0, category: 'outerwear', item_type: 'hoodie' }),
      JSON.stringify({ type: 'done', count: 1 }),
    ].join('\n') + '\n';

    const readMock = jest
      .fn()
      .mockResolvedValueOnce({ value: encoder.encode(ndjsonPayload), done: false })
      .mockResolvedValueOnce({ value: undefined, done: true });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: readMock,
          releaseLock: jest.fn(),
        }),
      },
    });

    const onItem = jest.fn();
    const onDone = jest.fn();

    const result = await closet.analyzeItemImage(
      { image_base64: 'abc' },
      { onItem, onDone }
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/closet\/analyze$/);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers['X-CSRF-Token']).toBe('test-csrf-abc');
    expect(init.headers.Authorization).toBeUndefined();
    expect(onItem).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.count).toBe(1);
  });

  test('streamNdjson sends credentials: include and X-CSRF-Token on POST', async () => {
    createApiClient({
      getToken: () => null,
      setToken: () => {},
      clearToken: () => {},
    });

    const encoder = new TextEncoder();
    const readMock = jest
      .fn()
      .mockResolvedValueOnce({
        value: encoder.encode(`${JSON.stringify({ type: 'done', repaired: 2 })}\n`),
        done: false,
      })
      .mockResolvedValueOnce({ value: undefined, done: true });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          read: readMock,
          releaseLock: jest.fn(),
        }),
      },
    });

    const last = await streamNdjson('/closet/repair-hashes', { method: 'POST' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/closet\/repair-hashes$/);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(init.headers['X-CSRF-Token']).toBe('test-csrf-abc');
    expect(last).toEqual({ type: 'done', repaired: 2 });
  });
});
