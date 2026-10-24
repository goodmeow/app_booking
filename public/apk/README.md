# APK kios untuk tablet

File `kiosk-release.apk` dari folder public bawaan Vite (repo root)
ikut ke build/client dan dilayani CMS/nginx di:

```
/apk/kiosk-release.apk
```

Cara pembaruan:

1. Build release di repo `kioskapp`
   (android/gradlew assembleRelease), lalu salin
   `android/app/build/outputs/apk/release/app-release.apk` ke file ini.
2. Jalankan `npm run build` agar salinan di `build/client/` ikut.

Riwayat isi paket:

- 2026-10-23: pertama masuk paket, termasuk jam sinkron server (`serverTime`),
  panel kiri baru, dan `network_security_config.xml` (HTTP LAN + HTTPS siap).

- 2026-10-23: naik ke 1.1 (versionCode 2), tablet menampilkan versi + UUID
  perangkat di layar; CMS drawer menampilkan versi CMS dari package.json.

- 2026-10-23: naik 1.2 (versionCode 3)—pilihan bahasa ID/EN lewat sistem
  Android (res/values + values-en, modul native getKioskStrings), teks
  disimpan sebagai resource; footer versi memakai konstanta yang sama
  dengan build.gradle.

- 2026-10-23: naik 1.2 (versionCode 6)—perbaikan jarak panel state
  AVAILABLE (pill vs nama ruangan, baris menit vs UP NEXT yang sebelumnya
  meluber), angka jam diperkecil agar isi panel muat tanpa overflow.

- 2026-10-23: naik 1.3 (versionCode 7)—tombol "Pilih waktu" di tablet:
  pesan ruangan hari ini dengan jam mulai & selesai sendiri (validasi
  client+server, konflik 409, kartu karyawan, langsung check-in bila mulai
  <=2 menit). String baru ID/EN di res/values + values-en.

- 2026-10-23: 1.3 (versionCode 8)—sanitasi: alamat server bawaan (IP vendor)
  dihapus dari kioskapp; field Server kini kosong dengan placeholder
  http://<ip-server>:5100, alamat diisi operator saat provisioning.

- 2026-10-23: 1.3 (versionCode 11)—kartu tak terdaftar menampilkan nomornya
  di layar agar bisa langsung didaftarkan; UID hex di logcat hanya aktif bila
  `/sdcard/kiosk-debug-uid` ada (provisioning). Diuji 3 kartu karyawan
  (semua UID 4 byte) untuk check-in/pesan ruangan.

- 2026-10-24: naik 1.3.1 (versionCode 12)—branding user-facing menjadi
  **RoomBooking**: label APK dan layar setup kiosk memakai nama baru. Tidak ada
  perubahan alur pairing/check-in.

- 2026-10-24: naik 1.3.2 (versionCode 13)—hapus jam pada label
  **UP NEXT** karena sudah tampil di baris judul/waktu meeting.

- 2026-10-24: naik 1.3.3 (versionCode 14)—status *Started early* memakai
  jam check-in aktual dari server (`checkedInAt`), bukan jam mulai meeting.

- 2026-10-24: naik 1.3.4 (versionCode 15)—Finish meeting jadi easter egg
  (5 tap pill IN USE), +15 menit wajib verifikasi kartu, tombol until-next
  disembunyikan bila tidak ada jadwal, retry schedule 3x, footer menampilkan
  versi CMS.
