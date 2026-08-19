# @dressapp/api-client

Shared API client for DressApp. Platform-agnostic — runs on both web (webpack) and mobile (Metro/Hermes).

## Architecture

- **`src/client.js`**: `createApiClient(adapters)` factory — call once at startup with platform-specific storage/navigation adapters
- **`src/_singleton.js`**: internal shared state (client instance, tokenStore, userStore) that all domain modules close over
- **Domain modules**: `auth.js`, `closet.js`, `listings.js`, etc. — each exports a plain object of API functions
- **`src/streamNdjson.js`**: web streaming (ReadableStream)
- **`src/streamNdjson.native.js`**: mobile polling fallback (Metro picks this automatically via `.native.js` extension)

## Usage

### Web (`apps/web`)
```js
// apps/web/src/lib/api/index.js (thin adapter)
import { createApiClient, buildApi } from '@dressapp/api-client';
const { client } = createApiClient({ ...localStorage adapters... });
export const api = buildApi();
```

### Mobile (`apps/mobile`)
```ts
// apps/mobile/src/lib/api.ts (thin adapter)
import { createApiClient, buildApi } from '@dressapp/api-client';
const { client } = createApiClient({ ...SecureStore/AsyncStorage adapters... });
export const api = buildApi();
```

## NDJSON Streaming

On web: `ReadableStream.getReader()` progressive streaming  
On mobile: Metro automatically selects `streamNdjson.native.js` — issues a standard POST and emits all events at once from the completed response.

For real-time Stylist streaming on mobile, a WebSocket implementation will be added in Phase 4.
