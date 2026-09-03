/**
 * packages/api-client/src/streaming.js
 *
 * Re-exports streamNdjson for backward compatibility with internal
 * modules (closet.js, etc.) that import from './streaming.js'.
 *
 * Metro will pick streamNdjson.native.js on React Native targets,
 * and streamNdjson.js on web.
 */
export { streamNdjson } from './streamNdjson.js';
