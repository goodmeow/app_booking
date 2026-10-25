# Catatan rilis v3.11.0 (Ver 3 Rev 12)

Rilis fitur/UX setelah UAT 25 Oktober 2026. **Belum di-tag dan belum
di-push**; checklist di bawah tetap harus lulus sebelum tag.

## Artefak versi

| Artefak | Nilai | Lokasi |
|---|---|---|
| CMS/API | `3.11.0` | `package.json` + `package-lock.json` |
| Riwayat versi | Ver 3 Rev 12 | `docs/VERSIONING.md` |
| APK kiosk | `1.3.8`, code `19` | `kioskapp/android/app/build.gradle` + `src/config.ts` |
| APK distribusi | `1.3.8` | `public/apk/kiosk-release.apk` + `public/apk/README.md` |

APK 1.3.7 (18) tetap tercatat di bawah sebagai build sebelumnya; 1.3.8
adalah APK yang dipasang di tablet Lt3 saat ini.

## Isi rilis

### Kalender dan booking

- Grid mingguan/harian **24 jam** (00:00–24:00) dengan area scroll sendiri;
  event pagi/larut tidak lagi hilang dan halaman tidak memanjang.
- **Hari pertama minggu** menjadi pengaturan global `week_start_day` (0–6,
  default Senin), dipakai grid FullCalendar dan query mingguan.
- Filter ruangan hanya tampil di tab **Room Schedule**.
- Validasi booking baru: **start >= now** (tidak back date/time) dan
  **end >= start**; server mengembalikan `START_IN_PAST`/`INVALID_RANGE`.
- Format tanggal tampilan CMS/kalender/profil/laporan menjadi
  **DD-MMM-YYYY**.
- Booking on-behalf dan floor schedule dari rilis 3.10.4 tetap berlaku.

### Branding dan tampilan

- Tab **Branding di Settings**: nama branding, judul tab, icon, logo
  The Prasada, dan favicon dapat diunggah dari CMS (PNG/JPEG/WebP/ICO,
  maks 512 KB) dan disimpan sebagai bytea di database.
- Branding dipakai di login, signup, force-password, navbar/drawer, footer,
  `<title>`, dan favicon; fallback aset bawaan bila kosong.
- Language selector dipindah ke footer kiri; versi CMS di kanan.
- Navbar sticky saat halaman di-scroll.

### Kiosk 1.3.7 (18)

- Hint **“Selesai aktif pukul HH:MM”** saat 5 tap pill IN USE dilakukan
  sebelum jam mulai; server tetap menolak Finish sebelum `start_at`.
- Judul meeting tampil di bawah pill saat STARTING SOON, mengikuti
  `show_subject`.
- Copy popup kartu per aksi: check-in meminta kartu pemesan; +15 menerima
  kartu peserta/master; pintu memakai copy sendiri.
- APK 1.3.7 sudah dipasang di tablet Lt3 dan didistribusikan di
  `/apk/kiosk-release.apk`.

### Kiosk 1.3.8 (19)

- Hint kartu **check-in** dan **+15 menit** menyebut kartu
  organizer/peserta/master, selaras dengan verifikasi server.
- Five-tap **Finish** sebelum jam mulai kini benar-benar membuka tombol saat
  jam mulai; tidak perlu melakukan five-tap kedua.
- Dipasang di tablet Lt3, footer `v1.3.8 (19) · CMS 3.11.0`; distribusi
  `/apk/kiosk-release.apk` (21.513.747 byte, SHA-256
  `255c95755d606a2ab2cf90696e72f8f415b572a9fc78e2c114238e4788a025b0`).

### Patch server (tanpa naik versi)

- Impor CSV mode overwrite berjalan transaksional per baris: konflik kartu
  membatalkan perubahan profil baris itu.
- Kolom `floor` yang tidak ada di CSV mempertahankan lantai lama; sel kosong
  menghapus lantai.
- Impor tidak bisa menurunkan admin aktif terakhir (`409 LAST_ADMIN`).
- Akun admin hasil `/setup` dilindungi (`021_protect_setup_admin.sql`,
  `is_protected`): `DELETE` mengembalikan `403 PROTECTED_ACCOUNT` dan CMS
  menyembunyikan tombol Hapus. UAT: ADMIN-001 terlindungi, delete 403.

### Deploy

- Docker web dipublikasikan di **8082** (satu pintu, tanpa forwarder).
- CORS hanya origin 8082; `5100` dan portproxy lama dihapus.
- Backup diatur dari **CMS → Pengaturan → Backup database** (enable, path,
  jam, retensi, tombol Backup sekarang); scheduler berjalan di proses API.
- Docker memakai volume `backup-data` di `/backups`; cron host tidak dipakai.
- APK 1.3.7 memakai icon launcher dari mark The Prasada.
- Dokumentasi aktif memakai 8082; konfigurasi native tetap 80/443 + API 9091.

## Bukti

- Client **98/98**, server unit **79/79**, kiosk unit **21/21**, regresi
  **87/87** (0 skip), parity
  prepare 2/2 dan parity 8/8 (dijalankan 2026-10-25).
- APK 1.3.8: check-in manual dengan kartu, hint kartu per aksi, five-tap
  Finish sebelum start, footer `v1.3.8 (19) · CMS 3.11.0`.
- APK 1.3.7: check-in manual dengan kartu, copy check-in, hint early-finish,
  layout STARTING SOON, icon Prasada, dan footer `v1.3.7 (18) · CMS 3.11.0`.
- Multi-room Lt5: dua ruangan dalam satu event, floor schedule menampilkan
  satu blok (dedupe).
- Booking on-behalf `live 5`: organizer UAT Lt3, `booked_by` Resepsionis Lt5.
- Backup dump + checksum diverifikasi di
  `/home/goodmeow/backups/360booking/`.

## Risiko / belum diuji

- Regresi/parity sudah dijalankan; 2 tes regresi sengaja di-skip karena
  bergantung pada waktu dekat tengah malam (bukan kegagalan).
- Relay CH340, NFC 7-byte, autostart/kiosk lock belum tersedia.
- TLS/domain final dan host produksi belum dipasang.
- Kiosk masih memakai aset branding build, bukan branding dinamis CMS.
- Audit format tanggal untuk date-picker native/kiosk belum menyeluruh.

## Checklist tag

- [ ] `git status` bersih; tidak ada `.env`, dump DB, UID kartu, atau data PII.
- [ ] `package.json` + `package-lock.json` sama-sama `3.11.0`.
- [ ] APK distribusi SHA-256 sama dengan build.
- [ ] Smoke test CMS 8082 dan tablet.
- [ ] Regresi/parity dijalankan pada DB disposable.
- [ ] Tag `v3.11.0` dibuat manual setelah checklist.
