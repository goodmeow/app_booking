# 360 Scheduler Reconstruction TODO

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
- [x] Document proposed Android WebView, RGB LED, and NFC integration boundary. *(Hipotesis WebView dibantah 2026-10-21: APK asli React Native tanpa WebView; lihat `docs/reconstruction/tablet-integration-notes.md` dan `production-defects.md`.)*

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

- [x] Allow arbitrary email domains; make explicit account `type` authoritative for users and rooms.
- [x] Add normalized case-insensitive email uniqueness and keep optional username separate from email.
- [x] Migrate organizer/attendee identity toward UUID/type references; keep external visitor email separate.
- [x] Parameterize SQL, including event array payload construction.
- [x] Require strong `JWT_SECRET`.
- [x] Restrict signup role assignment.
- [x] Add missing admin guards.
- [x] Authenticate Socket.io and restrict rooms.
- [x] Derive personal-schedule identity only from the authenticated principal; ignore or reject caller-selected user identities.
- [x] Resolve selected-room filters only to active accounts with explicit `type=room`.
- [x] Let authenticated users query every occupied slot for a selected room while applying server-side privacy projection to bookings owned by others.
- [x] Limit other-user booking projections to organizer first name, start/end time, and minimal capability metadata; never expose subject, description, email, attendees, or check-in data.
- [x] Authorize event details and every mutation (update, attendee add/delete, cancel, early finish) from stored organizer/participant/admin relationships, never organizer identity supplied in the payload; return `403` otherwise.
- [x] Make Socket.io emit invalidations or the same safe projection as HTTP responses, never full private event payloads.
- [x] Test privacy projections, forbidden fields, unauthorized detail access, and guessed event IDs across API and Socket.io payloads.
- [x] Apply CORS allowlist.
- [x] Prevent password fields leaving database/API.
- [x] Repair HTTPS startup.
- [x] Replace raw SQL/result/payload logs with structured allowlisted logging; redact emails, UUIDs, meeting content, and attendee data.
- [x] Add safe request telemetry: timestamp, severity, status, duration, and correlation ID.
- [x] Remove `shell: true` from development child-process launches and pass argument arrays directly.
- [x] Limit nodemon watch paths to server/config sources to prevent startup restarts.
- [x] Upgrade dependency chain still using deprecated `util._extend`.
- [x] Split `server/routes/index.js` into repository, service, controller, and route modules while preserving regression parity.
- [x] Archive or guard `scripts/reconstruct-server.mjs` so it cannot overwrite post-recovery fixes.
- [x] Support continuous overnight/multi-day bookings with a configurable maximum duration; use half-open overlap checks for create, update, room availability, and visible-range queries; protect concurrent room bookings.
- [x] Define one timezone policy and enforce temporal invariants, check-in/early-finish windows, cross-week listing, and clipped report durations for continuous multi-day meetings.
- [x] Add recurrence series identity and occurrence data contracts with explicit supported cadences and deterministic generation through recurrence end date.
- [x] Create recurring occurrences transactionally: validate every room collision and roll back the entire series when any occurrence fails.
- [x] Define timezone-safe edit/cancel semantics for one occurrence, this-and-future occurrences, and the full series.
- [x] Add bounded recurrence safety limits and testable contracts for generation, collision, rollback, mutation scope, and authorization.

Phase 9 log-review evidence (2026-07-13): demo completed without runtime failures; two event creations succeeded, including empty-description normalization. Review found SQL interpolation risk, sensitive-data logging, unsafe shell spawning, broad nodemon watching, missing request telemetry, and one deprecated dependency path.

Phase 9 complete: identity and authorization are server-authoritative, unrelated room bookings use a privacy-safe busy projection, Socket.io is authenticated, runtime and dependency paths are hardened, and atomic multi-day/daily/weekly scheduling passes collision, rollback, DST, mutation-scope, and report-boundary regression gates.

## Phase 10 — Product experience

### Phase 10A — Kiosk foundation

- [x] Add dedicated `/kiosk` display and `/kiosk/setup` provisioning routes outside the employee web shell.
- [x] Authenticate tablets with active `type=room` credentials and a distinct room-bound kiosk JWT audience.
- [x] Bind HTTP schedule queries and Socket.io subscriptions to the immutable room UUID from the kiosk token.
- [x] Project room bookings as `[nama depan, HH:mm - HH:mm]` without subject, description, email, or attendee leakage.
- [x] Show display-only `AVAILABLE`, `UPCOMING`, `OCCUPIED`, and fail-safe `UNKNOWN` states; active bookings become red without check-in.
- [x] Persist room assignment locally while allowing deliberate reprovisioning through the setup route or hold gesture.
- [x] Standardize local defaults on frontend port `8081` and API/Socket.io port `9091` with deterministic disposable demo credentials.
- [x] Cover kiosk session, state transitions, API isolation, cross-room authorization, room revocation, and Socket.io boundaries.
- [x] Add managed device pairing, rotating refresh credentials/version revocation, and an admin device inventory.
- [x] Scope event invalidations to affected Socket.io user/room channels instead of broadcasting a data-free global refresh signal.
- [x] Add independent per-device NFC and LED visibility toggles in Apps Management; keep both disabled by default.
- [ ] Implement the native tablet bridge for NFC and LEDs when hardware integration resumes; keep controls hidden until then.

Phase 10A software complete: a provisioned tablet is cryptographically bound to one room, rotates short-lived access credentials, can be inventoried, revoked, and assigned NFC/LED visibility per device, receives privacy-safe scoped realtime updates, and switches directly to red `OCCUPIED` for active bookings. Native hardware integration remains explicitly deferred.

### Phase 10B — Scheduler UX and rebrand

- [x] Adopt canonical `360 Scheduler` brand with `Meeting & Room Scheduler` descriptor.
- [x] Use `Meeting` consistently in UI; keep `Event` internal to code/API.
- [x] Standardize user-facing language and validation copy.
  - [x] Use English as the default language and Indonesian as the second built-in language.
  - [x] Move user-facing copy to semantic parameter keys and add a Crowdin locale workflow for additional languages.
- [x] Add visible Calendar navigation plus Today, previous, next, Week, Day, and Agenda controls.
- [x] Show meeting time and use mobile-friendly Day/Agenda views.
- [x] Add explicit `Jadwal Saya` and `Jadwal Ruangan` modes with onboarding hints.
- [x] Guide meeting creation with required fields, inline validation, duration, timezone, and room availability/conflict feedback.
- [x] Let novice users choose clearly between one continuous multi-day booking and a repeated meeting schedule.
- [x] Provide recurrence cadence/end controls, plain-language summary, and pre-save occurrence/conflict feedback.
- [x] Show multi-day continuation and recurring-series cues in Calendar plus readable Day/Agenda behavior on mobile.
- [x] Render each occupied room block/balloon exactly as `[nama depan, HH:mm - HH:mm]` using 24-hour local time.
- [x] Keep clicks on privacy-projected bookings safe: show no details and never request or reveal restricted fields.
- [x] Add dates and continuation cues to cross-midnight/multi-day labels so occupied intervals remain unambiguous.
- [x] Make edit/cancel scope explicit: this occurrence, this and future, or all occurrences.
- [x] Confirm meeting deletion and explain read-only state.
- [x] Add retryable resource errors, non-blocking refresh, and not-found route.
- [x] Replace mobile navbar overflow with a drawer and simplify admin navigation.
- [x] Rework admin tables for mobile; hide technical IDs and use Users/Rooms/Access Cards tabs.
- [ ] Run usability tests with five first-time users covering create, edit, and cancel workflows.

## Phase 11 — Finalize

- [ ] Clean client/server builds.
- [ ] Unit, contract, integration, and smoke tests.
- [ ] Cover cross-midnight, cross-week, containing-overlap, adjacent-slot, report-boundary, timezone, and concurrent multi-day booking cases.
- [ ] Add `npm run verify` covering required build, test, lint, and smoke gates.
- [ ] Add CI, lint/format enforcement, and pinned Node/package-manager runtime versions.
- [ ] Add `docs/handover/START-HERE.md` and rewrite README/quickstart against current commands and layout.
- [ ] Document current architecture and UI-to-API-to-DB-to-Socket.io sequence diagrams.
- [ ] Document business processes: auth/roles, user/room lifecycle, meeting create/edit/cancel, collision, check-in/early-finish, and reports.
- [ ] Publish current API reference plus ERD and stored-function contracts.
- [ ] Add executable scenario catalog with sanitized demo accounts and request examples.
- [ ] Add contribution, code ownership, and deployment/operations runbook.
- [ ] Tag reconstructed baseline.

## Phase 12 — Hardware (NFC, akses pintu, LED)

Rencana lengkap + gap matrix: `docs/reconstruction/hardware-readiness-audit.md`.
Protokol perangkat: `nauchara/hardware/` (APK, LED, relay).

- [x] Samakan state kiosk dengan perangkat: kuning bila meeting aktif belum check-in, merah bila sudah, hijau bila kosong.
- [x] Palet kuning/merah/hijau sesuai perangkat; jendela “akan mulai” dihapus (state hanya dari meeting aktif).
- [x] Hubungkan `checkInKioskMeeting` ke UI (dialog kartu), tampilkan hasil dan error. Pemicu NFC menyusul di Phase 12 bridge.
- [ ] Normalisasi nomor kartu (`parseInt` UID 4 byte dibalik) dan uji dengan kartu nyata.
- [x] Tampilkan state `OFFLINE` eksplisit saat jadwal gagal dimuat (bukan “Available”).
- [x] LED aktif secara default untuk perangkat baru (`010_kiosk_led_default.sql`).
- [ ] Tambah endpoint kiosk untuk membuka pintu (token kiosk, terikat room, rate-limit); relay tetap ditulis tablet.
- [ ] Petakan state ke kode LED (`0x05`, `0x14`, `0x04`) hanya bila `ledEnabled`.
- [ ] Bangun APK kiosk React Native + modul native NFC/relay/sysfs dengan whitelist perintah.
- [ ] Simpan `@ipServer`/sesi di penyimpanan native; sediakan layar first-run.
- [x] Putuskan runtime kiosk: **React Native**, karena WebView tablet hanya Chrome 64 (Vite 8/MUI 5 tidak kompatibel). Web `/kiosk` tetap sebagai referensi.
- [ ] Uji perangkat: matriks state, check-in, buka pintu, LED, offline, reboot.
