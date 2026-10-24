# Versioning 360 Scheduler

Format versi: **`Ver.Rev`** (diucapkan "Ver tiga Rev lima").

- **Ver** = gelombang fitur besar yang menyelesaikan kemampuan baru bagi
  pemakai (milestone). Naik ketika gelombang tertutup dengan bukti siap.
- **Rev** = gelombang perbaikan di dalam Ver yang sama (patch review,
  perbaikan rilis). Naik per gelombang, bukan per commit.

Tiga tempat versi yang tetap sinkron saat menutup gelombang:

| Artefak | Tempat versi |
|---|---|
| CMS/API (`app_booking`) | `package.json` `version` + tabel riwayat di bawah |
| APK tablet (`kioskapp`) | `android/app/build.gradle`: `versionName` mengikuti `Ver.Rev`, `versionCode` naik 1 monoton |
| APK distribusi | `public/apk/kiosk-release.apk` di `app_booking` + riwayat di `public/apk/README.md` |

## Posisi saat ini (Ver 3 Rev 10)

- CMS + API: **Ver 3 Rev 10**, `package.json` `3.10.0`, ditampilkan di footer
  semua halaman CMS (dari package.json).
- APK kiosk: `versionName 1.3.1 / versionCode 12`, menampilkan ver + UUID
  perangkat di layar; string di res/values + values-en (bahasa ID/EN),
  panel AVAILABLE tidak meluber, dan ada tombol "Pilih waktu" untuk
  memesan ruangan hari ini dengan jam mulai/selesai sendiri.

## Riwayat

### Ver 1 - Rekonstruksi basis (selesai)
Migrasi DB, server paritas 32 rute, CMS seluruh halaman utama, hardening
keamanan (Fase 1-9 TODO).

### Ver 2 - Kios & pengalaman (selesai)
Fase 10A kios (pairing 1 tablet/ruangan, revocation, proyeksi privasi,
state warna) dan 10B UX (kalender, multi-day, recurring, i18n en/id).

### Ver 3 - Gelombang 2026-10 (selesai)
- Rev 1: Add Meeting rombak (zona waktu otomatis, One Time/Recurring,
  pisah tanggal/jam, 24 jam tanpa AM/PM), email tamu divalidasi client.
- Rev 2: jam tablet selaras server (`serverTime` + offset tersimpan).
- Rev 3: tablet dan laptop satu segment LAN (portproxy, IP statis,
  network security config APK), HTTPS server + trust anchor CA tablet.
- Rev 4: `npm audit fix` non-breaking (temuan 22 menjadi 3, dev-only).
- Rev 5: README baru, skrip deploy Ubuntu 22.04, tombol unduh APK di CMS,
  APK masuk distribusi `/apk/kiosk-release.apk`.

### Ver 3 Rev 6 - 2026-10-23 (selesai)
- FormDialog CMS diperbaiki: DialogContent tidak mendukung prop component
  sehingga tidak pernah ada <form> (tombol Kirim mati di semua dialog).
- CORS origin LAN (lewat .env.local) masuk allowlist; endpoint
  /api/health tanpa kredensial untuk probe deploy.
- Kartu/password/role hardening review: daftar user non-admin tanpa kartu,
  master-card dicabut saat ganti/hapus, roleId non-UUID -> 400.
- Fitur kiosk: POST /api/kiosk/events/book (pilih jam mulai & selesai hari
  ini) + tombol "Pilih waktu" di tablet (APK 1.3 code 7).
- Gate kualitas: npm run verify, CI GitHub Actions, pin Node 20
  (.nvmrc), docs/handover/START-HERE.md.

### Ver 3 Rev 7 - 2026-10-24 (selesai)
- Employee ID (NIK) wajib saat create user dan unik tanpa memandang huruf
  besar/kecil; format huruf, angka, dash, atau underscore.
- Tabel `tbl_user_cards`: maksimal 2 kartu aktif per user; kartu hilang tetap
  tersimpan sebagai record `lost` dan tidak berlaku untuk kiosk/pintu.
- Migrasi 013 memindahkan kartu legacy `tbl_users.card_number` ke tabel baru.
- CMS: field/kolom Employee ID, dialog kartu (tambah, tandai hilang, hitungan
  aktif), locale en/id. Unit 58/58, client 72/72, regresi 71/71, parity 8/8.
- Self signup menjadi **toggle admin** (`self_signup_enabled`, default mati):
  tombol Daftar dan halaman `/signup` hilang saat mati, dan endpoint
  `POST /api/auth/signup` menolak `403 SIGNUP_DISABLED`. Tab Pengaturan di
  Manajemen menampilkan switch-nya; akun tetap bisa dibuat admin lewat tab
  Pengguna.

### Ver 3 Rev 8 - 2026-10-24 (selesai)
- Role baru `receptionist` (non-admin): boleh membuat booking **atas nama
  karyawan lain**, hanya untuk ruangan di lantainya sendiri.
- `POST /api/events` menerima `organizer_email` (admin/resepsionis); organizer
  tetap karyawan, kolom baru `tbl_events.booked_by` mencatat resepsionis untuk
  audit. Resepsionis bisa melihat/mengubah booking yang ia buat; admin tetap
  penuh; user biasa tetap hanya lantainya sendiri.
- CMS: opsi role Resepsionis, field **"Pesan untuk karyawan"** (autocomplete,
  create-only), filter ruangan sesuai lantai resepsionis, tampilan
  **"Dipesan oleh"**, dan panel **Floor groups** di Pengaturan (lantai,
  ruangan, karyawan, resepsionis, peringatan tanpa lantai).
- Migrasi `015_receptionist_on_behalf.sql`. Bukti: unit 74/74, client 80/80,
  regresi 77/77, parity 8/8; alur demo (booking lt.2 untuk karyawan lt.1
  berhasil, lt.3 ditolak) dan pairing tablet utuh.
- Patch `3.8.1`: `employee_id` mengizinkan titik agar kode HR BioTime
  (contoh `001-01.25`) bisa dipakai langsung.
- Patch `3.8.2`: kartu yang ditandai `lost` bisa **diaktifkan kembali** bila
  ditemukan (status `active`, `lost_at` dikosongkan, nomor kembali ke master
  pintu), dengan syarat slot aktif masih < 2. Endpoint `PATCH .../cards/:id`
  menerima `lost`/`active`; CMS menampilkan tombol **Aktifkan kembali**.
  Bukti: unit 74/74, client 80/80, regresi 78/78, parity 8/8, uji demo
  lost → active berhasil.


### Ver 3 Rev 9 - 2026-10-24 (selesai)
- Migrasi `016_must_change_password.sql`: kolom `must_change_password`.
- Akun hasil impor dan akun yang di-reset admin wajib mengganti password saat
  login pertama. Server menolak endpoint lain dengan `403 PASSWORD_CHANGE_REQUIRED`
  (kecuali ganti password sendiri dan signout); ganti sendiri menghapus flag.
- Admin dapat **mencentang/mematikan** “Wajib ganti kata sandi” di form
  Pengguna (`POST/PUT /api/users` menerima `must_change_password`); create dan
  edit sama-sama mendukung.
- CMS menampilkan layar **wajib ganti password** sebelum halaman lain, dengan
  locale en/id; header disembunyikan agar tidak memanggil API yang diblokir.
- Rencana impor 243 akun memakai password awal `123456Ab` (bcrypt) dan
  `must_change_password=true`.
- Bukti: unit 74/74, client 81/81, regresi 81/81, parity 8/8; uji API
  login → 403 → ganti → 200 berhasil, dan admin dapat mengubah flag.
- Kit operasional: `backup-db.sh` + `restore-db.sh` + systemd timer harian,
  `preflight-import.mjs`, dan `import-bjb-users.mjs` (dry-run default,
  `--apply` hanya dengan `IMPORT_TARGET_DB` dan bukti backup).
- Kit fresh install 3.9.0: plan clean slate 238 create + 198 kartu,
  `import-fresh-assets.mjs` untuk 11 ruangan, 5 akun admin/resepsionis, dan
  24 master card. Event historis tidak dimigrasikan.
- Patch `3.9.1`: branding user-facing menjadi **RoomBooking** (tanpa spasi);
  judul dokumen, footer CMS, layar kiosk, dan label APK memakai nama baru.
  Nama teknis (database/service/repo) tidak diubah.
### Ver 3 Rev 10 - 2026-10-24 (selesai)
- Migrasi `017_initial_setup.sql`: kolom `tbl_app_settings.setup_completed`.
- Endpoint publik `GET /api/setup/status` dan `POST /api/setup` untuk membuat
  admin pertama di instalasi baru; setelah selesai endpoint terkunci
  (`409 SETUP_COMPLETED`). Setup juga membaca keberadaan admin aktif agar DB
  lama/seed tidak membuka form bootstrap.
- CMS: halaman `/setup` + gate yang mengarahkan instalasi baru ke setup dan
  mengunci `/setup` setelah selesai; locale en/id, tampilan selaras Signin.
- Bukti: unit 79/79, client 88/88, regresi 83/83, parity 8/8.

## Cara naikkan

1. Rev naik ketika satu patch review atau gelombang perbaikan ditutup
   dan lulus verifikasi (build + regresi).
2. Ver naik ketika kemampuan baru mulai dipakai orang di luar tim
   (kios hidup di tablet produksi, CMS terpasang di server produksi).
3. `versionCode` APK naik satu setiap build release yang ditebar, tanpa
   melompat, tidak turun, dan tidak me-reset.
