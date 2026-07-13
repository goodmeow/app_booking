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

- [x] Extract backend module map from `server.bundle.js`.
- [x] Document endpoints, middleware, payloads, statuses, and errors.
- [x] Map controllers to PostgreSQL functions.
- [x] Document Socket.io rooms, events, and payloads.
- [x] Extract frontend routes, screens, Redux state, and API calls.
- [x] Build screen-action-endpoint matrix.
- [x] Document proposed Android WebView, RGB LED, and NFC integration boundary.

## Phase 3 — Reconstruct database

- [x] Prepare database migration, seed, and test structure.
- [x] Add dedicated test environment template and safety notes.
- [x] Check local PostgreSQL/container prerequisites.
- [x] Install PostgreSQL 14 or container runtime.
- [x] Validate clean import of `bjb.sql`.
- [x] Document tables, constraints, and relations.
- [x] Test stored functions.
- [x] Convert dump into ordered migrations.
- [x] Add sanitized minimum seed data.

Phase 3 complete: disposable database rebuilds from migrations and passes all SQL suites.

## Phase 4 — Reconstruct server

- [x] Restore config and startup flow.
- [x] Restore PostgreSQL pool and compatibility model layer.
- [x] Restore Express middleware and error handling.
- [x] Restore auth, users, rooms, events, settings, card master, and door-open.
- [x] Restore Socket.io behavior.

Phase 4 complete: source builds and authenticated API reaches reconstructed PostgreSQL.

## Phase 5 — Verify server parity

- [x] Prepare differential child-process harness and deterministic fixtures.
- [x] Prepare serial parity database reset and Socket.io test plan.
- [x] Build API contract tests.
- [x] Compare old bundle and reconstructed server responses.
- [x] Test database mutations, authorization, and Socket.io behavior.
- [x] Publish parity report.

Phase 5 complete: legacy/reconstructed differential suite passes 12/12 tests across all 32 route boundaries and representative deep contracts.

## Phase 6 — Reconstruct client foundation

- [x] Restore Vite and React entrypoints.
- [x] Restore router, Redux store, API layer, and auth persistence.
- [x] Restore theme, layout, navigation, and Socket.io client.

Phase 6 complete: production build and all recovered SPA route fallbacks pass.

## Phase 7 — Reconstruct screens

- [x] Publish implementation slices, evidence gates, and acceptance checks.
- [x] Add shared dialogs, validation/payload helpers, and confirmed missing service contracts.
- [x] Finish signin and signup visual/behavioral parity.
- [x] Rebuild card master, user, and room management.
- [x] Rebuild user profile and self-service actions.
- [x] Rebuild room usage report and XLSX export.
- [x] Rebuild calendar, room finder, filters, and realtime refresh.
- [x] Rebuild event create, edit, detail, cancel, and attendee workflows.
- [x] Pass Phase 7 production build and route/workflow smoke checks.

Phase 7 complete: all recovered web screens build, contract helpers pass, and public/protected/admin route plus lazy-chunk smoke checks pass. Settings remains a recovered latent capability excluded from visible UI pending evidence; tablet check-in/NFC/LED remains outside the recovered web-client scope.

## Phase 8 — Verify client parity

- [x] Compare routes, network payloads, validation, and permissions.
- [x] Compare calendar and realtime behavior.
- [x] Compare responsive layout and reports.

Phase 8 complete: active route/network mismatches are corrected, calendar and Socket.io behavior plus XLSX contracts have regression coverage, and responsive/validation compatibility repairs are recorded in `docs/reconstruction/client-parity-report.md`. Pixel-level screenshot parity remains unclaimed because no sanitized legacy captures or browser engine are available in the repository environment.

## Phase 9 — Security and identity hardening

- [ ] Allow arbitrary email domains; make explicit account `type` authoritative for users and rooms.
- [ ] Add normalized case-insensitive email uniqueness and keep optional username separate from email.
- [ ] Migrate organizer/attendee identity toward UUID/type references; keep external visitor email separate.
- [ ] Parameterize SQL, including event array payload construction.
- [ ] Require strong `JWT_SECRET`.
- [ ] Restrict signup role assignment.
- [ ] Add missing admin guards.
- [ ] Authenticate Socket.io and restrict rooms.
- [ ] Apply CORS allowlist.
- [ ] Prevent password fields leaving database/API.
- [ ] Repair HTTPS startup.
- [ ] Replace raw SQL/result/payload logs with structured allowlisted logging; redact emails, UUIDs, meeting content, and attendee data.
- [ ] Add safe request telemetry: timestamp, severity, status, duration, and correlation ID.
- [ ] Remove `shell: true` from development child-process launches and pass argument arrays directly.
- [ ] Limit nodemon watch paths to server/config sources to prevent startup restarts.
- [ ] Upgrade dependency chain still using deprecated `util._extend`.

Phase 9 log-review evidence (2026-07-13): demo completed without runtime failures; two event creations succeeded, including empty-description normalization. Review found SQL interpolation risk, sensitive-data logging, unsafe shell spawning, broad nodemon watching, missing request telemetry, and one deprecated dependency path.

## Phase 10 — Product UX and rebrand

- [ ] Adopt canonical `360 Scheduler` brand with `Meeting & Room Scheduler` descriptor.
- [ ] Use `Meeting` consistently in UI; keep `Event` internal to code/API.
- [ ] Standardize user-facing language and validation copy.
- [ ] Add visible Calendar navigation plus Today, previous, next, Week, Day, and Agenda controls.
- [ ] Show meeting time and use mobile-friendly Day/Agenda views.
- [ ] Add explicit `Jadwal Saya` and `Jadwal Ruangan` modes with onboarding hints.
- [ ] Guide meeting creation with required fields, inline validation, duration, timezone, and room availability/conflict feedback.
- [ ] Confirm meeting deletion and explain read-only state.
- [ ] Add retryable resource errors, non-blocking refresh, and not-found route.
- [ ] Replace mobile navbar overflow with a drawer and simplify admin navigation.
- [ ] Rework admin tables for mobile; hide technical IDs and use Users/Rooms/Access Cards tabs.
- [ ] Run usability tests with five first-time users covering create, edit, and cancel workflows.

## Phase 11 — Finalize

- [ ] Clean client/server builds.
- [ ] Unit, contract, integration, and smoke tests.
- [ ] Current README, API docs, architecture notes, and deployment guide.
- [ ] Tag reconstructed baseline.
