# CMS / Web Admin `app_booking` — breakdown halaman

Dokumen ini memetakan halaman-halaman web admin (CMS) beserta isi, API, dan
lokasi kodenya. Versi yang didokumentasikan: CMS/API **3.11.0** (Ver 3 Rev 12).
Terakhir diperbarui: 2026-10-25.

## 1. Ringkasan teknis

Tema CMS disamakan dengan tablet kios (dark #11151B, aksen #3DDC84/#2FB46A,
Public Sans); sumber token ada di `client/theme.js` dan sejajar dengan
`App.tsx` kioskapp serta halaman masuk. Lihat `docs/VERSIONING.md` untuk
versi yang ditampilkan di footer.

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
/signin                Masuk                    (publik, tanpa header)
/signup                Daftar                   (publik; hanya bila toggle self signup aktif)
/setup                 Setup awal               (publik; hanya saat instalasi baru)
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
- Jika `user.mustChangePassword` aktif (akun impor/password di-reset admin), CMS
  menampilkan layar **wajib ganti password** sebelum halaman lain; server juga
  menolak endpoint lain dengan `403 PASSWORD_CHANGE_REQUIRED`.

### 3.2 Daftar (`/signup`) — `client/auth/Signup.js`
- Hanya tersedia bila **Pengaturan → Izinkan pendaftaran mandiri** aktif.
  Saat mati, rute langsung diarahkan ke `/signin` dan tautan Daftar tidak
  dirender (menu maupun halaman masuk).
- API: `POST /api/auth/signup` (server juga menolak `403 SIGNUP_DISABLED`).

### 3.3 Kalender Rapat (`/`) — `client/calendar/`
- Klik event membuka **drawer detail** (judul, waktu, ruangan, peserta, status
  check-in) dengan aksi **Edit** dan **Batalkan** (sesuai hak organizer/admin).
- **Form tambah/edit meeting** (`EventEditor.js`):
  - **Tanggal dipisah dari jam** — Tanggal mulai, Tanggal selesai, Jam mulai,
    Jam selesai. Jam memakai **TimePicker 24 jam** (`ampm={false}`, format
    `HH:mm`, tanpa AM/PM; mencakup 00:00–23:59, `24:00` teknis = 23:59). Form
    kosong default **seharian penuh** (00:00–23:59); klik slot kalender tetap
    memakai jam slot.
  - **Mode Recurring** — field **Tanggal selesai disembunyikan** (ditampilkan
    sebagai keterangan "mengikuti Ulangi sampai") karena rentang pengulangan
    dikuasai **Ulangi sampai**; durasi tiap occurrence mengikuti Jam
    mulai–Jam selesai hari pertama.
  - **Undang peserta** — pengguna yang sudah terdaftar cukup dipilih dari
    saran (kirim lewat akun). Tamu tanpa akun wajib ditulis **email lengkap**
    (mis. `harun@contoh.id`); sebelum kirim, editor memvalidasi dan
    menampilkan chip yang salah ketik (`editor.guestInvalid`), bukan lagi
    pesan generik `INVALID_VISITOR`.
  - **Pesan untuk karyawan** — hanya muncul saat membuat meeting untuk role
    **Admin/Resepsionis**: cari karyawan (min. 2 karakter), lalu simpan.
    Organizer tetap karyawan tersebut dan server mencatat `booked_by` =
    resepsionis; ruangan resepsionis dibatasi ke lantainya. Booking tetap
    self-service bila field dikosongkan.
  - **Zona waktu dihapus** — server otomatis memakai zona waktu aplikasi
    (`APP_TIMEZONE`, default `Asia/Jakarta`); pengguna tidak lagi memilih
    Asia/Jakarta/UTC. Saat mengedit event lama, `timezone` tersimpan tetap
    dikirim agar occurrence tidak bergeser.
  - **Jenis booking**: `One Time` (sekali) dan `Recurring` (berulang) dengan
    pola **Harian / Mingguan / Bulanan**: interval "setiap N" (harian/mingguan/
    bulanan), hari pilihan untuk mingguan, dan untuk bulanan pilih **Pada
    tanggal yang sama** atau **Pada hari tertentu** (Senin ke-2, Jumat
    terakhir, dst). Berakhir dengan tanggal (`Ulangi sampai`; horizon server
    `RECURRENCE_MAX_DAYS` = 366 hari, maksimum occurrence 200). Pola bulanan
    yang hari tanggalnya tidak ada (mis. tgl 31) melompat ke bulan berikutnya
    yang punya tanggal itu.
- Saat membuat event, editor mengecek **konflik** dan menawarkan **ruangan lain
  yang kosong** pada jam tersebut (mengikuti lantai user dan kapasitas).
  Respons preview dibatasi `MAX_PREVIEW_CONFLICTS` (default 50) dan menyertakan
  `conflictTotal` + `conflictsTruncated`; editor menampilkan ringkasan bila
  konflik lebih banyak dari batas.
- Di layar sempit (<900 px) tampilan default otomatis **Agenda**.
- Papan jadwal dengan **ruangan sebagai resource** (FullCalendar
  resource-timeline, tampilan minggu).
- **Filter Building di sidebar sudah dihapus** (3.10.3). Sidebar kembali
  menampilkan seluruh ruangan yang boleh dipakai pengguna, tanpa pemilih
  gedung; pemfilteran tersisa adalah lantai (otomatis untuk non-admin) dan
  mode jadwal. Field `building` tetap ada di master ruangan dan tetap dipakai
  sebagai metadata, bukan filter kalender.
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
| Pengguna (`UserManagementSection.js`, `users/`) | CRUD user **beserta akses kartunya**: pencarian **nama/email/employee ID**, kolom **Role** (chip) + filter role yang bisa digabung dengan filter lantai, kolom nomor kartu, tombol **kartu master**, **kolom grup lantai** (pilih **Semua lantai**, lantai tertentu, atau belum diatur), dan **role Admin/Resepsionis/Pengguna**; ganti sandi, hapus. Tabel setinggi viewport dengan pagination **25/50/100**. | `/api/users` |
| Ruangan (`RoomManagementSection.js`) | CRUD ruangan: nama, gedung, lantai, **kapasitas**, fitur, email, sandi. **Kolom Tablet: Online/Offline/Belum ada/Dicabut**, auto-refresh 15 s | `/api/rooms`, `/api/kiosk/devices` |
| Perangkat Tablet (`KioskDeviceManagementSection.js`) | Daftar tablet: nama, ruangan, **Online/Offline/Dicabut/Kedaluwarsa**, switch **LED**, switch **Judul** (tampilkan/sembunyikan judul meeting — admin per perangkat), last seen, waktu pairing, cabut perangkat, tombol **Unduh APK Tablet** (tautan statik `/apk/kiosk-release.apk`, unduh saja). Auto-refresh 15 s | `/api/kiosk/devices`, `PATCH …/capabilities`, `DELETE …/:id` |
| Pengaturan (`SettingsSection.js`, `settings-form.js`) | **Global settings**: timer check-in, jendela check-in, timer kunci kiosk, timer LED, input meja, dan toggle pendaftaran mandiri. Panel **Floor groups sudah dihapus**. | `/api/settings` |

**Tab Pengguna (3.10.3).** Pencarian mencocokkan nama, email, dan employee ID
(minimal satu karakter, case-insensitive). Filter role memakai chip role yang
sama seperti kolom tabel dan digabung dengan filter "hanya yang belum punya
lantai" secara AND. `GET /api/users` untuk admin kini menyertakan `role_id`
sehingga kolom/filter role tidak perlu memanggil endpoint lain. Tabel memakai
`height: calc(100vh - 280px)` (min. 420 px) dan pilihan pagination 25/50/100.

**Tab Pengaturan (3.10.3).** Semua field berlaku global untuk seluruh
ruangan dan tablet kios:

| Field | Arti |
|---|---|
| `not_checked_in_time_limit` | Menit setelah meeting mulai sebelum booking tanpa check-in dilepas (auto-release no-show). |
| `time_of_event_start_soon` | Menit sebelum meeting mulai saat check-in sudah dibuka (termasuk tombol check-in kiosk). |
| `lock_timer` | Menit sebelum kiosk kembali ke layar idle. |
| `led_timer` | Menit lampu indikator ruangan tetap menyala. |
| `table_input` | Boolean; menampilkan layar input meja di kiosk. |
| `self_signup_enabled` | Boolean; mengaktifkan halaman `/signup` dan `POST /api/auth/signup`. |

`PUT /api/settings` menolak update parsial: CMS mengirim **seluruh baris**
settings (nilai yang dimuat + field yang diubah + `id`), sehingga field warna
(`available_color`, `will_start_color`, `on_meeting_color`) dan
`setup_completed` ikut terkirim apa adanya. Timer wajib bilangan bulat > 0.

Form **Pengguna** juga memiliki switch **Wajib ganti kata sandi** (bisa
dicentang atau dimatikan). Bila aktif, pengguna harus mengganti password saat
login berikutnya sebelum bisa memakai halaman lain.

**Toggle "Judul" per perangkat** (migrasi `011_kiosk_show_subject.sql`,
kolom `tbl_kiosk_devices.show_subject`, default **tampil**): ketika aktif,
`/api/kiosk/schedule` mengirim `subject` (judul) dan `organizerName`
(organizer lengkap) ke tablet sehingga panel kiri menampilkan identitas
rapat serta bar durasi; ketika dimatikan, kedua field berisi `null` dan
tablet kembali menampilkan organizer nama depan seperti perilaku lama.
NFC tidak diatur dari CMS karena ditangani aplikasi kiosk.

**Akses kartu digabung ke tab Pengguna** (sub-menu "Kartu Master" dihapus dari UI):
nomor kartu tampil dan bisa dikoreksi di baris user, dan kartu bisa ditandai
**kartu master** dengan satu tombol. Di server, flag ini menulis/menghapus baris
`tbl_card_masters`; kartu master otomatis boleh membuka semua pintu. Endpoint
lama `/api/settings/card-master` tetap ada untuk kompatibilitas API. Kartu yang
ditandai **hilang** tetap tampil sebagai riwayat dan bisa **diaktifkan kembali**
bila ditemukan (selama kartu aktif user masih kurang dari 2).

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
| `core/Menu.js` | Header + drawer. Item: Kalender; Manajemen & Laporan (ADMIN saja); Profil; Masuk (Daftar hanya bila toggle self signup aktif) |
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

- **3.10.4 (Ver 3 Rev 11)**: rentang minggu kalender kini Senin–Minggu,
  sejalan dengan `firstDay` FullCalendar (memperbaiki minggu kosong saat
  tanggal terpilih hari Minggu dan occurrence daily hari Minggu). Kalender
  resepsionis terbuka pada **mode floor** (jadwal semua ruangan lantainya,
  digabung tanpa duplikat); admin `all`, karyawan `mine`. Dropdown/filter
  ruangan mengikuti lantai untuk karyawan maupun resepsionis, admin dan grup
  `all` melihat semua; placeholder filter menjadi “tanpa filter ruangan”.
  Booking atas nama kini tersimpan dengan payload bentuk objek sehingga
  organizer = karyawan dan `booked_by` = resepsionis. Preview ketersediaan
  tidak lagi men-disable form (fokus judul tidak terlepas).
- Halaman masuk dibuat ulang sesuai desain (logo The Prasada, alert gagal,
  tetap-masuk) + font Inter di-self-host.
- Status **Online/Offline** tablet dihitung live dan tampil di tab Perangkat
  Tablet serta kolom Tablet di tab Ruangan, dengan auto-refresh 15 detik.
- Akses kartu dipindahkan ke tab Pengguna (nomor kartu + flag kartu master);
  sub-menu Kartu Master dihapus dari UI.
- Switch **NFC** dihapus dari daftar perangkat karena NFC sudah ditangani
  aplikasi kiosk; switch LED tetap ada.
- **Mode jadwal**: "Jadwal saya" (default user), "Per ruangan", dan
  **"Semua jadwal"** khusus admin (default untuk admin). Server hanya
  mengizinkan `all=true` untuk role ADMIN; user biasa tetap dibatasi ke
  jadwalnya sendiri.
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

**Auto-release no-show:** meeting yang belum check-in sampai
`not_checked_in_time_limit` (default 15 menit) setelah jam mulai akan
**melepaskan ruangannya** (meeting tetap ada di kalender peserta). Pelepasan
berjalan tiap 60 detik di server dan dicek ulang setiap request jadwal kiosk,
sehingga ruangan langsung bisa dipakai lewat "Pesan sekarang".

Pemakaian langsung selalu **berakhir di hari yang sama** (zona `APP_TIMEZONE`),
maksimal 4 jam atau sampai meeting berikutnya bila masih hari itu. Bila sisa
waktu hari ini kurang dari 1 menit, permintaan ditolak `NO_FREE_WINDOW`.
