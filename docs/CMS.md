# CMS / Web Admin `app_booking` — breakdown halaman

Dokumen ini memetakan halaman-halaman web admin (CMS) beserta isi, API, dan
lokasi kodenya. Terakhir diperbarui: 2026-10-22.

## 1. Ringkasan teknis

| Lapisan | Teknologi | Lokasi |
|---|---|---|
| Runtime | Node.js 22 | – |
| API | Express 4 | `server/express.js`, `server/server.js` |
| DB | PostgreSQL 14 (`pg`) | container `360booking-postgres-test` |
| Realtime | Socket.io 4 | invalidasi data antar klien |
| Auth | JWT + bcrypt | `server/features/auth/` |
| Web | React 17 + MUI 5 + Redux Toolkit + Vite | `client/` |
| Font | Inter (self-host) | `public/fonts/Inter-latin.woff2`, `client/fonts.css` |

Menjalankan lokal: `npm run demo` → web `:8081`, API `:9091`, DB `:54320`.
Login demo: `admin@example.test` (password di `.env.demo`).

## 2. Peta rute

```
/                      Kalender Rapat            (login)
/user/:userId          Profil Pengguna           (login)
/signin  /signup       Masuk / Daftar            (publik, tanpa header)
/app-management        Manajemen Aplikasi        (ADMIN)
/report                Laporan Pemakaian Ruangan (ADMIN)
/kiosk  /kiosk/setup   Kiosk web (referensi)     (tanpa header CMS)
*                      404 NotFound
```

Sumber: `client/MainRouter.js`. Rute kiosk berada di luar `WebRouter`
sehingga tidak memakai header CMS.

## 3. Halaman

### 3.1 Masuk (`/signin`) — `client/auth/Signin.js`
- Panel kiri gelap `#1A2027`, logo **The Prasada**
  (`public/the-prasada-logo.png`, tinggi 220 px) + teks "Panel admin ruang
  meeting".
- Panel kanan: judul "Masuk", email, kata sandi dengan tombol
  **Tampilkan/Sembunyikan**, tautan **Lupa kata sandi?** (menampilkan kontak
  `helpdesk@integrasolution.id` lewat tautan mailto), checkbox **Tetap masuk
  di perangkat ini**, tombol putih **Masuk**.
- Alert merah `#B3261E` saat kredensial salah.
- "Tetap masuk" mengubah penyimpanan sesi dari `sessionStorage` ke
  `localStorage` (`client/auth/auth-helper.js`).
- Tautan "Buat akun" tidak ditampilkan; akun dibuat admin lewat tab Pengguna.
- Header CMS disembunyikan di rute ini (`WebChrome` di `MainRouter.js`).
- API: `POST /api/auth/signin`.

### 3.2 Daftar (`/signup`) — `client/auth/Signup.js`
- Pembuatan akun baru.
- API: `POST /api/auth/signup`.

### 3.3 Kalender Rapat (`/`) — `client/calendar/`
- Papan jadwal dengan **ruangan sebagai resource** (FullCalendar
  resource-timeline, tampilan minggu).
- `MeetingCalendar.js`: orkestrasi data + socket; `MeetingWeek.js`: render
  kalender; `CalendarSidebar.js`: panel samping; `EventEditor.js`: form
  event (preview konflik, create/update/delete, attendee, tamu, berulang).
- API: `GET /api/events`, `GET /api/events/details`,
  `POST /api/events/preview`, `POST/PUT/DELETE /api/events`,
  `GET /api/rooms`, `GET /api/users/`.
- **Aturan lantai:** karyawan hanya boleh memesan ruangan di **grup lantainya**
  (`tbl_users.floor`). Nilai `all` berarti **semua lantai**. Server menolak
  booking lintas lantai dengan `403 FLOOR_RESTRICTED`; akun tanpa lantai
  mendapat `403 FLOOR_REQUIRED`. Admin dikecualikan. Di UI, daftar ruangan
  pada sidebar dan pemilih lokasi editor difilter sesuai grup lantai user, dan
  sidebar menampilkan keterangan lantai. Kiosk "Pesan sekarang" juga memeriksa
  lantai pemilik kartu.
- Grup lantai hanya bisa diubah **admin** (lewat tab Pengguna); user biasa tidak
  bisa menaikkan haknya sendiri menjadi `all`.

### 3.4 Profil Pengguna (`/user/:userId`) — `client/profile/UserProfile.js`
- Detail akun, edit profil, ganti kata sandi, hapus akun.
- API: `GET/PUT /api/users/:id`, `PUT /api/users/change-password`,
  `DELETE /api/users/:id`.

### 3.5 Laporan Pemakaian Ruangan (`/report`, admin) — `client/report/RoomUsageReport.js`
- Rentang tanggal → rekap pemakaian per ruangan, dengan ekspor.
- API: `GET /api/rooms/usage-report`.

### 3.6 Manajemen Aplikasi (`/app-management`, admin) — `client/management/`
Empat tab (`AppManagement.js`):

| Tab | Isi | API |
|---|---|---|
| Pengguna (`UserManagementSection.js`, `user-form.js`) | CRUD user **beserta akses kartunya**: kolom nomor kartu, tombol **kartu master**, dan **kolom grup lantai** (pilih **Semua lantai**, lantai tertentu, atau belum diatur) yang bisa diubah langsung dari tabel atau lewat form; ganti sandi, hapus. | `/api/users` |
| Ruangan (`RoomManagementSection.js`) | CRUD ruangan: nama, gedung, lantai, **kapasitas**, fitur, email, sandi. **Kolom Tablet: Online/Offline/Belum ada/Dicabut**, auto-refresh 15 s | `/api/rooms`, `/api/kiosk/devices` |
| Perangkat Tablet (`KioskDeviceManagementSection.js`) | Daftar tablet: nama, ruangan, **Online/Offline/Dicabut/Kedaluwarsa**, switch **LED** (NFC sudah ditangani aplikasi kiosk), last seen, waktu pairing, cabut perangkat. Auto-refresh 15 s | `/api/kiosk/devices`, `PATCH …/capabilities`, `DELETE …/:id` |

**Akses kartu digabung ke tab Pengguna** (sub-menu "Kartu Master" dihapus dari UI):
nomor kartu tampil dan bisa dikoreksi di baris user, dan kartu bisa ditandai
**kartu master** dengan satu tombol. Di server, flag ini menulis/menghapus baris
`tbl_card_masters`; kartu master otomatis boleh membuka semua pintu. Endpoint
lama `/api/settings/card-master` tetap ada untuk kompatibilitas API.

Status online dihitung server: `last_seen_at` diperbarui setiap request kiosk
(throttle 10 s), dan `online = last_seen_at <= 60 s`
(`server/features/kiosk/kiosk.service.js`, `kiosk.repository.js`).

**Batas pairing:** satu ruangan hanya boleh punya **satu tablet aktif**.
Percobaan pairing kedua ditolak `409 ROOM_ALREADY_PAIRED`; admin harus
mencabut perangkat lama di tab Perangkat Tablet lebih dulu. Perangkat yang
token refresh-nya sudah kedaluwarsa (tidak dipakai >30 hari) tidak menghalangi
pairing baru. Ini mencegah tablet lain mengambil alih ruangan hanya dengan
modal email + sandi ruangan.

### 3.7 Kiosk web (`/kiosk`, `/kiosk/setup`) — `client/kiosk/`
- Versi web dari tampilan kiosk, dipakai sebagai referensi desktop — yang
  dipakai tablet adalah APK React Native di repo `kioskapp`.
- `KioskApp.js`: layar kiosk (state hijau/kuning/merah/offline, chip
  NFC/LED, check-in); `kiosk-api.js`: panggilan API; `kiosk-session.js`:
  penyimpanan sesi; `kiosk-state.js`: mesin state + pemetaan kode LED.
- `/kiosk/setup` memaksa pairing perangkat baru (`forceProvision`).
- API: seluruh `/api/kiosk/*`.

### 3.8 404 — `client/core/NotFound.js`

## 4. Komponen bersama

| Komponen | Fungsi |
|---|---|
| `core/Menu.js` | Header + drawer. Item: Kalender; Manajemen & Laporan (ADMIN saja); Profil; Masuk/Daftar |
| `core/ProtectedShell.js` | Menghubungkan Socket.io saat area login aktif |
| `core/NotFound.js`, `core/PlaceholderPage.js` | Halaman 404 / placeholder |
| `components/common/AsyncState.js` | State loading/error standar |
| `components/common/ConfirmDialog.js`, `FormDialog.js`, `PasswordDialog.js` | Dialog standar |
| `components/common/LocalizedDataGrid.js` | Pembungkus DataGrid dengan lokalisasi |
| `components/common/FeedbackSnackbar.js` | Notifikasi |
| `components/common/LanguageSwitcher.js` | Ganti bahasa id/en |
| `theme.js` | Tema MUI (font Inter) |

## 5. Data & state

- **RTK Query** — `client/redux/services/`: `events.js`, `rooms.js`,
  `users.js`, `settings.js`, `kiosk-devices.js`.
- **Socket.io** — `client/redux/websocket.js`; dipakai untuk invalidasi tag
  sehingga kalender, tabel ruangan, dan daftar perangkat ikut segar.
- **Auth** — `client/auth/auth-helper.js`: JWT di `sessionStorage`
  (atau `localStorage` bila "Tetap masuk"), `ProtectedRoute` + `adminOnly`
  di `MainRouter.js`.
- **i18n** — `client/locales/{id,en}/`: `common`, `auth`, `calendar`,
  `management`, `report`, `kiosk`.

## 6. Catatan perubahan terbaru

- Halaman masuk dibuat ulang sesuai desain (logo The Prasada, alert gagal,
  tetap-masuk) + font Inter di-self-host.
- Status **Online/Offline** tablet dihitung live dan tampil di tab Perangkat
  Tablet serta kolom Tablet di tab Ruangan, dengan auto-refresh 15 detik.
- Akses kartu dipindahkan ke tab Pengguna (nomor kartu + flag kartu master);
  sub-menu Kartu Master dihapus dari UI.
- Switch **NFC** dihapus dari daftar perangkat karena NFC sudah ditangani
  aplikasi kiosk; switch LED tetap ada.
- **Status ruangan** tampil di sidebar kalender (auto-refresh 30 detik): nama
  ruangan, **Dipakai/Kosong**, siapa dan sampai jam berapa, plus status tablet
  online/offline. Event yang sudah check-in diberi tanda "✓ Sudah check-in"
  di kalender dan agenda.
- Aturan booking per lantai kerja ditegakkan di server (karyawan hanya lantai
  sendiri; admin bebas) dan diterapkan juga di UI serta pemesanan cepat kiosk.
- Endpoint kiosk tambahan: `POST /api/kiosk/events/extend`,
  `POST /api/kiosk/events/complete`, `POST /api/kiosk/events/instant`.

### Catatan pemakaian kiosk

"Pesan sekarang" di kiosk membuat event **sekaligus menandai check-in**
(orangnya sudah berada di ruangan), dan server mengirim invalidasi Socket.io
sehingga kalender CMS langsung memperbarui status ruangan tanpa refresh manual.

Pemakaian langsung selalu **berakhir di hari yang sama** (zona `APP_TIMEZONE`),
maksimal 4 jam atau sampai meeting berikutnya bila masih hari itu. Bila sisa
waktu hari ini kurang dari 1 menit, permintaan ditolak `NO_FREE_WINDOW`.
