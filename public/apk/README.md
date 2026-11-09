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
2. Isi `latest.json` (versi, ukuran, sha256, catatan).
3. Jalankan `npm run build` agar salinan di `build/client/` ikut.

Halaman `/apk/index.html` membaca `latest.json`, jadi teks versi dan tautan
unduh tidak perlu diubah manual lagi.

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

- 2026-10-27: naik 1.4.1 (versionCode 22)—build tag
  `1.4.1-22-3b79432`. Memperbaiki layar kuning *upcoming*: judul dan angka
  countdown diperkecil serta jarak tombol aksi ditambah agar tombol tidak
  menabrak teks di atasnya. Paket distribusi 21.521.483 byte, SHA-256
  `e82d5416a066d84d325e670ba525bb42ca0a1cdeb92fc7829385bd89dc5deac2`.

- 2026-10-27: naik 1.4.2 (versionCode 23)—build tag
  `1.4.2-23-2bfdbff`. Tombol update dipindah ke menu tablet (ketuk jam
  lima kali) bersama ganti bahasa dan ganti ruangan; tombol kuning tetap
  tersedia di footer. Paket distribusi 21.521.724 byte, SHA-256
  `f6334d85fe927a90bd142b467cbaa9e178ed523647ffde692aa09b129c66ca79`.

- 2026-10-27: naik 1.4.3 (versionCode 24)—build tag
  `1.4.3-24-c131edb`. Menu tablet (ketuk jam lima kali) sekarang punya
  tombol **Cek update**; bila ada versi baru berubah menjadi tombol kuning
  **Perbarui**. Tombol update juga tetap ada di footer. Paket distribusi
  21.523.929 byte, SHA-256
  `ada4af2e380eca7c45b6bd8cc75f319d1a9a0f886f5bc8c09c457f65e8d3d1af`.

- 2026-10-28: naik 1.4.4 (versionCode 25)—build tag
  `1.4.4-25-04c7d80`. Menambahkan tombol **Tentang** di samping tombol update
  pada menu tablet, berisi versi aplikasi, versi CMS, dan daftar lisensi
  pustaka APK. Paket distribusi 21.530.390 byte, SHA-256
  `a0e4b9693fbfd2805700f9075f972fb8682f38398548999624fe7f94ce4a2c8c`.

- 2026-10-29: naik 1.4.5 (versionCode 26)—build tag
  `1.4.5-26-a6390a2`. Memperbaiki blok **NEXT UP** yang menabrak teks status
  pada tampilan merah (occupied/waiting) dan hijau (available) dengan
  mengecilkan tipografi/spacing saat preview tersedia. Paket distribusi
  21.530.462 byte, SHA-256
  `adb6af93a49f592f4c4767895605248ed963988d2875b0ff44ebe457c1a338d6`.

## Manifest update

`latest.json` dibaca kiosk 1.4.0+ setiap 6 jam dan dibaca halaman
`/apk/index.html` saat dibuka. Setiap rilis APK, isi:

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

- 2026-11-04: naik 1.5.0 (versionCode 27)—toggle **30 menit/sampai jam X**
  dan **Pilih waktu** dapat dimatikan per tablet dari CMS Tablet Devices;
  toast hasil aksi di panel kanan (hijau sukses, merah ditolak); buka pintu
  saat meeting aktif hanya untuk attendee/organizer meeting itu atau kartu
  master. SHA-256 `be42fd3599658724db41ddb16f82c12bde90f29d914f6c023c6dcaa49ac98c96`, 21.531.173 byte.

- 2026-11-09: naik 1.5.1 (versionCode 28)—build tag `1.5.1-28-a1682e3`.
  Perbaikan jalur update: tombol memanggil modul native `KioskUpdate` (1.5.0
  salah modul sehingga selalu "Update failed."), manifest dibaca ulang tepat
  sebelum unduh, permintaan manifest punya timeout 15 detik, tap ganda tidak
  memulai dua unduhan, dan alasan gagal dari native ikut ditampilkan. Paket
  distribusi 21531488 byte, SHA-256
  `249fc9c03bbb9900ae69ca3f4d5c1311febbdaa1674330a20857c7bc1571b811`. Build internal 1.6.0 (28), 1.6.1 (29), dan 1.6.2 (30) dipakai untuk
  menguji updater dan tidak pernah ditebar; rilis face unlock menyusul sebagai
  1.6.0 (29).

## Manifest update

`latest.json` dibaca kiosk 1.4.0+ setiap 6 jam dan dibaca halaman
`/apk/index.html` saat dibuka. Setiap rilis APK, isi:

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

- 2026-11-04: naik 1.5.0 (versionCode 27)—toggle **30 menit/sampai jam X**
  dan **Pilih waktu** dapat dimatikan per tablet dari CMS Tablet Devices;
  toast hasil aksi di panel kanan (hijau sukses, merah ditolak); buka pintu
  saat meeting aktif hanya untuk attendee/organizer meeting itu atau kartu
  master. SHA-256 `be42fd3599658724db41ddb16f82c12bde90f29d914f6c023c6dcaa49ac98c96`, 21.531.173 byte.

- 2026-11-09: naik 1.6.0 (versionCode 29)—build tag `1.6.0-29-6fab162`.
  Face unlock di tablet: tombol wajah, overlay scan, modul kamera native, dan
  aksi check-in/extend/booking lewat wajah dengan kartu sebagai cadangan.
  Dibangun di atas 1.5.1 (28), jadi perbaikan updater sudah terbawa; isi
  rilis ini murni fitur face unlock. Paket distribusi 21544396 byte, SHA-256
  `b60e1801741b06d8123e34ca27bd924449907fd07c5f90516e0b5e07e27ed228`.
