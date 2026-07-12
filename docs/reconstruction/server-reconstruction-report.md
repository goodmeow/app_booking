# Server reconstruction report

Phase 4 restores executable server source from immutable readable Webpack baseline.

## Recovered source

- `config/config.js`: environment and runtime configuration.
- `server/server.js`: HTTP(S), Socket.io, API mount, errors, listener.
- `server/express.js`: request middleware.
- `server/routes/index.js`: mechanically recovered compatibility core containing legacy schema/model adapter, models, helpers, controllers, and routers. Original module boundary comments remain embedded for later safe splitting.
- `server/socket/`: active room-join behavior and connection lifecycle.

`scripts/reconstruct-server.mjs` regenerates compatibility core from exact markers in baseline bundle. It normalizes Webpack external names and appends an ES module export. This avoids manual business-logic transcription before API parity tests exist.

## Verification

- Node syntax checks pass.
- Webpack production build passes.
- Normal builds write to `build/`; `npm run build:server:check` writes to `/tmp/360booking-server-build`. Baseline `dist/` remains read-only oracle.
- `start:server` and `start:client` launch reconstructed artifacts from `build/`, never baseline `dist/`.
- Server bundle uses `.cjs`, so it runs correctly beneath root package `"type": "module"` even before packaging metadata is generated.
- Public `GET /api/auth/signout`: HTTP 200 with recovered payload.
- Guarded `GET /api/users` without token: HTTP 401 with recovered error shape.
- Authenticated `GET /api/rooms`: HTTP 200; custom model layer calls `room_list` in PostgreSQL and returns three sanitized fixture rooms.

## Parity choices

- Legacy SQL interpolation and validation bugs remain unchanged.
- JWT fallback remains unchanged until security hardening.
- Unrestricted HTTP/Socket CORS remains unchanged.
- Socket authentication remains absent.
- HTTPS uses synchronous certificate loading from `node:fs`; this repairs a mechanically invalid bundle import while preserving certificate paths and server behavior.
- Inactive hard-coded socket event prototypes were not restored; active runtime only listens for `room:join`, matching bundle registration.

## Next boundary

Phase 5 must add automated API and Socket.io contract tests before splitting `server/routes/index.js` back into individual model/controller/route files. Mechanical module comments preserve original boundaries for that refactor.
