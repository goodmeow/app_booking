# Versioning RoomBooking

Format versi: **`Ver.Rev`** (diucapkan "Ver tiga Rev lima").

- **Ver** = gelombang fitur besar yang menyelesaikan kemampuan baru bagi
  pemakai (milestone). Naik ketika gelombang tertutup dengan bukti siap.
- **Rev** = gelombang perbaikan di dalam Ver yang sama (patch review,
  perbaikan rilis). Naik per gelombang, bukan per commit.

Tiga tempat versi yang tetap sinkron saat menutup gelombang:

| Artefak | Tempat versi |
|---|---|
| CMS/API (`app_booking`) | `package.json` `version` + `package-lock.json` (dua baris teratas) + tabel riwayat di bawah |
| APK tablet (`kioskapp`) | `android/app/build.gradle`: `versionName` mengikuti `Ver.Rev`, `versionCode` naik 1 monoton |
| APK distribusi | `public/apk/kiosk-release.apk` di `app_booking` + riwayat di `public/apk/README.md` |

## Posisi saat ini (Ver 3 Rev 12)

- CMS + API: **Ver 3 Rev 12**, `package.json` `3.11.0`, ditampilkan di footer
  semua halaman CMS (dari package.json).
- APK kiosk: `versionName 1.3.8 / versionCode 19`. Footer kios menampilkan
  versi APK + **versi CMS** (`v1.3.8 (19) · CMS 3.11.0`), bukan “perangkat …”.
  Tombol **Finish** tersembunyi di balik 5 tap pill **IN USE**, **+15 menit**
  wajib kartu organizer/peserta/master (diverifikasi server), tombol
  until-next hanya muncul bila ada jadwal berikutnya, dan siklus
  `/context` + `/schedule` dicoba 3× sebelum status `OFFLINE`.
  Bahasa ID/EN tetap memakai `res/values` + `values-en`; panel AVAILABLE
  tidak meluber dan tombol **Pilih waktu** tetap ada.
- Rev 12 masih terbuka: patch perbaikan UAT 3.10.4 + fitur/UX 3.11.0 / APK 1.3.8
  sudah lulus unit server 79/79, unit kiosk 21/21, client 98/98,
  regresi 87 tes (85 lulus, 2 skip sengaja karena dekat tengah malam),
  parity prepare 2/2 dan parity 8/8 (dijalankan 2026-10-25). Lihat
  `docs/release-v3.11.0.md` untuk isi rilis dan risiko yang belum diuji.

## Riwayat

### Ver 3 Rev 12 - 2026-10-25 (rilis saat ini)
Branding global (upload icon/logo/favicon/nama/judul tab), kalender 24 jam
dengan scroll, pengaturan hari pertama minggu, validasi start/end, format
tanggal DD-MMM-YYYY, language chip di footer, navbar sticky, dan APK 1.3.7
(hint Finish early, judul STARTING SOON, copy kartu per aksi). Detail:
`docs/release-v3.11.0.md`.

- Patch APK `1.3.8` (19), 2026-10-25: hint kartu kini menyebut
  organizer/peserta/master untuk check-in dan **+15 menit** (selaras aturan
  server), dan five-tap **Finish** sebelum jam mulai benar-benar membuka
  tombol saat jam mulai — tidak perlu five-tap kedua. Dipasang di tablet Lt3,
  footer `v1.3.8 (19) · CMS 3.11.0`; distribusi
  `public/apk/kiosk-release.apk` (21.513.747 byte, SHA-256
  `255c95755d606a2ab2cf90696e72f8f415b572a9fc78e2c114238e4788a025b0`).
- Patch server (belum di-commit saat catatan ini ditulis): impor CSV
  overwrite transaksional per baris sehingga konflik kartu membatalkan
  perubahan profil; kolom `floor` yang tidak ada mempertahankan lantai lama
  sedangkan sel kosong menghapusnya; impor menolak menurunkan admin aktif
  terakhir (`409 LAST_ADMIN`). Migrasi `021_protect_setup_admin.sql`
  menambah `tbl_users.is_protected`: akun admin hasil `/setup` dilindungi,
  `DELETE` mengembalikan `403 PROTECTED_ACCOUNT`, dan CMS menyembunyikan
  tombol Hapus untuk akun itu (UAT: ADMIN-001 terlindungi, delete 403).
  Commit kode server: `db57d7a` (impor transaksi + floor) dan `99d0043`
  (guard tes tengah malam).

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
- Deploy Docker Alpine: `deploy/docker/` (multi-stage `node:20-alpine`,
  `postgres:16-alpine`, `nginx:alpine`), entrypoint migrasi + seed role,
  initial setup teruji end-to-end. Bukti: DB kosong `required=true` → setup
  `201` → terkunci `409`, login `200`, 17 migrasi, APK tersaji.
- Patch `3.10.1`: setelah setup sukses CMS **auto-login** dan melakukan hard
  redirect ke kalender; menghilangkan layar putih/race cache gate dan tidak
  perlu mengetik ulang kredensial.
- Patch APK `1.3.2` (13): label **UP NEXT** tidak lagi menampilkan jam;
  jam tetap ada di bawah judul meeting.
- Patch `3.10.2`: `/api/kiosk/schedule` mengirim `checkedInAt`; tablet
  menampilkan **Started early · <jam check-in aktual>**, bukan jam mulai
  meeting. APK kiosk 1.3.3 (14).
- Patch `3.10.3`: CMS Pengguna (pencarian, filter/kolom role, tabel setinggi
  viewport), Pengaturan global (menggantikan panel Floor groups), filter
  Building di kalender dihapus. Kiosk 1.3.5: Finish jadi easter egg 5 tap pill
  IN USE, +15 menit wajib kartu, tombol until-next disembunyikan bila tidak ada
  jadwal, retry schedule 3x, label CMS version di footer.
  - Pengaturan global: `not_checked_in_time_limit`, `time_of_event_start_soon`,
    `lock_timer`, `led_timer`, `table_input`, `self_signup_enabled`;
    `PUT /api/settings` mengirim seluruh baris. Berkas/komponen Floor groups
    (`FloorGroupsSection.js`, `floor-groups.js`) dihapus.
  - API: `GET /api/users` (admin) menyertakan `role_id`;
    `POST /api/kiosk/events/extend` wajib `card_number`;
    `/api/kiosk/schedule` mengirim `checkedInAt`;
    `/api/kiosk/context` mengirim `cmsVersion`.
  - Bukti: unit 79/79, client 92/92, regresi 83/83, parity 8/8 (commit
    `00e39ed`, 2026-10-24); uji tablet +15 prompt kartu dan Finish easter egg.
- Patch APK `1.3.5` (16): LED menjadi opsional. `getStatus()` melaporkan
  `led`, `nfcHardware`, dan `nfcEnabled`; `setLed` tidak menulis bila path LED
  tidak ada, sehingga tablet tanpa LED tetap berjalan.

### Ver 3 Rev 11 - 2026-10-25 (terbuka)
- Patch `3.10.4` — perbaikan UAT kalender:
  - Rentang query mingguan kini **Senin–Minggu**, sama dengan grid
    FullCalendar locale `id`/`en-gb`; `startOfWeek` menerima parameter
    hari pertama (default `DEFAULT_WEEK_START_DAY = 1`) dan `MeetingWeek`
    mengoper nilai yang sama ke `firstDay`. Ini memperbaiki minggu kosong
    saat tanggal terpilih hari Minggu sekaligus occurrence **daily yang
    jatuh pada hari Minggu**.
  - Kalender resepsionis dibuka pada mode **floor schedule** (bukan “my
    schedule” yang kosong); admin `all`, karyawan `mine`. Mode floor
    mengambil jadwal per ruangan lantai itu dan menggabungkannya tanpa
    duplikat (`uniqueCalendarEvents`), plus tombol refresh sendiri.
  - Dropdown/filter ruangan mengikuti role dan lantai: karyawan dan
    resepsionis hanya ruangan lantainya, admin dan grup lantai `all` semua
    (`roomsForRole`, `canUseAllFloors`). Placeholder filter berganti dari
    “All rooms” menjadi “tanpa filter ruangan”.
  - **Booking atas nama tersimpan**: payload create memakai bentuk objek
    (bukan array per-attendee) saat `organizer_email` diisi, karena server
    hanya membaca field itu dari objek tunggal; organizer = karyawan,
    `booked_by` = resepsionis.
  - **Fokus judul meeting** tidak lagi terlepas: preview ketersediaan di
    latar belakang tidak men-disable form; hanya simpan/hapus yang mengunci
    (`editor-lock.js`).
- Patch APK `1.3.6` (17):
  - Closing UAT: 5 tap pill **IN USE** sebelum jam mulai kini menampilkan
    **“Tombol Selesai aktif pukul HH:MM”**, bukan diam saja.
  - Judul meeting tampil di bawah pill saat **STARTING SOON** (tetap kosong
    bila `show_subject` mati).
  - Copy popup kartu dipisah per aksi: check-in meminta **kartu pemesan
    ruangan**, +15 menerima **kartu peserta atau kartu master**.
- Bukti: unit server 79/79, unit kiosk 21/21, client 96/96 (dijalankan
  ulang 2026-10-25 pada build copy). Regresi/parity belum dijalankan.
- Belum masuk wave ini: pengaturan global hari pertama minggu, branding
  dapat diganti (icon/logo/favicon/judul tab), navbar sticky, chip bahasa
  di footer, dan uji perangkat untuk layout kiosk baru.

## Cara naikkan

1. Rev naik ketika satu patch review atau gelombang perbaikan ditutup
   dan lulus verifikasi (build + regresi).
2. Ver naik ketika kemampuan baru mulai dipakai orang di luar tim
   (kios hidup di tablet produksi, CMS terpasang di server produksi).
3. `versionCode` APK naik satu setiap build release yang ditebar, tanpa
   melompat, tidak turun, dan tidak me-reset.
