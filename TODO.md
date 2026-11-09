# 360 Scheduler Reconstruction TODO

Riwayat lengkap pekerjaan yang sudah selesai ada di
[`docs/history/todo-archive-through-2026-11-05.md`](docs/history/todo-archive-through-2026-11-05.md).

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
  **Sedang berjalan** sejak Senin 2026-11-02 di UAT live `10.10.42.8:8082`
  (masih versi 3.14.0). Jangan reset DB/re-pair tablet sampai sesi ini selesai.

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
- [x] Uji perangkat: matriks state, check-in, buka pintu, LED, offline, reboot.
  **Selesai 2026-11-05**: state/check-in/LED/offline diuji, buka pintu diuji
  pemilik produk. Hasil uji reboot: **aplikasi TIDAK hidup sendiri** — setelah
  tablet dinyalakan ulang, aplikasi kiosk harus dibuka manual. Temuan ini
  menjadi dasar item autostart/kiosk lock di bawah.
  Sudah: state (tersedia/terpakai/menunggu), check-in, offline+pulih, LED,
  pick time, 3 kartu NFC. Belum: buka pintu (relay belum ada), reboot,
  autostart/kiosk lock.

## Sisa pending 2026-10-21

Hasil sesi hari ini (kioskapp + CMS). Detail di
`docs/reconstruction/hardware-readiness-audit.md` dan
`nauchara/hardware/KIOSKAPP-RN.md`.

- [x] Beli modul relay USB (LCUS-1/CH340 serial, atau relay HID + dukungan native HID).
  **Sudah ada** (dikonfirmasi 2026-11-05).
- [x] Verifikasi relay fisik CH340: enumerasi USB, 9600 8N1, polaritas,
  izin USB setelah reboot, frame `A00101A2` / `A00100A1` (tombol Buka Pintu
  baru muncul kalau modul terdeteksi).
- [x] Uji NFC dengan beberapa tipe kartu (UID 4 byte vs 7 byte) dan
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
  **Terkonfirmasi 2026-11-05**: setelah reboot, kiosk harus dinyalakan manual
  (belum autostart, belum kiosk lock).
- [x] `GET /api/users` masih bisa dibaca semua user login (paritas produksi).
  **Keputusan 2026-11-05: dipertahankan** sesuai perilaku produksi; field
  `floor`/`card_number` hanya untuk admin (`docs/api-reference.md:370`). Bukan
  bug, tidak perlu dibatasi.

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
- [ ] Regression suite penuh (destruktif: reset DB + pairing) belum pernah
  dijalankan sampai tuntas; perlu persetujuan sebelum dijadwalkan. Ini satu-
  satunya item eksekusi yang tersisa dan sudah mencakup: `scheduler.test.js`
  (multi-day, containing overlap, adjacency, concurrent double-book, report
  boundary), `kiosk-book.test.js` (`/events/book`), `auto-release.test.js`,
  `security.test.js`, dan suite access/floor/receptionist/user-import.

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

## UAT Docker + akses pintu (2026-10-26)

- [x] UAT berjalan sebagai stack **Docker Compose di VM Linux**; CMS/API di
  port `8082`. Cek langsung: CMS root HTTP 200, `/api/health` 200,
  `/apk/kiosk-release.apk` 200.
- [x] Setup admin selesai dan impor user bersih di DB UAT.
- [x] Satu akun meeting room dibuat; tablet dipairing ke server UAT.
- [x] Akses pintu end-to-end di tablet: APK → `/api` validasi kartu 200 →
  relay CH340 di tablet → klik relay fisik. CH340 juga terbukti lewat COM
  Windows dan bridge `/dev/ttyUSB0` di WSL sebelumnya.
- [x] Env UAT: CORS untuk host langsung + domain tujuan, JWT secret dan
  password PostgreSQL app di-generate (nilai tidak dicatat di repo).
- [x] APK dipakai: `1.3.8` (19), footer `v1.3.8 (19) · CMS 3.11.0`.
- [x] Perubahan UI terakhir (tombol clear filter role) lulus `build:client`
  + client 98/98; angka tes tetap: regresi 87/87 (0 skip), server unit 79/79,
  parity prepare 2/2, parity 8/8, kiosk unit 21/21.
- [x] Commit: `0d17a4f` (opsi external nginx), `6cb0704` (argumen wajib
  origin/proxy-ip), `3b9f623` (split/validasi secret), `1ee10c7` (origin
  list), `26691c8` (script deploy executable), `4f463fb` (clear filter role),
  `6452b7c` (placeholder IP di docs).
- [ ] DNS record + vhost nginx untuk `<uat-domain>` belum aktif; akses masih
  lewat `http://<uat-host>:8082`.
- [ ] UAT formal / training pengguna (pemilik produk). **Sedang berjalan di
  UAT live sejak Senin 2026-11-02**; catat temuan pemakai sebelum go-live.
- [ ] Go-live produksi + tag rilis. **Target jadwal: Desember 2026.**
- [x] Opsional: NFC 7-byte, autostart/kiosk lock; 16 kartu placeholder RMH
  ditunda.

## Audit kode dan rilis 3.15.1 (2026-11-05)

Pekerjaan gelombang Ver 3 Rev 16-17. Detail keputusan di
`docs/VERSIONING.md`; audit lengkap dibahas di sesi 2026-11-05.

- [x] Rilis booking no-show transaksional (`releaseAbandonedRoomBookings`) +
  unit test; terbukti di UAT lokal (ruangan tidak aktif kembali setelah
  trigger dijalankan ulang).
- [x] 28 fungsi PL/pgSQL legacy dihapus dari repo dan dari DB terpasang
  (`030_drop_legacy_functions.sql`); tes kontrak lama ikut dihapus.
- [x] Halaman `/apk/index.html` membaca `latest.json`; APK RustDesk beserta
  tombolnya dihapus.
- [x] `addAttendee` mengembalikan `409 ROOM_CONFLICT` (bukan 500) saat ruangan
  bentrok; booking instan kiosk menandai check-in di transaksi yang sama.
- [x] Audit tambah-kartu mencatat pelaku (`principal` diteruskan di
  `createUser` dan `editUser`).
- [x] CSP aktif di API (helmet) dan nginx; migrasi
  `031_events_period_index.sql` menambah indeks GiST rentang jadwal.
- [x] Kode mati dihapus: `finishKioskMeeting`, `openKioskDoor`,
  `kioskLedCodeFor`/`kioskLedCodes`, `formatDateLong`, `formatDateTimeLong`,
  `reportFilename`, `writeCsvReport`, plus blok locale `common.dataGrid.*`
  dan `management.cards.*` (en/id) beserta asersi tesnya.
- [x] `.env.example` + `deploy/bootstrap.sh` dibersihkan dari `BASE`/`REDIS_*`;
  `@types/react` dan `@types/react-dom` dihapus.
- [x] `docs/baseline/SHA256SUMS` lolos verifikasi; README baseline tidak lagi
  mengklaim `bjb.sql` tersimpan.
- [x] `package.json` 3.15.1 (Ver 3 Rev 17); UAT lokal menyajikan `v3.15.1`,
  semua container `healthy`, 123 event utuh.
- [x] Rilis ruangan otomatis kini menulis baris audit
  `event.room_auto_release` (actor `auto-release`); terverifikasi di UAT lokal
  pada meeting no-show (3.15.3 / Ver 3 Rev 19).
- [ ] **Pantau kepadatan Log Audit** (sengaja belum dikerjakan). Satu stream
  audit sudah benar; baris `event.room_auto_release` bercampur dengan perubahan
  manual, dan tampilan CMS hanya memuat 100 baris terbaru tanpa pagination.
  Perbaiki hanya bila: (a) baris ke-100 berumur < 30 hari, atau (b) baris
  `auto-release` lebih banyak daripada perubahan manual di layar.
  Urutan upgrade: cursor pagination (`created_at, _id`; index sudah ada) dulu,
  baru filter aksi di UI. Jangan memisahkan tabel/halaman audit.
- [ ] Tag `v3.15.1` setelah commit, lalu deploy ke live `10.10.42.8`.
  Live masih `3.14.0` (dan halaman `/apk` di sana masih memuat tombol
  RustDesk), sedangkan pengujian pemakai sedang berjalan di server itu.
  **Koordinasikan jendela deploy dulu**; perubahan 3.15.1 tidak mengubah data,
  jadi aman untuk data uji, tetapi restart app memutus sesi tablet sebentar.
- [ ] Rewrite history `.git` (395 MB, mayoritas blob APK lama). Destruktif;
  butuh persetujuan eksplisit dan `security-sanitizer`.
- [x] `npm run format:check` **dijadikan bagian alur default** 2026-11-05:
  176 file dirapikan sekali dengan `prettier --write`, `format:check` masuk ke
  `npm run verify`, dan `docs/VERSIONING.md` mewajibkan `npm run format` +
  `npm run verify` di setiap bump versi.
- [x] 2 PDF training (`docs/training/*.pdf`) **dihapus** 2026-11-05; yang
  disimpan hanya `.pptx` (sumber, ditautkan dari `docs/README.md`).
- [x] Pisahkan `TODO.md`: 45 bagian yang seluruhnya selesai dipindahkan ke
  `docs/history/todo-archive-through-2026-11-05.md`; `TODO.md` kini 222 baris
  dan hanya memuat bagian yang masih punya item terbuka.
- [x] Regression suite penuh (destruktif: reset DB + pairing) belum dijalankan
  hari ini; perlu persetujuan sebelum dijadwalkan. Status 2026-11-05: item
  digabung ke baris 327 (satu-satunya item regression yang tersisa).
