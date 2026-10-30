# Revamp CMS ke Ant Design 5

Status: **merge selesai (HEAD `9c96999`)** — tag rilis belum dibuat.
Tanggal: 2026-10-30.

## Cara pakai dokumen ini

- Dokumen ini adalah sumber recall utama untuk revamp AntD.
- Sebelum mulai bekerja, baca status, fase, cleanup inventory, dan log terakhir.
- Setiap perubahan wajib menambah satu baris di **Log perubahan**.
- Satu baris per commit atau per fase; sebut file utama dan hasil verifikasi.
- Kalau keputusan berubah, update bagian terkait dan catat alasannya di log.

## Keputusan

- UI CMS memakai **Ant Design 5**.
- Revamp **hanya mengubah UI client CMS**.
- Backend, API, socket, database, auth, dan APK tidak berubah.
- Visual boleh berubah; fungsi, izin, alur, dan API harus tetap sama.
- React tetap **17.0.2**; AntD 5 mendukung React >=16.9.
- APK kiosk React Native **tidak disentuh** dalam revamp ini.
- Revamp CMS tidak mengubah APK. Perbaikan layout APK dilakukan terpisah
  sebagai `1.4.5 (26)`; manifest dan paket distribusi ikut diperbarui.
- Upgrade React Native ditunda; dibahas terpisah setelah revamp CMS.
- Migrasi bertahap; MUI dan AntD boleh hidup berdampingan sementara.

## Batas APK kiosk

- APK kiosk **tidak diupdate** selama revamp CMS.
- Versi revamp awal tetap `1.4.4 (25)`; patch layout terpisah menjadi `1.4.5 (26)`.
- Tidak ada perubahan pada `kioskapp/`, APK distribusi, atau manifest update.
- Kontrak API CMS harus tetap kompatibel dengan APK 1.4.4/1.4.5.
- Android 8.1 masih memenuhi `minSdk 24` untuk RN baru, tetapi upgrade RN
  bukan bagian dari pekerjaan ini. Catatan risetnya disimpan terpisah agar
  tidak tercampur dengan revamp UI.

## Paket

### Tambah

```json
"antd": "^5.29.3",
"@ant-design/icons": "^5.6.1"
```

`dayjs` sudah ada dan dipakai AntD DatePicker.

### Hapus setelah semua layar selesai dimigrasi

```json
"@mui/material"
"@mui/icons-material"
"@mui/x-data-grid"
"@mui/x-date-pickers"
"@emotion/react"
"@emotion/styled"
```

### Hapus karena konflik CSS

```json
"bootstrap"
"@fullcalendar/bootstrap5"
```

FullCalendar tetap v6, tetapi pindah dari `themeSystem="bootstrap5"` ke
`themeSystem="standard"`.

### Tetap

- `react` / `react-dom` 17
- `react-router-dom` 5 (hapus direct `react-router` yang redundant)
- `react-redux` / `@reduxjs/toolkit`
- `i18next` / `react-i18next`
- `@fullcalendar/*` 6
- Vite, Webpack, Express, PostgreSQL

### Opsional, pekerjaan terpisah

- `eslint` 9.39.5 -> 10.13.0
- `@fullcalendar/*` 6 -> 7 (butuh `temporal-polyfill`)
- `moment` dihapus karena tidak dipakai
- React 18/19 tidak diperlukan untuk AntD 5

## Babel dan build

- Babel **tidak dipakai untuk build client**. Client memakai Vite + esbuild +
  `@vitejs/plugin-react`.
- `.babelrc` + `babel-loader` hanya dipakai Webpack untuk build server.
- AntD 5 **tidak membutuhkan `babel-plugin-import`**; Vite menangani ESM dan
  tree-shaking.
- Babel tetap 7. Jangan naik ke Babel 8 saat revamp.
- `.babelrc` masih menargetkan `node: 14`; runtime server sudah Node 22.
  Perbarui target Node sebagai pekerjaan terpisah, bukan bagian AntD.

## Bootstrap dan CSS

- Hapus import `bootstrap/dist/css/bootstrap.min.css` dari
  `client/entry-client.js`.
- Hapus `bootstrap5Plugin` dari `client/calendar/MeetingWeek.js`.
- Tambahkan reset AntD (`antd/dist/reset.css`) atau gunakan reset bawaan
  AntD 5.
- Audit CSS global lain karena reset AntD bisa mengubah spacing, tombol, dan
  form.

## Cleanup inventory

### Paket redundant atau tidak dipakai

| Package | Alasan |
|---|---|
| `moment` | Tidak ada referensi di client/server |
| `react-router` | Sudah dihapus; kode hanya memakai `react-router-dom` |
| `terser` | Sudah dihapus; tidak diimpor langsung |
| `terser-webpack-plugin` | Sudah dihapus; `minimize: false` |
| `body-parser` | Sudah dihapus; Express 4 memakai `express.json()`/`express.urlencoded()` |
| `bootstrap` | Hanya dipakai FullCalendar |
| `@fullcalendar/bootstrap5` | Diganti theme standard |

`body-parser` diganti di `server/express.js`:

```js
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
```

### Kode dan test yang obsolete

| File | Tindakan |
|---|---|
| `client/theme.js` | Ganti dengan AntD theme token |
| `client/components/common/resolve-mui-icon.js` | Hapus |
| `client/tests/resolve-mui-icon.test.js` | Hapus |
| `client/tests/ui-robustness.test.js` | Hapus atau tulis ulang untuk AntD |
| `client/components/common/LocalizedDataGrid.js` | Ganti dengan wrapper AntD Table |
| `client/management/users/user-columns.js` | Ganti definisi kolom AntD Table |
| `client/management/rooms/room-columns.js` | Ganti definisi kolom AntD Table |
| `client/domain/licenses.js` | Hapus entri MUI, Emotion, Bootstrap, body-parser; tambah AntD |

### Dokumentasi yang stale

| File | Perubahan |
|---|---|
| `README.md` | React 17 + MUI 5 -> React 17 + Ant Design 5 |
| `docs/architecture.md` | Update tabel stack dan diagram |
| `docs/CMS.md` | Hapus `LocalizedDataGrid`/`theme.js` MUI |
| `docs/handover/START-HERE.md` | Update stack dan lokasi theme |
| `docs/operations-runbook.md` | Update label agen CMS |

`docs/reconstruction/*` dibiarkan sebagai catatan historis.

### Scope kiosk web

`client/kiosk/KioskApp.js` memakai MUI. Kalau tidak ikut dimigrasi:

- MUI dan Emotion tetap tinggal.
- Bundel membawa MUI + AntD permanen.
- `bootstrap` tetap bisa dihapus karena hanya dipakai kalender.

## Deprecated packages

Sumber: `npm ci` bersih di direktori sementara dan `npm ls --all` pada
lockfile, dicek 2026-10-29. Ini daftar package deprecated dari registry,
bukan audit vulnerability.

### CMS/API

| Package | Jalur | Pengganti |
|---|---|---|
| `eslint@9.39.5` | direct dev | `eslint@10.13.0` |
| `@mui/base@5.0.0-dev...` | `@mui/x-date-pickers@6` | hilang bersama MUI |
| `fstream@1.0.12` | `exceljs` -> `unzipper` | `node:fs` / `tar` |
| `glob@7.2.3` | `exceljs` / `archiver` | `glob@14` (API berubah) |
| `inflight@1.0.6` | `glob@7` | `lru-cache` |
| `lodash.isequal@4.5.0` | `exceljs` -> `fast-csv` | `node:util.isDeepStrictEqual` |
| `rimraf@2.7.1` | `fstream` | `rimraf@6` / `fs.rm` |

`exceljs@4.4.0` adalah versi terbaru; deprecated transitive di atas tidak
hilang tanpa mengganti library Excel.

### Kiosk

| Package | Jalur | Pengganti |
|---|---|---|
| `eslint@9.39.5` | direct dev | `eslint@10.13.0` |
| `@babel/plugin-proposal-*` | RN 0.73 babel preset | `@babel/plugin-transform-*` |
| `glob@7.2.3` | RN CLI/metro/jest | `glob@14` |
| `inflight@1.0.6` | `glob@7` | `lru-cache` |
| `rimraf@2.6.3`, `3.0.2` | RN CLI/jscodeshift | `fs.rm` / `rimraf@6` |
| `sudo-prompt@9.2.1` | RN CLI | `@vscode/sudo-prompt` |
| `react-native@0.73.11` | direct | `react-native@0.88.1` |

Upgrade RN adalah migrasi besar dan tidak dicampur dengan revamp CMS.

## Penggantian komponen

```text
MUI ThemeProvider      -> ConfigProvider
MUI DataGrid           -> AntD Table
MUI Dialog             -> AntD Modal
MUI TextField/Select   -> AntD Form + Input/Select
MUI DatePicker         -> AntD DatePicker/TimePicker
MUI Snackbar           -> AntD App/message/notification
MUI icons              -> @ant-design/icons
```

## Fase

1. Fondasi: `ConfigProvider`, locale `id_ID`/`en_US`, theme token, reset AntD.
2. Pilot: **User Management** (tabel, filter, form, modal, import, permission).
3. Shell: menu, header, layout, footer versi.
4. Layar lain: login, kalender, booking, rooms, settings, branding, About,
   audit, report.
5. Cleanup: hapus MUI/Emotion/Bootstrap, cek bundle, jalankan semua test.
6. UAT dan parity check.

## Definisi selesai

- Semua menu dan aksi lama tetap berfungsi.
- Permission, floor restriction, dan kontrak API tidak berubah.
- i18n EN/ID lengkap.
- Test client lulus.
- Tidak ada import MUI tersisa.
- Kalender tetap bisa create/edit/cancel booking.
- APK kiosk tidak berubah.

## Sisa pekerjaan

### Penutupan rilis

- [x] UAT lokal final: login/setup, kalender + booking, users, rooms/devices,
  settings/branding/role/audit, report/export, web `/kiosk`.
- [x] Smoke test APK 1.4.5 terhadap CMS baru: pairing, schedule, check-in,
  extend, NFC/LED (dianggap selesai oleh pemilik produk).
- [x] Merge `revamp/antd5` ke `master` dan push (HEAD `9c96999`).
- [ ] Bump/tag rilis CMS setelah merge (saat ini `3.12.1`, belum ada tag
  revamp/produksi).
- [x] Build client/server, client **99/99**, server unit **85/85**, regression
  **105/105**, parity **8/8** (bukti 2026-10-30). Parity memerlukan
  `cookie-parser` + `lodash` legacy di checkout build; setelah dipasang, semua
  8 test lulus.

### Status lingkungan

- UAT local test bed `http://127.0.0.1:8082` dan UAT live
  `http://<uat-host>:8082` sudah memakai commit `9c96999`; app/web/db sehat.
- Migrasi terakhir tetap `026_event_room_timezone.sql`; tidak ada migrasi baru
  setelah merge.
- Alur `npm run demo` sudah **tidak dipakai**; skrip demo tersisa hanya karena
  dirujuk harness unit/parity.

### Ditunda

- [ ] Bulk atomic grant/revoke master card — butuh endpoint baru.
- [ ] Upgrade React Native tetap ditunda; APK saat ini 1.4.5.
- [ ] ESLint 10, Babel target `node 14` -> Node 22, hapus `moment`.
- [ ] Screenshot/visual parity final.
- [x] Sinkronkan dokumen APK 1.4.5, stack AntD, lisensi, dan commit
  `eslint.config.js` sebagai baseline.

### TODO lama yang masih terbuka

- [ ] Usability test 5 first-time users.
- [ ] Tag reconstructed baseline.
- [ ] Relay fisik, NFC 7-byte, autostart/kiosk lock.
- [ ] UAT formal, DNS/vhost, go-live produksi.

## Risiko

- Reset Bootstrap vs AntD.
- DataGrid -> Table: sorting, filter, pagination, dan column behavior.
- FullCalendar standard theme: tampilan berubah, event handling harus tetap.
- Test client yang bergantung pada selector/komponen MUI.

## Log perubahan

Setiap perubahan wajib dicatat di sini. Jangan hapus baris lama; tambahkan
baris baru di bawah.

| Tanggal | Fase | Perubahan | File utama | Verifikasi |
|---|---|---|---|---|
| 2026-10-29 | Plan | Rencana revamp AntD 5 | `docs/revamp-antd5.md` | review manual |
| 2026-10-29 | Plan | Cleanup inventory + hasil audit npm | `docs/revamp-antd5.md` | review manual |
| 2026-10-29 | Plan | Aturan pencatatan perubahan untuk agent | `docs/revamp-antd5.md`, `AGENTS.md` | review manual |
| 2026-10-29 | Plan | Batas scope: APK stays 1.4.4 (25), tanpa update APK/RN | `docs/revamp-antd5.md` | review manual |
| 2026-10-29 | Plan | Revamp hanya UI CMS; backend/API/socket/DB/auth/APK tidak berubah | `docs/revamp-antd5.md` | review manual |
| 2026-10-29 | Fondasi | Tambah AntD 5 + icons; ConfigProvider, theme token, locale; hapus Bootstrap dan theme FullCalendar bootstrap5 | `package.json`, `package-lock.json`, `client/App.js`, `client/theme.js`, `client/entry-client.js`, `client/calendar/MeetingWeek.js` | build client OK |
| 2026-10-29 | Fondasi | Migrasi komponen umum: FormDialog, ConfirmDialog, PasswordDialog, AsyncState, FeedbackSnackbar | `client/components/common/*` | build client OK |
| 2026-10-29 | Pilot | Migrasi User Management: table, filter, form, import, cards, password, delete | `client/management/UserManagementSection.js`, `client/management/users/*` | 98/98 test client, build OK, UAT lokal sehat |
| 2026-10-29 | Shell/Auth | Migrasi Menu, footer, 404, error boundary, signup, force password, setup gate, language switcher | `client/core/*`, `client/auth/*`, `client/MainRouter.js`, `client/components/common/*` | build client OK, 98/98 test |
| 2026-10-29 | Calendar | Migrasi kalender, sidebar, agenda, detail drawer, editor, attendee/on-behalf picker | `client/calendar/*` | build client OK, 98/98 test |
| 2026-10-29 | Management | Migrasi rooms, settings, branding, role matrix, audit, devices, About | `client/management/*` | build client OK |
| 2026-10-29 | Profile/Report/Kiosk | Migrasi profile, room usage report, dan web kiosk | `client/profile/*`, `client/report/*`, `client/kiosk/KioskApp.js` | build client OK |
| 2026-10-29 | Cleanup | Hapus MUI, Emotion, Bootstrap, LocalizedDataGrid, resolveMuiIcon, test khusus MUI; update lisensi dan docs stack | `package.json`, `package-lock.json`, `client/domain/licenses.js`, docs | 96/96 test client, build client + server OK |
| 2026-10-29 | UAT lokal | Rebuild image app/web, recreate app/web tanpa menyentuh DB | `deploy/docker/.env.revamp` (lokal, ignored) | app/web/db healthy, HTTP 200 |
| 2026-10-29 | Theming | Light/dark via AntD algorithm + token; toggle header; ThemeShell menjembatani token ke FullCalendar dan body | `client/theme.js`, `client/theme-mode.js`, `client/core/ThemeShell.js`, `client/core/Menu.js`, `client/theme.css`, locales | build client OK, 96/96 test |
| 2026-10-29 | Controls | Ganti kontrol HTML custom ke AntD: login, setup awal, upload CSV, field editor booking | `client/auth/Signin.js`, `client/auth/InitialSetup.js`, `client/management/users/UserImportDialog.js`, `client/calendar/EventEditor.js` | build client OK, 96/96 test |
| 2026-10-29 | Sign-in/Theme | Sign-in dan setup awal jadi AntD Card/Form penuh; kontrol tema di atas kartu; hapus panel custom; label branding jadi Icon/Logo/Favicon; hardcoded surface pakai token | `client/auth/*`, `client/management/BrandingSection.js`, `client/management/users/UserCardsDialog.js`, `client/calendar/*`, `client/profile/ProfileSummaryCard.js`, `client/report/RoomUsageReport.js`, locales | build client OK, 96/96 test, UAT lokal sehat |
| 2026-10-29 | Detail fix | Drawer detail menerima participant snake_case/camelCase; ruangan kembali tampil | `client/calendar/EventDetailsDrawer.js`, `client/domain/events/event-contract.js`, test | build client OK, 97/97 test |
| 2026-10-29 | Meeting form | Penanda required eksplisit bintang merah kecil di semua field wajib | `client/calendar/EventEditor.js` | build client OK, 96/96 test |
| 2026-10-29 | Meeting form | Tandai required: subject, tanggal/jam, booking kind, recurrence wajib, location | `client/calendar/EventEditor.js`, locales | build client OK, 96/96 test |
| 2026-10-29 | Meeting form | Location ditandai required dan Save disabled sampai ruangan dipilih | `client/calendar/EventEditor.js` | build client OK, 96/96 test |
| 2026-10-29 | Agenda UX | Floor dipindah ke kolom kanan kartu; response event menambah `room_floors` additive | `server/features/events/event.service.js`, `client/calendar/MeetingWeek.js`, `client/domain/calendar.js`, docs | build client/server OK, 96/96 + 85/85 test |
| 2026-10-29 | Agenda UX | Tampilkan floor per kartu agenda sebagai Tag metadata; checked-in jadi Tag | `client/calendar/MeetingWeek.js`, `client/domain/calendar.js`, locales | build client OK, 96/96 test |
| 2026-10-29 | Agenda UX | Hilangkan tahun dari cue multi-hari dan beri jarak ke baris jam | `client/calendar/MeetingWeek.js` | build client OK, 96/96 test |
| 2026-10-29 | Agenda UX | Agenda dikelompokkan per hari, range tanggal terlihat, empty state AntD, border kartu dinetralkan | `client/calendar/MeetingWeek.js` | build client OK, 96/96 test |
| 2026-10-29 | About UX | About jadi header + Card Versions/CMS libraries/Kiosk libraries + copyright, konsisten dengan Settings | `client/management/AboutSection.js`, locales | build client OK, 96/96 test |
| 2026-10-29 | Header UX | Beri jarak nav/right controls; chip akun bergaya pill; nama hanya di layar xl; drawer di bawah lg | `client/core/Menu.js` | build client OK, 96/96 test |
| 2026-10-29 | Header UX | Gabungkan welcome + profile + signout menjadi chip akun dropdown; theme toggle tetap terpisah | `client/core/Menu.js`, locales | build client OK, 96/96 test |
| 2026-10-29 | Report UX | Range tanggal jadi RangePicker; export pindah ke header; filter dan tabel dalam Card | `client/report/RoomUsageReport.js` | build client OK, 96/96 test |
| 2026-10-29 | Settings UX | Settings jadi kartu AntD konsisten; save di header; branding/role/audit tanpa judul ganda; aksi sekunder rata kanan | `client/management/SettingsSection.js`, `BrandingSection.js`, `RoleAccessMatrix.js`, `AuditLogSection.js`, locales | build client OK, 96/96 test |
| 2026-10-29 | Users UX | Seragamkan daftar kartu user memakai AntD List; hapus baris custom | `client/management/users/UserCardsDialog.js` | build client OK, 96/96 test |
| 2026-10-29 | Users UX | Tambah filter Master card / Not master; tetap client-side | `client/management/UserManagementSection.js`, locales | build client OK, 96/96 test |
| 2026-10-29 | Users UX | Identitas digabung; role/floor/card tag; aksi Edit + dropdown; master card hanya indikator; filter lantai; ringkasan; mobile card list | `client/management/UserManagementSection.js`, `client/management/users/user-columns.js`, locales | build client OK, 96/96 test |
| 2026-10-29 | Copy | “Schedule data” menjadi “Schedule” / “Jadwal” | `client/locales/en/calendar.json`, `client/locales/id/calendar.json` | build client OK, 96/96 test |
| 2026-10-29 | Calendar UX | Mode jadwal jadi 3 opsi pendek: Saya/Ruangan/Semua; hint satu baris; hapus floor mode | `client/calendar/CalendarSidebar.js`, `client/calendar/MeetingCalendar.js`, `client/domain/roles.js`, locales | build client OK, 96/96 test |
| 2026-10-29 | Calendar UX | Hilangkan track scrollbar palsu di header tanggal; body jam tetap scroll | `client/theme.css` | build client OK, 96/96 test |
| 2026-10-29 | Calendar UX | Header hari sticky; body jam scroll sendiri; posisi awal fokus ke jam sekarang | `client/calendar/MeetingWeek.js` | build client OK, 96/96 test |
| 2026-10-29 | Auth layout | Hapus language switcher ganda di halaman auth; form sign-in/setup fill dan center; footer tetap terlihat | `client/auth/Signin.js`, `client/auth/InitialSetup.js`, `client/MainRouter.js` | build client OK, 96/96 test |
| 2026-10-29 | Layout | Footer selalu terlihat: WebRouter jadi flex column, konten scroll di tengah, footer flex-shrink 0 | `client/MainRouter.js`, `client/core/VersionFooter.js`, `client/auth/*` | build client OK, 96/96 test |
| 2026-10-29 | Copy | Label “Admin Panel” menjadi “CMS”; caption sign-in disederhanakan | `client/locales/en/*`, `client/locales/id/*` | build client OK, 96/96 test |
| 2026-10-29 | Plan | Catat sisa pekerjaan revamp, merge, rilis, test, dan item ditunda | `docs/revamp-antd5.md` | review manual |
| 2026-10-29 | APK fix | APK 1.4.5 (26): perbaiki NEXT UP overlap di panel merah/hijau; publish manifest dan paket | `kioskapp/src/components/kiosk-styles.ts`, `KioskStatusPanel.tsx`, `public/apk/*`, `client/domain/licenses.js` | build APK OK, typecheck OK, unit 21/21 |
| 2026-10-29 | Audit fix | Proteksi super admin, validasi ID/payload, floor detail hanya resepsionis, pilih tablet aktif, error auto-release | `server/features/*`, `client/management/rooms/*`, tests | 97/97 client, 85/85 unit, 105/105 regresi, parity 8/8 |
| 2026-10-29 | Verification | Build client/server; client 99/99; server unit 85/85; regression 105/105; parity 8/8 | `build/`, `server/tests/*` | semua lulus |
| 2026-10-29 | Cleanup | Sync docs APK 1.4.5 + stack AntD; lisensi dicek; `eslint.config.js` masuk repo | `README.md`, `docs/*`, `client/domain/licenses.js`, `eslint.config.js` | review dokumen |
| 2026-10-29 | Docs sync | Selaraskan distribusi APK di `VERSIONING.md` ke paket 1.4.5 (26) `941a537` dan hapus kalimat **Tentang** ganda | `docs/VERSIONING.md` | `git diff --check` bersih |
| 2026-10-30 | Docs sync | Catat merge selesai (`9c96999`), angka final client 99/99 + regresi 105/105, UAT local/live current, migrasi 026, demo tidak dipakai; tag rilis belum ada | `docs/*`, `README.md` | `git diff --check` |
