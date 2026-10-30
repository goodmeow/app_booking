# START HERE — RoomBooking

Panduan orientasi singkat untuk orang baru (developer/operator). Detail
lengkap ada di `README.md`, `TODO.md`, `docs/README.md` (index dokumentasi),
`docs/CMS.md`, dan `docs/VERSIONING.md`.

## 1. Apa ini

Rekonstruksi aplikasi booking ruangan 360Booking produksi: CMS web (admin +
kalender), API + Socket.io, dan aplikasi kiosk tablet (repo `kioskapp`).
Aturan produk terpenting:

- Karyawan hanya memesan ruangan di lantai kerja yang tercantum di akunnya
  (`tbl_users.floors`, boleh lebih dari satu; admin bebas).
- Akun pertama dari `/setup` adalah **Super Admin** yang dilindungi dan
  pemegang matrix menu per peran serta log audit.
- Satu tablet aktif per ruangan; pairing dilakukan dari layar tablet.
- Kiosk menampilkan `[nama depan, HH:mm - HH:mm]` untuk booking orang lain
  (privasi): subjek/desc/email hanya untuk pemilik atau admin.
- Pemesanan langsung (instant) dan pemesanan terjadwal dari kiosk dibatasi
  hari yang sama, wajib kartu karyawan, dan tunduk aturan lantai.

## 2. Lingkungan uji saat ini (5 menit)

Tidak ada lagi alur `npm run demo`. Pengujian berjalan di **UAT local test
bed** dan **UAT live**, keduanya stack Docker Alpine port `8082`.
Skrip demo masih ada di repo karena dirujuk harness unit/parity.

| Lingkungan | URL | Commit | Migrasi | Status |
|---|---|---|---|---|
| UAT local test bed | `http://127.0.0.1:8082` | `9c96999` | `026_event_room_timezone.sql` | app/web/db sehat |
| UAT live | `http://<uat-host>:8082` | `9c96999` | `026_event_room_timezone.sql` | app/web/db sehat |

```bash
git clone <repo-url> app_booking
cd app_booking && npm install

# UAT local test bed (stack Docker Alpine, port 8082)
cp deploy/docker/.env.example deploy/docker/.env   # isi origin + secret
docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine up -d --build
curl -fsS http://127.0.0.1:8082/api/health          # {"ok":true}
```

Akun tidak lagi memakai kredensial demo. Buat akun pertama lewat `/setup`
(Super Admin), lalu akun operasional lewat CMS → Manajemen; sandi dipegang
operator, jangan ditulis di repo. Detail prosedur ada di
`docs/operations-runbook.md` §2.1 dan §3.

## 3. Peta repo

| Area | Lokasi |
|---|---|
| CMS (React + Ant Design) | `client/` — kalender di `client/calendar/`, manajemen di `client/management/`, tema di `client/theme.js` |
| API + Socket.io | `server/features/<fitur>/` (routes → controller → service → repository) |
| Database | `database/migrations/` (urut), seed disposable di `database/seeds/` |
| Test | `server/tests/unit|parity|regression`, `client/tests` |
| Deploy Ubuntu 22.04 | `deploy/` (lihat `deploy/README.md`) |
| Versi & riwayat | `docs/VERSIONING.md`, `package.json` (`3.12.1` = Ver 3 Rev 13), APK kiosk `1.4.5` (code 26) |

## 4. Alur kiosk singkat

1. Settings tablet → Ethernet IP statis (produksi) atau `adb reverse` (dev USB).
2. Buka app kiosk → isi URL server, email ruangan, sandi → "Hubungkan kiosk".
3. Layar kios menampilkan state ruangan dan jadwal hari ini; tombol tersedia
   sesuai state:
   - **Check-in** saat jendela check-in dibuka;
   - **+15 menit** saat meeting berjalan — wajib tap kartu organizer,
     peserta, atau master (server memverifikasi, bukan sekadar UI);
   - **30 menit** dan **Pilih waktu** saat ruangan kosong;
   - **Sampai HH:MM** hanya muncul bila masih ada meeting berikutnya hari itu;
   - **Finish/Selesai** disembunyikan; muncul setelah **5 tap** pada pill
     **IN USE** (easter egg operator).
4. Footer kios menampilkan versi APK + versi CMS (`v1.4.5 (26) · CMS 3.12.1`),
   berguna untuk memastikan tablet dan server memakai rilis yang sama.
5. Admin mengelola perangkat di CMS → Manajemen → Perangkat Tablet (LED,
   tampilkan judul, cabut perangkat, unduh APK). Pengaturan global (timer
   check-in, timer kunci, LED, input meja, pendaftaran mandiri, hari pertama
   minggu) ada di tab **Pengaturan**; panel Floor groups sudah tidak ada.
   Di bagian bawah tab yang sama, **Super Admin** melihat **matrix menu per
   peran** dan **log audit**.
6. Update APK tablet: unduh dari `https://<domain>/apk/index.html` (atau tombol
   Unduh APK Tablet). Versi saat ini `1.4.5` (26), build tag
   `1.4.5-26-a6390a2`; footer tablet menampilkan
   `v1.4.5 (26) · CMS 3.12.1`.

## 5. Gate kualitas

```bash
npm run verify                  # build client+server, test client + unit server
npm run test:server:regression  # end-to-end API (reset DB parity; pairing tablet aman)
```

Angka terakhir 2026-10-30 (checkout build `/home/goodmeow/build/app_booking`):
client **99/99**, unit server **85/85**, regresi **105/105** (0 skip), parity
prepare **2/2**, parity **8/8**; lint 0 error (warning tersisa). Regresi/parity
me-reset database `360booking_parity_test`, bukan database UAT.

CI (`.github/workflows/ci.yml`) menjalankan `verify`; suite paritas/regresi
butuh PostgreSQL disposable sehingga dijalankan manual/ops.

## 6. Deploy produksi

Ikuti `deploy/README.md` urut: `01-install-prerequisites.sh` →
`02-provision-database.sh` → `03-build.sh` → `04-install-app.sh` →
`05-create-admin.sh` (atau buat akun Super Admin pertama lewat `/setup`). HTTPS didukung
lewat env `HTTPS=true` + `TLS_CERT_PATH`/`TLS_KEY_PATH` atau reverse proxy
(`TRUST_PROXY=1`, satu hop nginx).

Alternatif Docker: `deploy/docker/compose.alpine.yaml`
(`node:22-alpine` + `postgres:16-alpine` + `nginx:alpine`), entrypoint
menerapkan migrasi + seed role otomatis; detail di `deploy/docker/README.md`
dan `docs/operations-runbook.md` §2.5.

## 7. Sebelum go-live (jangan dilewat)

- Isi `tbl_users.floors` (atau `floor` lama) semua akun karyawan dan
  resepsionis produksi (kalau kosong, booking ditolak dengan
  `FLOOR_REQUIRED` / 403). Satu akun boleh memegang beberapa lantai.
- Pastikan satu akun **Super Admin** aktif dan password-nya dipegang orang
  yang bertanggung jawab; jangan pakai akun itu untuk operasional harian.
- Periksa matrix menu per peran (Manajemen → Pengaturan → Manajemen Peran
  Pengguna) sebelum menyerahkan akses ke staf.
- Ganti semua `change-me` di `/etc/360booking/app.env`, set `CORS_ORIGINS`
  ke origin CMS yang sebenarnya.
- Pastikan autostart + kiosk lock tablet (belum otomatis; lihat TODO Fase 12).
- Uji relay pintu & kartu NFC fisik saat perangkat tersedia.
