# 360Booking Reconstruction TODO

## Phase 1 — Preserve baseline

- [x] Initialize Git repository.
- [x] Preserve `dist/` as behavioral reference.
- [x] Record SHA-256 checksums for every dist artifact.
- [x] Add `.gitignore` for secrets, dependencies, logs, and local files.
- [x] Add sanitized `.env.example`.
- [x] Record runtime and dependency baseline.
- [x] Document `JWT_SECRET_KEY` versus `JWT_SECRET` mismatch.
- [x] Verify checksums.
- [x] Review baseline; ensure `.env` and `node_modules/` excluded.
- [x] Create initial baseline commit.

## Phase 2 — Extract specification

- [ ] Extract backend module map from `server.bundle.js`.
- [ ] Document endpoints, middleware, payloads, statuses, and errors.
- [ ] Map controllers to PostgreSQL functions.
- [ ] Document Socket.io rooms, events, and payloads.
- [ ] Extract frontend routes, screens, Redux state, and API calls.
- [ ] Build screen-action-endpoint matrix.

## Phase 3 — Reconstruct database

- [ ] Validate clean import of `bjb.sql`.
- [ ] Document tables, constraints, and relations.
- [ ] Test stored functions.
- [ ] Convert dump into ordered migrations.
- [ ] Add sanitized minimum seed data.

## Phase 4 — Reconstruct server

- [ ] Restore config and startup flow.
- [ ] Restore PostgreSQL pool and compatibility model layer.
- [ ] Restore Express middleware and error handling.
- [ ] Restore auth, users, rooms, events, settings, card master, and door-open.
- [ ] Restore Socket.io behavior.

## Phase 5 — Verify server parity

- [ ] Build API contract tests.
- [ ] Compare old bundle and reconstructed server responses.
- [ ] Test database mutations, authorization, and Socket.io behavior.
- [ ] Publish parity report.

## Phase 6 — Reconstruct client foundation

- [ ] Restore Vite and React entrypoints.
- [ ] Restore router, Redux store, API layer, and auth persistence.
- [ ] Restore theme, layout, navigation, and Socket.io client.

## Phase 7 — Reconstruct screens

- [ ] Signin and signup.
- [ ] Dashboard and calendar.
- [ ] Event create, edit, detail, delete, attendees, and check-in.
- [ ] User and room management.
- [ ] Room usage report.
- [ ] App settings and card master.

## Phase 8 — Verify client parity

- [ ] Compare routes, network payloads, validation, and permissions.
- [ ] Compare calendar and realtime behavior.
- [ ] Compare responsive layout and reports.

## Phase 9 — Security hardening

- [ ] Parameterize SQL.
- [ ] Require strong `JWT_SECRET`.
- [ ] Restrict signup role assignment.
- [ ] Add missing admin guards.
- [ ] Authenticate Socket.io and restrict rooms.
- [ ] Apply CORS allowlist.
- [ ] Prevent password fields leaving database/API.
- [ ] Repair HTTPS startup.

## Phase 10 — Finalize

- [ ] Clean client/server builds.
- [ ] Unit, contract, integration, and smoke tests.
- [ ] Current README, API docs, architecture notes, and deployment guide.
- [ ] Tag reconstructed baseline.
