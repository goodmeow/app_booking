# Versioning RoomBooking

Format versi: **`Ver.Rev`** (diucapkan "Ver tiga Rev lima").

- **Ver** = gelombang fitur besar yang menyelesaikan kemampuan baru bagi
  pemakai (milestone). Naik ketika gelombang tertutup dengan bukti siap.
- **Rev** = gelombang perbaikan di dalam Ver yang sama. **Naik setiap ada
  perubahan yang dikirim** (satu gelombang perubahan = satu Rev), bukan
  menunggu rilis besar.

Tiga tempat versi yang tetap sinkron saat menutup gelombang:

| Artefak | Tempat versi |
|---|---|
| CMS/API (`app_booking`) | `package.json` `version` + `package-lock.json` (dua baris teratas) + tabel riwayat di bawah |
| APK tablet (`kioskapp`) | `android/app/build.gradle`: `versionName` mengikuti `Ver.Rev`, `versionCode` naik 1 monoton |
| APK distribusi | `public/apk/kiosk-release.apk` di `app_booking` + riwayat di `public/apk/README.md` |

Alur default setiap bump versi (wajib, bukan opsional):

1. `npm run format` — rapikan file JS/JSON/CSS/HTML dengan Prettier.
   `client/tests/`, `server/tests/`, dan `docs/design/` dikecualikan
   (`.prettierignore`), karena tes dan mockup dibaca sebagai prosa.
2. `npm run verify` — sudah mencakup `format:check`, build client, build server,
   tes client, dan tes unit server.
3. Naikkan versi, lalu tambah baris riwayat di bawah.

## Posisi saat ini (Ver 3 Rev 32)

- CMS + API: **Ver 3 Rev 32**, `package.json` `3.15.16`, ditampilkan di footer
  semua halaman CMS (dari package.json). Rev 32 membatasi tumpukan event di
  kalender mingguan. Rev 26 menata tombol aksi Pengaturan Global
  dan menampilkan nomor kartu penuh di log audit. Rev 24 menghapus mock logo bawaan di halaman Branding. Rev 23 menambah favicon huruf awal saat aset favicon kosong. Rev 22 melengkapi aturan aset di halaman login (tampilkan
  yang ada, lockup resmi hanya bila kosong). Rev 21 memakai lockup
  Prasada berwarna di halaman login. Rev 20 mengatur teks brand di navbar berdasarkan aset custom. Rev 19 menambahkan baris audit untuk rilis ruangan otomatis. Rev 18 hanya mengecualikan folder tes dari Prettier. Gelombang Rev 17 berisi perbaikan
  audit kode (respons bentrok ruangan 409, check-in booking instan dalam satu
  transaksi, pelaku pada audit kartu, CSP, indeks rentang jadwal, hapus kode
  mati). Rev 16 di dalamnya: rilis booking no-show yang transaksional, 28
  fungsi PL/pgSQL legacy dihapus, `/apk/index.html` membaca `latest.json`, dan
  APK RustDesk dihapus. Detail di riwayat 2026-11-05.
- APK kiosk: **tidak berubah di Rev 16/17** — tetap `versionName 1.5.0 /
  versionCode 27`, tidak perlu rebuild atau tebar ulang. Footer kios menampilkan
  versi APK + **versi CMS** (`v1.5.0 (27) · CMS 3.15.16`). Build membawa pill `TERSEDIA` 44 px, copy
  netral **Siap digunakan / Belum ada jadwal berikutnya**, dan context kiosk
  yang aman. Kiosk memeriksa `/apk/latest.json` tiap 6 jam; bila ada versi
  lebih baru, operator menekan tombol Update, APK diunduh, SHA-256 dan
  signature diverifikasi, lalu installer Android dibuka. Layar kuning
  *upcoming* memakai judul dan countdown lebih ringkas plus jarak tombol aksi,
  sehingga tombol tidak menabrak teks di atasnya. Resepsionis dapat
  membatalkan/mengubah meeting karyawan di lantai yang menjadi aksesnya; CMS
  memakai flag `can_mutate` dari server agar tombol Edit/Batalkan konsisten
  dengan izin backend. Menu tablet (ketuk jam lima kali) punya tombol
  **Cek update**; bila manifest lebih baru, tombol berubah menjadi kuning
  **Perbarui**. Di sampingnya ada tombol **Tentang** yang membuka versi
  aplikasi, versi CMS, dan lisensi pustaka APK.
- Ver 3 Rev 15 mencakup toggle aksi per tablet, buka pintu hanya untuk kartu
  meeting aktif/kartu master, dan toast hasil aksi di panel kanan. Ver 3 Rev 14 mencakup revamp UI Ant Design 5, proteksi super admin, validasi API, dan hardening storage/kiosk. Ver 3 Rev 13 mencakup matrix menu per role, `super_admin` dari akun setup,
  multi-lantai (`tbl_users.floors`), akses resepsionis per lantai, audit log,
  dan pengerasan security: rate-limit proxy, reset sandi, pairing kiosk,
  backup retry, auto-release, serta filter status ruangan per floor.

### Face unlock (2026-11-02)

- API: `POST /api/kiosk/face-unlock` di `app_booking` meneruskan frame kamera
  tablet ke face service, mencocokkan wajah ke booking aktif di ruangan kiosk,
  dan mengembalikan izin. Audit biometrik ditulis face service ke
  `tbl_face_verify_log`.
- Deploy: service `face` ditambahkan ke `deploy/docker/compose.alpine.yaml`
  (internal, `FACE_SERVICE_URL=http://face:8090`). Model ONNX diunduh lewat
  `app_faceunlock-service/fetch-models.sh` dan di-mount read-only; kunci embedding
  (`ALPINE_FACE_EMBEDDING_KEY`) hanya ada di `.env` lokal.
- APK kiosk: **1.5.0 / 27** (`versionCode` 27). Pemindaian wajah memakai kamera
  depan, 3 frame 640×480 JPEG; jatuh ke kartu bila `no_match`/`no_face`/
  `ambiguous`/izin ditolak/service mati.
- Versi CMS/API (`package.json`) belum dinaikkan untuk gelombang ini; perubahan
  API dan APK dicatat di sini sampai penutupan Ver berikutnya.
- Hardening audit 2026-11-03: face service menolak melayani (`503`) bila
  `FACE_INTERNAL_TOKEN` kosong, `/reload` ikut memeriksa token, token
  dibandingkan dengan `hmac.compare_digest`, dan frame dibatasi 3 per request
  serta 2.000.000 karakter base64 sebelum di-decode. Rate-limit dipindah ke
  Postgres (`tbl_rate_limit_buckets`, migrasi
  `028_rate_limit_buckets.sql`) dengan `scope` per limiter, sehingga batas
  tetap satu meski app berjalan lebih dari satu proses. Bukti: unit server
  **87/87**, guard face **6/6**, dua proses berbagi satu budget (proses kedua
  langsung `429`), `/reload` tanpa token `401`, 4 frame `422`.
- Bukti 2026-10-30 di checkout build `/home/goodmeow/build/app_booking`
  (tag `v3.13.0`): unit server **85/85**, unit kiosk **21/21**, client
  **99/99**, regresi **105/105** (0 skip), parity prepare **2/2**, parity
  **8/8**; `build:client` dan `build:server:check` lulus, lint 0 error
  (warning tersisa). Unit izin event **9/9**, kontrak kalender **14/14**
  setelah perubahan `can_mutate`. Migrasi terakhir:
  `026_event_room_timezone.sql`.
- Distribusi APK, 2026-10-29 (commit `941a537`): paket
  `public/apk/kiosk-release.apk` **1.4.5 (26)** 21.530.462 byte, SHA-256
  `adb6af93a49f592f4c4767895605248ed963988d2875b0ff44ebe457c1a338d6`,
  plus halaman unduh `public/apk/index.html` (`/apk/index.html`) dan
  `public/apk/latest.json`. Isi patch: blok **NEXT UP** tidak lagi menabrak
  teks status di panel merah/hijau.
  Sebelumnya 1.4.4 (25) 21.530.390 byte, 1.4.2 (23) 21.521.724 byte,
  1.4.1 (22) 21.521.483 byte, 1.4.0 (21) 21.521.436 byte.
- Status UAT 2026-10-30: **UAT local test bed** `http://127.0.0.1:8082` dan
  **UAT live** `http://<uat-host>:8082` sama-sama tag `v3.13.0`, app/web/db
  sehat, `/api/health` 200. `TRUST_PROXY=1`, `FLOOR_RESTRICTION=true`;
  database UAT dipertahankan. Alur `npm run demo` tidak lagi dipakai; skrip
  demo hanya tersisa untuk harness unit/parity.
- Revamp CMS Ant Design 5 sudah **merge ke `master`** dan dirilis sebagai
  **`v3.13.0` / Ver 3 Rev 14** (2026-10-30). APK tetap 1.4.5 (26);
  `public/apk` mengikuti paket kiosk yang sama.

## Riwayat

### Ver 3 Rev 32 - 2026-11-05 (rilis saat ini)
- **Kalender mingguan tidak lagi pecah jadi strip tipis**: `eventMaxStack={3}`
  membatasi tiga event per tumpukan, sisanya masuk tautan `+N` bawaan
  FullCalendar. Sebelumnya enam meeting pada jam yang sama menjadi enam kolom
  sempit dan memanjang. `package.json` 3.15.16; APK tetap 1.5.0 (27).
- Verifikasi: cek visual UAT lokal dengan enam event tumpang tindih → 3 event +
  `+3`; data uji dihapus lagi.

### Ver 3 Rev 31 - 2026-11-05 (rilis sebelumnya)
- **Halaman login mengikuti aturan navbar**: bila aset custom belum lengkap
  (mis. hanya ikon), nama brand tampil di bawah aset; bila keduanya lengkap,
  nama disembunyikan; bila tidak ada aset sama sekali, tetap memakai lockup
  Prasada berwarna/putih. `package.json` 3.15.15; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau dan cek visual UAT lokal.

### Ver 3 Rev 30 - 2026-11-05 (rilis sebelumnya)
- **Versi APK di halaman Tentang tidak lagi hardcode**: `KIOSK_APP_VERSION`
  sekarang membaca `public/apk/latest.json` saat build, jadi label mengikuti
  APK yang benar-benar diterbitkan (sebelumnya tertulis 1.4.5 (26) padahal
  distribusi 1.5.0 (27)). `package.json` 3.15.14; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau; halaman Tentang di UAT lokal menampilkan
  Kiosk APK 1.5.0 (27).

### Ver 3 Rev 29 - 2026-11-05 (rilis sebelumnya)
- **Tata letak Pengaturan Global diperbaiki setelah cek visual**: header
  Branding dan Akses peran memakai flex sehingga tombol simpan tidak lagi
  turun ke bawah deskripsi, dan label aset tidak lagi menempel dengan teks
  status ("IconNot set" menjadi label lalu "Not set" di baris berikutnya).
  `package.json` 3.15.13; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau; cek visual Playwright di UAT lokal.

### Ver 3 Rev 28 - 2026-11-05 (rilis sebelumnya)
- **Daftar perangkat tidak lagi berubah posisi tiap refresh**: urutan SQL
  diganti dari `last_seen_at` (berubah setiap polling 15 detik) menjadi
  `floor, room name, created_at`.
- **Filter lantai** di tab Perangkat: pilihan lantai diambil dari data yang
  dimuat, disaring di klien, dengan opsi "Semua lantai". `package.json`
  3.15.12; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau dan UAT lokal menyajikan 3.15.12.

### Ver 3 Rev 27 - 2026-11-05 (rilis sebelumnya)
- **Tab perangkat berganti nama dan menampilkan lantai**: "Tablet Devices" /
  "Perangkat Tablet" menjadi **Devices** / **Perangkat**; tabelnya menambah
  kolom **Lantai** yang mengikuti `floors` akun ruangan (`listKioskDevices`
  kini mengirim `room_floor` dan `room_floors`). `package.json` 3.15.11; APK
  tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau dan UAT lokal menyajikan 3.15.11.

### Ver 3 Rev 26 - 2026-11-05 (rilis sebelumnya)
- **Tombol aksi Pengaturan Global**: simpan pengaturan pindah ke header kartu
  **Umum**, tombol **Backup sekarang** diberi warna primer, dan tombol simpan
  **Akses peran** pindah ke baris judul bagiannya.
- **Log audit tanpa penyamaran**: nomor kartu ditampilkan penuh karena tab ini
  hanya bisa dibuka `super_admin`; `maskedCard` dihapus dari
  `user.service.js` dan `setting.controller.js`. `package.json` 3.15.10; APK
  tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau dan UAT lokal menyajikan 3.15.10.

### Ver 3 Rev 25 - 2026-11-05 (rilis sebelumnya)
- **Tombol simpan Branding pindah ke baris judul**: di Pengaturan Global, judul
  bagian dan tombol **Simpan** kini satu baris (judul kiri, tombol kanan),
  sama seperti tombol **Backup sekarang** di kartu Backup. `package.json`
  3.15.9; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau dan UAT lokal menyajikan 3.15.9.

### Ver 3 Rev 24 - 2026-11-05 (rilis sebelumnya)
- **Pengaturan → Branding tidak lagi menampilkan mock logo bawaan**: slot aset
  yang kosong tertulis "Belum ada", dan tombol reset dinamai **Hapus gambar**
  karena memang menghapus aset. `package.json` 3.15.8; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau dan UAT lokal menyajikan 3.15.8.

### Ver 3 Rev 23 - 2026-11-05 (rilis sebelumnya)
- **Favicon kosong memakai huruf awal brand**: `initialFaviconSource()` membuat
  tile SVG (gunmetal + emas) dari huruf pertama `brand_name`, dipakai hanya bila
  tidak ada aset `favicon` custom. Atribut `type="image/png"` pada `<link rel=icon>`
  dihapus agar data URI tidak ditolak. `package.json` 3.15.7; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau (101 client, 95 unit) dan UAT lokal
  menyajikan 3.15.7.

### Ver 3 Rev 22 - 2026-11-05 (rilis sebelumnya)
- **Aturan aset di halaman login disamakan dengan navbar**: tampilkan aset custom
  yang ada (mark dan/atau wordmark), dan pakai lockup resmi Prasada hanya bila
  tidak ada aset custom sama sekali. `package.json` 3.15.6; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau (100 client, 95 unit) dan UAT lokal
  menyajikan 3.15.6.

### Ver 3 Rev 21 - 2026-11-05 (rilis sebelumnya)
- **Halaman login memakai lockup "The Prasada" berwarna** saat `mark`+`wordmark`
  belum lengkap: `the-prasada-logo-colour.png` di tema terang, versi putih di
  tema gelap (sebelumnya logo putih tampil di atas kartu putih sehingga tidak
  terlihat). Aset custom tetap menang bila keduanya sudah diunggah.
  `package.json` 3.15.5; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau (97 client, 95 unit) dan UAT lokal
  menyajikan 3.15.5.

### Ver 3 Rev 20 - 2026-11-05 (rilis sebelumnya)
- **Teks brand di navbar mengikuti aset custom**: bila `mark` dan `wordmark`
  sudah diunggah, teks "RoomBooking" disembunyikan; bila belum lengkap, teks
  tetap tampil; bila tidak ada aset sama sekali, navbar hanya menampilkan teks
  (fallback gambar tidak dipakai di navbar). `package.json` 3.15.4; APK tetap
  1.5.0 (27).
- Verifikasi: `npm run verify` hijau.

### Ver 3 Rev 19 - 2026-11-05 (rilis sebelumnya)
- **Rilis ruangan otomatis kini tercatat di Log Audit**: satu baris
  `event.room_auto_release` per meeting yang dilepas, dengan `actor_name`
  `auto-release` (actor id null). Tanpa ini tidak ada jejak kenapa ruangan
  hilang. `package.json` 3.15.3; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau; di UAT lokal satu meeting no-show
  menghasilkan baris audit tersebut.

### Ver 3 Rev 18 - 2026-11-05 (rilis sebelumnya)
- **Folder tes dikecualikan dari Prettier**: `client/tests/` dan `server/tests/`
  masuk `.prettierignore`, jadi `npm run format` / `format:check` tidak lagi
  menata ulang tes. `package.json` naik ke `3.15.2`; APK tetap 1.5.0 (27).
- Verifikasi: `npm run verify` hijau sebelum perubahan ini; setelahnya
  `format:check` tetap "All matched files use Prettier code style!".

### Ver 3 Rev 17 - 2026-11-05 (rilis sebelumnya)
- **Perbaikan audit kode**: `addAttendee` memetakan pelanggaran jadwal ruangan
  ke `409 ROOM_CONFLICT` (sebelumnya 500); booking instan kiosk menandai
  check-in di transaksi yang sama dengan pembuatan booking; audit
  tambah-kartu kini mencatat pelaku; CSP diaktifkan di API dan nginx; migrasi
  `031_events_period_index.sql` menambah indeks GiST untuk rentang jadwal;
  kode mati (5 export + 140 entri locale) dihapus; `.env.example` dan
  `dist/` baseline diperbaiki (`SHA256SUMS` kini lolos verifikasi).
- `package.json` naik ke `3.15.1`; APK tidak berubah (tetap 1.5.0 / 27).
- Verifikasi 2026-11-05: `test:server:unit` 95/95, `test:client` 96/96,
  `build:client` dan `build:server:check` lolos, lint 0 error (48 warning).
  UAT lokal: migrasi 030 + 031 terpasang (31 baris `schema_migrations`),
  123 event utuh, semua container `healthy`, CSP aktif di `/`,
  `/index.html`, dan `/api/health`, `/apk/kiosk-release.apk` tetap
  21.531.173 byte. Uji DB terpisah: `addAttendee` yang bentrok ruangan kini
  `409 ROOM_CONFLICT`, booking instan tersimpan dengan `checked_in` terisi.

### Ver 3 Rev 16 - 2026-11-05 (rilis sebelumnya)
- **Rilis booking no-show diperbaiki**: `releaseAbandonedRoomBookings` kini
  melepas ruangan dan menandai detail booking dalam satu transaksi, sehingga
  ruangan tidak bisa "terkunci kembali" oleh meeting yang tidak check-in bila
  proses terputus di tengah.
- **28 fungsi PL/pgSQL legacy dari `bjb.sql` dihapus dari skema**:
  `database/migrations/004_functions.sql` dan
  `database/tests/003_function_contracts.sql` dihapus dari repo, dan migrasi
  `030_drop_legacy_functions.sql` menghapus fungsi itu di database yang sudah
  terpasang. Alasan: tidak pernah dipanggil aplikasi dan menerima potongan SQL
  sebagai argumen.
- **Halaman `/apk/index.html` membaca `public/apk/latest.json`** (versi,
  versionCode, sha256, url), sehingga teks versi tidak lagi diedit manual di
  beberapa tempat.
- **APK RustDesk dihapus** dari halaman distribusi: berkas
  `public/apk/rustdesk-armv7.apk` dan tombol unduhnya tidak ada lagi.
- **Catatan cakupan**: antarmuka pengguna hanya APK; admin memakai CMS. Web
  kiosk `/kiosk` tetap ada sebagai referensi, bukan produk yang didistribusikan.
- **APK tidak berubah di gelombang ini**: tetap `versionName 1.5.0 /
  versionCode 27` (paket `public/apk/kiosk-release.apk` yang sama). Tidak ada
  rebuild APK yang diperlukan untuk Rev 16.
- Verifikasi Rev 16 dilaporkan di baris Rev 17 (satu rangkaian uji).

### Ver 3 Rev 15 - 2026-11-04 (rilis sebelumnya)
Toggle aksi per tablet: tombol **30 menit/sampai jam X** dan **Pilih waktu**
dapat dimatikan dari CMS Tablet Devices (migrasi 029). Buka pintu saat ada
meeting aktif hanya menerima kartu organizer/attendee meeting itu atau kartu
master. Toast hasil aksi di panel kanan (hijau sukses, merah ditolak) dengan
teks tetap dan warna berbeda. Bukti: unit server 93/93, client 99/99, regresi
106/106, kiosk tsc + 21/21 + 3/3 + 3/3. Deploy ke UAT live 10.10.42.8.
- APK distribusi: `public/apk/kiosk-release.apk` **1.5.0 (27)** 21.531.173
  byte, SHA-256
  `be42fd3599658724db41ddb16f82c12bde90f29d914f6c023c6dcaa49ac98c96`,
  build tag `1.5.0-27-982a4df`. `latest.json` diperbarui sehingga tablet
  menawarkan update otomatis.

### Ver 3 Rev 14 - 2026-10-30 (rilis sebelumnya)
Revamp UI CMS ke Ant Design 5 (light/dark), agenda/kalender, users, settings,
branding, role matrix, audit, report, dan web kiosk. Hardening: proteksi super
admin, validasi ID/payload, detail lantai khusus resepsionis, kartu lost,
storage browser, refresh kiosk, backup advisory lock, audit retention, dan
migrasi 026 timezone. Bukti: client 99/99, server 85/85, regresi 105/105,
parity 8/8. APK tetap 1.4.5 (26).

- Patch `3.13.1` (2026-11-03): penanda jam sekarang di kalender FullCalendar
  memakai warna error (merah) agar tidak tertukar dengan agenda dan border.
  Tidak ada perubahan API/migrasi; deploy ulang image `app`/`web` UAT.

### Ver 3 Rev 13 - 2026-10-28 (rilis sebelumnya)
Matrix menu, super admin, multi-lantai, audit, hardening security, dan halaman
Tentang & Lisensi. APK 1.4.5 (26), build tag `1.4.5-26-a6390a2`.

- Patch `3.12.1` (2026-10-28): tag rilis CMS untuk halaman Tentang &
  Lisensi serta image UAT dengan perbaikan CVE. APK 1.4.5 (26) memperbaiki
  tumpang tindih blok NEXT UP di panel status kiosk.

### Ver 3 Rev 12 - 2026-10-25 (rilis sebelumnya)
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
- Patch server: impor CSV
  overwrite transaksional per baris sehingga konflik kartu membatalkan
  perubahan profil; kolom `floor` yang tidak ada mempertahankan lantai lama
  sedangkan sel kosong menghapusnya; impor menolak menurunkan admin aktif
  terakhir (`409 LAST_ADMIN`). Migrasi `021_protect_setup_admin.sql`
  menambah `tbl_users.is_protected`: akun admin hasil `/setup` dilindungi,
  `DELETE` mengembalikan `403 PROTECTED_ACCOUNT`, dan CMS menyembunyikan
  tombol Hapus untuk akun itu (UAT: ADMIN-001 terlindungi, delete 403).
  Commit: server `37cebaa` (impor transaksi + floor) + `9eb8c37` (proteksi
  setup admin + LAST_ADMIN), test `678ab49`, APK `6476efc`, docs `3d40836`.
- Status UAT Docker, 2026-10-26 (tanpa naik versi): CMS/API di stack Docker
  Compose VM Linux port `8082`; setup admin + impor user bersih; tablet
  dipairing; akses pintu terbukti end-to-end lewat relay CH340. Angka tes
  tetap regresi 87/87, client 98/98, server unit 79/79, kiosk 21/21, parity
  8/8. Sisa: DNS + vhost `<uat-domain>`, training formal, go-live.

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
    `9d96805`, 2026-10-24); uji tablet +15 prompt kartu dan Finish easter egg.
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
