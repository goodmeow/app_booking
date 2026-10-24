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
- [x] Implement the native tablet bridge for NFC and LEDs (selesai di kioskapp:
  `KioskHardwareModule` — `setLed`, `startNfc/stopNfc`, `connectSerial`,
  `writeHex`, `getStatus`; diuji di tablet: LED 0x05/0x14/0x04/0x06, tap kartu).

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
- [x] Add `npm run verify` (build client + build server /tmp + test client +
  unit server). Lint belum ada tooling; smoke manual via demo.
- [x] Add CI (`.github/workflows/ci.yml`) + pin Node via `.nvmrc` (20).
  Lint/format enforcement BELUM (belum ada eslint/prettier config).
- [x] Add `docs/handover/START-HERE.md` + README/quickstart sudah sesuai
  perintah dan layout sekarang.
- [x] Document current architecture and UI-to-API-to-DB-to-Socket.io sequence diagrams.
  Bukti: `docs/architecture.md` (komponen, alur login/create/check-in,
  invalidasi Socket.io, zona waktu, privasi, dev vs prod).
- [x] Document business processes: auth/roles, user/room lifecycle, meeting create/edit/cancel, collision, check-in/early-finish, and reports.
  Bukti: `docs/business-processes.md` (termasuk aturan lantai, rekurensi,
  instant/book kiosk, auto-release no-show).
- [x] Publish current API reference plus ERD and stored-function contracts.
  Bukti: `docs/api-reference.md` + `docs/erd.md`; kontrak 28 fungsi legacy
  dicatat sebagai tidak dipanggil server saat ini.
- [x] Add executable scenario catalog with sanitized demo accounts and request examples.
  Bukti: `docs/scenarios.md` (curl + langkah UI, akun demo tersanitasi).
- [x] Add contribution, code ownership, and deployment/operations runbook.
  Bukti: `docs/operations-runbook.md` (deploy/HTTPS/CORS, restart, pemulihan
  reboot, backup/monitoring rekomendasi, re-pair tablet, rotasi JWT,
  kontribusi & kepemilikan area).
- [ ] Tag reconstructed baseline.

## Phase 12 — Hardware (NFC, akses pintu, LED)

Rencana lengkap + gap matrix: `docs/reconstruction/hardware-readiness-audit.md`.
Protokol perangkat: `nauchara/hardware/` (APK, LED, relay).

- [x] Samakan state kiosk dengan perangkat: kuning bila meeting aktif belum check-in, merah bila sudah, hijau bila kosong.
- [x] Palet kuning/merah/hijau sesuai perangkat; jendela “akan mulai” dihapus (state hanya dari meeting aktif).
- [x] Hubungkan `checkInKioskMeeting` ke UI (dialog kartu), tampilkan hasil dan error. Pemicu NFC menyusul di Phase 12 bridge.
- [x] Normalisasi nomor kartu (`parseInt` UID 4 byte dibalik) dan uji dengan
  kartu nyata: 3 kartu 4-byte -> `<card-1>`, `<card-2>`, `<card-3>`,
  semua booking 200. Kartu 7-byte belum tersedia (lihat catatan uji NFC).
- [x] Tampilkan state `OFFLINE` eksplisit saat jadwal gagal dimuat (bukan “Available”).
- [x] LED aktif secara default untuk perangkat baru (`010_kiosk_led_default.sql`).
- [x] Tambah endpoint kiosk untuk membuka pintu (token kiosk, terikat room, rate-limit); relay tetap ditulis tablet.
- [x] Izinkan kartu karyawan membuka pintu (bukan hanya kartu master), sesuai keputusan produk.
- [x] Halaman masuk CMS sesuai desain (logo The Prasada, alert gagal, tetap-masuk) dengan font Inter di-self-host.
- [x] Endpoint kiosk untuk desain tablet ruang meeting: `POST /api/kiosk/events/extend` (+15 menit), `POST /api/kiosk/events/complete` (Selesai), `POST /api/kiosk/events/instant` (Pesan sekarang, wajib kartu karyawan).
- [x] Petakan state ke kode LED (`0x05`, `0x14`, `0x04`, `0x06` offline) hanya
  bila `ledEnabled` — `src/theme/palette.ts` + `KioskDisplay.writeLed`.
  Aktif hanya saat `device.ledEnabled` dan status fresh/terhubung.
- [x] Bangun APK kiosk React Native + modul native NFC/relay/sysfs (APK 1.3
  code 11; modul `KioskHardwareModule` dengan 8 method, tanpa shell bebas).
- [x] Simpan sesi/server di penyimpanan native (AsyncStorage `@kiosk/session`,
  `@kiosk/server`) + layar first-run provisioning (KioskSetup).
- [x] Putuskan runtime kiosk: **React Native**, karena WebView tablet hanya Chrome 64 (Vite 8/MUI 5 tidak kompatibel). Web `/kiosk` tetap sebagai referensi.
- [ ] Uji perangkat: matriks state, check-in, buka pintu, LED, offline, reboot.
  Sudah: state (tersedia/terpakai/menunggu), check-in, offline+pulih, LED,
  pick time, 3 kartu NFC. Belum: buka pintu (relay belum ada), reboot,
  autostart/kiosk lock.

## Sisa pending 2026-10-21

Hasil sesi hari ini (kioskapp + CMS). Detail di
`docs/reconstruction/hardware-readiness-audit.md` dan
`nauchara/hardware/KIOSKAPP-RN.md`.

- [ ] Beli modul relay USB (LCUS-1/CH340 serial, atau relay HID + dukungan native HID).
- [ ] Verifikasi relay fisik CH340: enumerasi USB, 9600 8N1, polaritas,
  izin USB setelah reboot, frame `A00101A2` / `A00100A1` (tombol Buka Pintu
  baru muncul kalau modul terdeteksi).
- [ ] Uji NFC dengan beberapa tipe kartu (UID 4 byte vs 7 byte) dan
  klik ganda pembacaan tag.
- [x] "Lupa kata sandi?" menampilkan kontak helpdesk@integrasolution.id (mailto); alur reset otomatis tetap belum ada.
- [x] Tautan "Buat akun" di halaman masuk dihapus (akun dibuat lewat Manajemen).
- [x] Kapasitas ruangan bisa diubah dari tab Ruangan; kiosk menampilkannya (diuji: 10 orang).
- [x] Web kiosk `/kiosk` memakai font tablet (Public Sans + Source Serif 4, self-host).
- [x] Batas pairing: 1 tablet aktif per ruangan; pairing ulang wajib mencabut perangkat lama di CMS.
- [x] Ganti jalur tablet dev dari `adb reverse` ke LAN satu segment:
  portproxy Windows `<ip-server>:5100 -> 127.0.0.1:5100` (WSL forwarder
  ke API 9091), firewall rule TCP 5100, IP statis tablet di Settings
  Ethernet (tahan reboot), dan APK memakai `network_security_config.xml`
  tanpa daftar IP (URL diketik saat provisioning). HTTPS server siap;
  CA self-signed dipercaya lewat anchor user (commit kioskapp
  `4e93105`..`954bb4a`).
- [ ] Autostart saat boot + kiosk lock (device owner) untuk tablet.
- [ ] `GET /api/users` masih bisa dibaca semua user login (paritas produksi);
  perlu keputusan produk untuk membatasi.

## Pemulihan setelah restart PC 2026-10-23

- [x] `npm run demo:resume` (baru): lanjutkan demo tanpa reset DB agar tablet
  tidak perlu pairing ulang; fallback `docker-compose` untuk mesin lama.
- [x] CMS dipindah ke **8082** via `.env.local` karena 8081 diambil proses lain
  (xerj); portproxy + firewall 8082 ditambahkan.
- [x] Setelah reboot portproxy tidak ter-bind dan profil Ethernet kembali
  **Public** (inbound diblokir). Diperbaiki: delete+add portproxy, set profile
  Private + rule subnet. Cara lengkap dicatat di README.
- [x] Terverifikasi: tablet pulih Online sendiri (poll `/context 200` tiap 20 dtk)
  dan tetap terhubung setelah adb dimatikan.

## Code review 2026-10-24

- [x] Patch English-only diterapkan (kode/komentar/pesan server/skrip),
  UI locale & docs tetap. Konflik dengan refactor diselesaikan manual.
- [x] Refactor komponen CMS: UserManagementSection 498->245, Room 253->210,
  Signin 299->272, UserProfile 285->223 (modul columns/dialog/hook).
- [x] Refactor kiosk: App.tsx 1254->76 baris, UI/API/hook/i18n/theme ke `src/`.
- [x] Konstanta waktu & rate limit bernama; deviceStatus(); SQL multi-baris;
  onClick jadi handler bernama.
- [ ] Sisa: KioskDisplay.tsx masih ~800 baris (ekstrak overlay), lint/format
  belum ada tooling, komponen lain <300 baris sudah wajar.

## Pembersihan demo 2026-10-24

- [x] Data demo dirapikan: user sisa test `card.officer@example.test` dihapus;
  event/device sisa uji ternyata sudah hilang oleh reset parity DB. Kondisi
  akhir: 9 akun inti, 3 kartu, 1 device aktif (online), event seed 2030 utuh,
  tablet AVAILABLE/Online v1.3 (11).
- [x] **Risiko (selesai 2026-10-24):** `database/scripts/reset-parity-db.sh`
  dulu me-reset database yang SAMA dengan demo
  (`360booking_reconstruction_test`) — satu kali parity/regression run
  menghapus akun demo, kartu, dan pairing tablet. Sekarang suite parity/
  regression memakai database terpisah `360booking_parity_test` (dibuat dan
  di-reset `reset-parity-db.sh` lewat `createdb` di container yang sama), dan
  kedua skrip reset punya guard yang menolak nama DB demo. Bukti: 9 akun, 1
  kartu, 1 device aktif tetap utuh setelah `test:server:parity` dijalankan.

## Regresi pasca-refactor 2026-10-24

- [x] `npm run test:server:regression` **59/59 lulus** (136 dtk), termasuk 7
  test baru `/api/kiosk/events/book`.
- [x] Dua bug test ditemukan QA dan diperbaiki: range kiosk memakai `YYYYMMDD`
  (bukan bertanda hubung) dan respons schedule memakai field `start`/`end`;
  skenario "mulai <=2 menit" dipisah dari slot utama (+70 menit).
- [x] Pemulihan setelah reset: `demo:accounts`, pemetaan 3 kartu, re-pair
  tablet (device baru `96e69b4d`, online) — layar AVAILABLE/Online v1.3 (11).
- [x] Gate non-destruktif: verify lulus (client 62/62, unit 42/42).

## Cek end-to-end 2026-10-24

- [x] Suite non-destruktif: `npm run verify` lulus (build client+server,
  client 62/62, unit server 42/42).
- [x] Smoke API: `GET /api/health` 200, `GET /api/users` 200,
  `POST /api/events` 200 (meeting "E2E smoke" 10:00-11:00 besok).
- [x] Tablet pairing ulang setelah DB ter-reset (device baru `b82d910e`),
  `online: true`; layar menampilkan AVAILABLE + jadwal "E2E smoke" 10:00
  (bukti tarikan `/context` + `/schedule` dari server).
- Catatan: DB demo sempat ter-reset oleh `npm run demo` pukul 23:24 sehingga
  akun uji + kartu + pairing hilang; dipulihkan dengan `demo:resume`,
  `demo:accounts`, dan pemetaan ulang kartu (<card-1>, <card-2>,
  <card-3>).
- [ ] Regression suite penuh (destruktif: reset DB + pairing) belum dijalankan
  hari ini; perlu persetujuan sebelum dijadwalkan.

## Uji NFC 2026-10-23

- [x] Tiga kartu karyawan diuji di tablet (APK 1.3 code 11). Semua **UID 4 byte**:
  - kartu 1 -> nomor `<card-1>` (akun `<karyawan-1>`) : booking 30 menit **200**
  - kartu 2 -> UID hex (dibalik) -> nomor `<card-2>` (Karyawan Uji) : **200**
  - kartu 3 -> UID hex `<uid-hex>` -> nomor `<card-3>` (Karyawan Prasada) : **200**
- [x] Kartu tak terdaftar kini menampilkan nomornya di layar
  ("Kartu belum terdaftar: <nomor>") agar bisa langsung didaftarkan admin.
- [x] UID hex hanya ditulis ke logcat bila flag debug ada
  (`touch /sdcard/kiosk-debug-uid`); build normal tidak mencatat kredensial.
- [ ] Kartu **UID 7 byte** (DESFire/Ultralight) belum tersedia untuk diuji;
  kode saat ini memakai 4 byte pertama (paritas APK vendor). Perlu keputusan
  produk bila nanti muncul kartu 7 byte.

## Uji perangkat 2026-10-23 (LAN)

- [x] Tablet online via LAN tanpa USB; check-in dan selesai (finish) berhasil
  dari tablet.
- [x] "Pilih waktu" (pemesanan terjadwal hari ini) berhasil di perangkat:
  slot bentrok -> pesan konflik, slot bebas -> booking terbentuk; APK 1.3 (8).
- [x] Bukti jalur LAN saat adb dimatikan: `Get-NetTCPConnection` port 5100
  menunjukkan koneksi dari IP tablet, dan log server terus menerima
  `/context` + `/schedule` tiap ~20 detik. Cara cek didokumentasikan di
  README (bagian tablet kiosk LAN).
- [x] Cabut/colok kabel LAN: tablet menampilkan state OFFLINE lalu pulih
  otomatis ke Online tanpa interaksi. Log menunjukkan celah polling
  (mis. 12:20:28 -> 12:22:22 = 113 detik) yang langsung berlanjut
  `/context 200` setelah kabel kembali.

## Fitur 2026-10-23 — pemesanan terjadwal dari kiosk

- [x] Server `POST /api/kiosk/events/book` { card_number, start, end }: hanya
  hari ini (APP_TIMEZONE), mulai tidak lewat, durasi 5-240 menit, kartu+lantai
  sama dengan instant, konflik 409, rate limit 30/15mnt; mulai <=2 menit →
  langsung check-in, selain itu `scheduled: true` (check-in menunggu jam).
  Unit test `kiosk-book-slot.test.js`; uji fungsional curl OK, event uji
  dibatalkan lagi.
- [x] UI tablet: tombol "Pilih waktu" + input jam HH:MM (24 jam) + alur
  kartu + i18n ID/EN + APK 1.3 code 7 (kioskapp `c8842a9`). Diuji di tablet:
  slot bentrok menampilkan 409, slot bebas membuat booking 21:00-22:00
  (event uji dibatalkan).
- [ ] Test regresi end-to-end `/events/book` (butuh reset DB → pairing tablet
  hilang; jadwalkan sekali jalan bersama regresi berikutnya).

## Keputusan produk 2026-10-23

- [x] **Selesaikan meeting lebih awal** di kiosk tetap memakai tombol
  "Selesai" + dialog konfirmasi, **tanpa kartu/kartu master**. Alasan:
  akses ruangan sudah dijaga pintu ber-kartu dan kiosk berada di dalam
  ruangan; friksi kartu membuat orang memilih meninggalkan ruangan
  (okupansi jadi lebih buruk). Guardrail server dipertahankan: wajib
  checked-in, hanya dalam jendela start-end, rate limit 60/15 menit,
  token kiosk per ruangan.

## Sanitasi rahasia 2026-10-23

- [x] Kartu NFC nyata dan email pribadi karyawan dihapus dari tree dan RIWAYAT:
  git history ditulis ulang (filter-branch) lalu force push; `bjb.sql`
  dikeluarkan dari semua commit (salinan evidence tetap di
  `nauchara/360Booking/`). Semua author/committer dinormalisasi ke
  `goodmeow <aarunalr@pm.me>`.

## Gelombang Ver 3 Rev 5 — 2026-10-23

- [x] Tablet dan laptop satu segment LAN: portproxy Windows 5100, IP statis
  tablet persisten (Settings), firewall rule; USB tidak lagi dibutuhkan kios.
- [x] APK kios `network_security_config.xml` tanpa daftar IP (URL diisi saat
  provisioning); HTTPS server siap (`HTTPS=true` + `TLS_CERT_PATH`/`KEY`),
  CA self-signed dipercaya lewat anchor user (kioskapp `30195cd`).
- [x] Tablet menampilkan versi `v1.1 (2)` + awalan UUID perangkat di layar;
  CMS drawer/footer menampilkan `CMS v3.5.0`. Skema versioning `Ver.Rev`
  di `docs/VERSIONING.md`; package.json naik `3.5.0`.
- [x] APK distribusi naik repo CMS (`public/apk/kiosk-release.apk`) +
  tombol **Unduh APK Tablet** di halaman Perangkat Tablet (unduh saja).
- [x] Tema CMS disamai tablet: dark `#11151B`, aksen `#3DDC84`/`#2FB46A`,
  Public Sans, AppBar/Menu/DataGrid/surface mengikuti token tema.
- [x] Brand dua kata: logo The Prasada di atas `Room Booking` (header,
  favicon, judul dokumen, locales en/id; icon.svg tak lagi dirujuk).
- [x] `deploy/` Ubuntu 22.04: runbook + 5 skrip (prereqs, provisi DB+migrasi,
  build, install systemd+nginx, admin pertama) + unit systemd + nginx conf.
- [x] `npm run demo` diperbaiki: berikan blok shebang bash yang hilang di
  `rebuild-test-db.sh`; urutan demo→`demo:accounts` didokumentasikan.

## Sisa pending 2026-10-22 (lanjutan review)

- [ ] (stash) Upload string Crowdin (`crowdin upload sources`): string siap en=
  id identik + key baru brand.footer; skip sementara karena butuh kredensial
  project (CROWDIN_PROJECT_ID/TOKEN di shell, bukan repo). CLI sudah terpasang
  (~/bin/crowdin 5.5.0).


- [x] Patch review #4: `npm audit fix` non-breaking dijalankan. Temuan
  22 → 3 (semua high, dev-only): `nodemon@3.1.14` adalah versi terbaru
  dan profil `chokidar<4` yang dilintasinya belum punya perbaikan;
  `--force` hanya akan menurunkan nodemon ke 1.14.10 (regresi) sehingga
  sisa ini diterima. Verifikasi pasca-fix: boot server ok (login 200),
  client 62/62 (23 Okt), unit 42/42 (23 Okt).
- [x] Patch review #5: README ditulis ulang ke state terbaru (URL clone,
  Vite 8, port 8081/9091, output `build/`, HTTPS, `TRUST_PROXY`, jalur
  LAN tablet). Lihat commit `63ff397`.

## Aturan lantai (2026-10-22)

- [x] Karyawan hanya bisa memesan ruangan di lantai kerjanya
  (`tbl_users.floor`), admin bebas. Ditegakkan di server (403
  `FLOOR_RESTRICTED` / `FLOOR_REQUIRED`), UI kalender, dan "Pesan sekarang"
  di kiosk.
- [x] Audit `floor` produksi dari snapshot vault (2026-10-21): kolom `floor`
  hanya terisi untuk ruangan; karyawan belum punya lantai, kartu ada di
  `tbl_user_cards` (265) bukan `tbl_users.card_number` (legacy). Laporan:
  `docs/reconstruction/floor-audit-2026-10-24.md`. Rekomendasi: deploy dengan
  `FLOOR_RESTRICTION=false` sampai pemetaan HR selesai.
- [ ] Isi grup lantai semua akun karyawan produksi (prasyarat
  `FLOOR_RESTRICTION=true`); lama: pastikan semua akun karyawan sudah diisi grup lantainya di produksi
  (kalau kosong, booking akan ditolak). Gunakan **Semua lantai** hanya untuk
  orang yang memang perlu lintas lantai (mis. resepsionis).

## Gelombang Ver 3 Rev 10 — 2026-10-24

Bukti per commit; angka test diambil dari pesan commit yang menyertainya.

- [x] `017_initial_setup.sql` + `GET /api/setup/status` + `POST /api/setup`;
  CMS `/setup` dan gate instalasi baru. Bukti: setup 201 → panggilan kedua
  409, login 200 (commit `f88a86e`).
- [x] Stack Docker Alpine `deploy/docker/` (`node:20-alpine`,
  `postgres:16-alpine`, `nginx:alpine`), entrypoint migrasi + seed role.
  Bukti: build sukses, DB kosong `required=true`, setup 201/409, 17 migrasi,
  APK tersaji, restart idempoten (commit `b91091b`).
- [x] Patch `3.10.1`: auto-login + hard redirect setelah setup (commit
  `ef9fd8e`).
- [x] Patch `3.10.2`: `/api/kiosk/schedule` mengirim `checkedInAt`; tablet
  menampilkan jam check-in aktual; APK 1.3.3 (14). Regresi 83/83, parity 8/8
  (commit `f0e6db7`).
- [x] Patch `3.10.3`: CMS Pengguna (pencarian nama/email/employee ID, kolom +
  filter role, tinggi viewport, pagination 25/50/100, admin list mengirim
  `role_id`), Pengaturan global menggantikan Floor groups, filter Building di
  kalender dihapus. Kiosk 1.3.4: Finish easter egg 5 tap pill IN USE, +15
  menit wajib kartu (server memverifikasi), until-next hanya bila ada jadwal,
  schedule retry 3x, footer versi APK + CMS. API: extend wajib `card_number`,
  context mengirim `cmsVersion`. Bukti: unit 79/79, client 92/92, regresi
  83/83, parity 8/8; uji tablet +15 prompt kartu dan Finish easter egg
  (commit `00e39ed`).
- [x] Dokumentasi diselaraskan 2026-10-24: `docs/CMS.md`, `docs/api-reference.md`,
  `docs/erd.md`, `docs/architecture.md`, `docs/operations-runbook.md`,
  `docs/handover/START-HERE.md`, `docs/VERSIONING.md`, catatan rilis
  `docs/release-v3.10.3.md`; `package-lock.json` disamakan ke `3.10.3`.

## Dokumentasi 2026-10-24 — README ringkas + index

- [x] `README.md` root diringkas (415 → ±190 baris): apa ini, quick install
  Docker Alpine, langkah setelah setup, peran & aturan produk, operasional
  singkat, tabel troubleshooting, dan peta dokumentasi. Detail dev/demo/LAN
  dipindah ke `docs/operations-runbook.md` §11 (tanpa duplikasi).
- [x] `docs/README.md` dibuat sebagai index dokumentasi (product champion,
  developer, rilis/riwayat, database & deploy, catatan proyek) + konvensi
  penulisan (placeholder `<ip-server>`, angka uji harus bersumber).
- [x] `docs/product-champion.md` dibuat: alur harian, skenario kiosk, batas
  wewenang, checklist operasi berisiko, dan jalur eskalasi.
- [x] `docs/business-processes.md` dilengkapi aturan role `receptionist` dan
  §5.1 booking atas nama (organizer tetap karyawan, `booked_by` untuk audit,
  tanpa lintas lantai).
- [x] Tidak ada perubahan kode/fitur; versi tetap CMS/API `3.10.3`, APK
  `1.3.5` (code 16).
