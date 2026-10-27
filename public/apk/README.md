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

- 2026-10-24: naik 1.3.5 (versionCode 16)—LED opsional: tablet tanpa
  path LED tetap berjalan; status hardware melaporkan dukungan LED/NFC.

- 2026-10-25: naik 1.3.6 (versionCode 17)—hint “Selesai aktif pukul HH:MM”
  saat check-in early, judul meeting pada state STARTING SOON, dan copy popup
  kartu per aksi (check-in meminta kartu pemesan; +15 menerima kartu
  peserta/master). Layout sudah diuji di tablet Lt3; footer
  `v1.3.7 (18) · CMS 3.11.0`.

- 2026-10-25: naik 1.3.7 (versionCode 18)—icon launcher memakai mark
  The Prasada di latar hijau brand. Tidak ada perubahan alur kiosk.

- 2026-10-25: naik 1.3.8 (versionCode 19)—hint kartu check-in dan **+15**
  menyebut kartu organizer/peserta/master (selaras server); five-tap
  **Finish** sebelum jam mulai kini langsung membuka tombol saat jam mulai,
  tanpa five-tap kedua. Dipasang di tablet Lt3, footer
  `v1.3.8 (19) · CMS 3.11.0`. Paket distribusi 21.513.747 byte, SHA-256
  `255c95755d606a2ab2cf90696e72f8f415b572a9fc78e2c114238e4788a025b0`.

- 2026-10-26: rebuild 1.3.8 (versionCode 19), build tag
  `1.3.8-19-85ca335`—pill `TERSEDIA` 44 px dan hanya membesar pada state
  tersedia; state kosong memakai copy netral **Siap digunakan / Belum ada
  jadwal berikutnya**. Paket distribusi 21.514.430 byte, SHA-256
  `ad21fbd777aad4d8f40da55c5879b930b15bb2cb0acd989088127b09a75735ab`.

- 2026-10-27: naik 1.3.9 (versionCode 20)—build tag
  `1.3.9-20-f7c5d22`, membawa pill `TERSEDIA` 44 px, copy netral
  **Siap digunakan / Belum ada jadwal berikutnya**, dan penyesuaian context
  kiosk. Paket distribusi 21.514.450 byte, SHA-256
  `521a200ec31da71f69d4ed2528fef0340546f54cdafc55ef241aa10eca33275f`.

- 2026-10-27: naik 1.4.0 (versionCode 21)—build tag
  `1.4.0-21-a269e73`. Menambahkan pengecekan update semi-otomatis:
  kiosk membaca `/apk/latest.json`, membandingkan `versionCode`, mengunduh
  APK, memverifikasi SHA-256 + signature, lalu membuka installer Android.
  Paket distribusi 21.521.436 byte, SHA-256
  `f240ae3d5f6bf67b552789e40e46206d6fc7d55afd32c8474a2a246f7a64c8b5`.

## Manifest update

`latest.json` dibaca kiosk 1.4.0+ setiap 6 jam. Setiap rilis APK, isi:

```json
{
  "versionCode": 22,
  "versionName": "1.4.1",
  "url": "/apk/kiosk-release.apk",
  "sha256": "<sha256 paket>",
  "mandatory": false,
  "notes": "..."
}
```

`versionCode` harus naik. Kiosk memverifikasi SHA-256 dan signature APK
sebelum membuka installer.

## RustDesk remote support

Halaman APK juga menyediakan RustDesk untuk akses tablet dari jauh:

- Berkas: `public/apk/rustdesk-armv7.apk`
- Versi: RustDesk 1.5.0, ARMv7 signed
- Ukuran: 27.213.962 byte
- SHA-256: `14e0bbccfca1bce9ea03350ad95b763064bda2481a36312420403f6cb1e0f71a`
- Sumber resmi: <https://github.com/rustdesk/rustdesk/releases/tag/1.5.0>

RK3288 adalah ARM 32-bit, jadi gunakan ARMv7. Ganti berkas ini bila versi
RustDesk dinaikkan, lalu perbarui teks versi di `index.html` dan hash di atas.
