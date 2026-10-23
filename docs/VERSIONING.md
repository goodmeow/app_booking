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

## Posisi saat ini (penutupan Ver 3 Rev 5)

- CMS + API: **Ver 3 Rev 5**, `package.json` `3.5.0`, ditampilkan di
  drawer CMS (dari package.json).
- APK kiosk: `versionName 1.2 / versionCode 3`, menampilkan ver + UUID
  perangkat di layar (identik dengan baris Perangkat Tablet di CMS);
  string pindah ke res/values + values-en (pilihan bahasa ID/EN).

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

## Cara naikkan

1. Rev naik ketika satu patch review atau gelombang perbaikan ditutup
   dan lulus verifikasi (build + regresi).
2. Ver naik ketika kemampuan baru mulai dipakai orang di luar tim
   (kios hidup di tablet produksi, CMS terpasang di server produksi).
3. `versionCode` APK naik satu setiap build release yang ditebar, tanpa
   melompat, tidak turun, dan tidak me-reset.
