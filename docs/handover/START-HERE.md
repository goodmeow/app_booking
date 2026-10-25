# START HERE — RoomBooking

Panduan orientasi singkat untuk orang baru (developer/operator). Detail
lengkap ada di `README.md`, `TODO.md`, `docs/README.md` (index dokumentasi),
`docs/CMS.md`, dan `docs/VERSIONING.md`.

## 1. Apa ini

Rekonstruksi aplikasi booking ruangan 360Booking produksi: CMS web (admin +
kalender), API + Socket.io, dan aplikasi kiosk tablet (repo `kioskapp`).
Aturan produk terpenting:

- Karyawan hanya memesan ruangan di lantai kerjanya (admin bebas).
- Satu tablet aktif per ruangan; pairing dilakukan dari layar tablet.
- Kiosk menampilkan `[nama depan, HH:mm - HH:mm]` untuk booking orang lain
  (privasi): subjek/desc/email hanya untuk pemilik atau admin.
- Pemesanan langsung (instant) dan pemesanan terjadwal dari kiosk dibatasi
  hari yang sama, wajib kartu karyawan, dan tunduk aturan lantai.

## 2. Menjalankan demo (5 menit)

```bash
git clone https://github.com/goodmeow/app_booking.git
cd app_booking && npm install
npm run demo        # DB disposable + CMS :8081 + API :9091
```

Kredensial demo (database disposable):

| Peran | Email | Sandi |
|---|---|---|
| Admin CMS | `admin@example.test` | `ParityTest123!` |
| Tablet ruangan | `room-one@room.com` | `RoomTablet123!` |
| Karyawan uji | `karyawan@uji.prasada.test` / `emp@uji.local` | `1234` |

Setelah menjalankan `test:server:regression` (me-reset DB), jalankan
`npm run demo:accounts` untuk mengembalikan akun uji, lalu pasangkan ulang
tablet bila sesi kios ikut hilang.

## 3. Peta repo

| Area | Lokasi |
|---|---|
| CMS (React + MUI) | `client/` — kalender di `client/calendar/`, manajemen di `client/management/`, tema di `client/theme.js` |
| API + Socket.io | `server/features/<fitur>/` (routes → controller → service → repository) |
| Database | `database/migrations/` (urut), seed disposable di `database/seeds/` |
| Test | `server/tests/unit|parity|regression`, `client/tests` |
| Deploy Ubuntu 22.04 | `deploy/` (lihat `deploy/README.md`) |
| Versi & riwayat | `docs/VERSIONING.md`, `package.json` (`3.11.0` = Ver 3 Rev 12), APK kiosk `1.3.8` (code 19) |

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
4. Footer kios menampilkan versi APK + versi CMS (`v1.3.8 (19) · CMS 3.11.0`),
   berguna untuk memastikan tablet dan server memakai rilis yang sama.
5. Admin mengelola perangkat di CMS → Manajemen → Perangkat Tablet (LED,
   tampilkan judul, cabut perangkat, unduh APK). Pengaturan global (timer
   check-in, timer kunci, LED, input meja, pendaftaran mandiri) ada di tab
   **Pengaturan**; panel Floor groups sudah tidak ada.

## 5. Gate kualitas

```bash
npm run verify                  # build client+server, test client + unit server
npm run test:server:regression  # end-to-end API (reset DB demo; pairing tablet hilang)
```

CI (`.github/workflows/ci.yml`) menjalankan `verify`; suite paritas/regresi
butuh PostgreSQL disposable sehingga dijalankan manual/ops.

## 6. Deploy produksi

Ikuti `deploy/README.md` urut: `01-install-prerequisites.sh` →
`02-provision-database.sh` → `03-build.sh` → `04-install-app.sh` →
`05-create-admin.sh` (atau buat admin pertama lewat `/setup`). HTTPS didukung
lewat env `HTTPS=true` + `TLS_CERT_PATH`/`TLS_KEY_PATH` atau reverse proxy
(`TRUST_PROXY=true`).

Alternatif Docker: `deploy/docker/compose.alpine.yaml`
(`node:20-alpine` + `postgres:16-alpine` + `nginx:alpine`), entrypoint
menerapkan migrasi + seed role otomatis; detail di `deploy/docker/README.md`
dan `docs/operations-runbook.md` §2.5.

## 7. Sebelum go-live (jangan dilewat)

- Isi `tbl_users.floor` semua akun karyawan produksi (kalau kosong, booking
  ditolak dengan `FLOOR_REQUIRED` / 403).
- Ganti semua `change-me` di `/etc/360booking/app.env`, set `CORS_ORIGINS`
  ke origin CMS yang sebenarnya.
- Pastikan autostart + kiosk lock tablet (belum otomatis; lihat TODO Fase 12).
- Uji relay pintu & kartu NFC fisik saat perangkat tersedia.
