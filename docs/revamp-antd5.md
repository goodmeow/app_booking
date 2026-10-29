# Revamp CMS ke Ant Design 5

Status: **rencana, belum dieksekusi**.
Tanggal: 2026-10-29.

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
- **APK stays**: tetap `1.4.4 (25)`, tidak ada update APK, tidak ada bump
  `versionCode`, dan tidak ada perubahan `public/apk/latest.json`.
- Upgrade React Native ditunda; dibahas terpisah setelah revamp CMS.
- Migrasi bertahap; MUI dan AntD boleh hidup berdampingan sementara.

## Batas APK kiosk

- APK kiosk **tidak diupdate** selama revamp CMS.
- Versi tetap `1.4.4` dengan `versionCode 25`.
- Tidak ada perubahan pada `kioskapp/`, APK distribusi, atau manifest update.
- Kontrak API CMS harus tetap kompatibel dengan APK 1.4.4.
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
| `react-router` | Direct dependency redundant; kode hanya memakai `react-router-dom` |
| `terser` | Tidak diimpor langsung |
| `terser-webpack-plugin` | Diimpor di `webpack.config.cjs`, tetapi tidak dipakai (`minimize: false`) |
| `body-parser` | Redundant; Express 4 punya `express.json()` dan `express.urlencoded()` |
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
