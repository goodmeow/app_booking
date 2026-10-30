# Status Proyek RoomBooking

Snapshot: **2026-10-30, WIB**. Angka kesiapan adalah penilaian berbobot, bukan
metrik otomatis.

## Versi dan akses

| Item | Nilai |
|---|---|
| CMS/API | **3.13.0** (Ver 3 Rev 14) |
| APK kiosk | **1.4.5 (26)** |
| Rilis app | **`v3.13.0`** (2026-10-30) |
| Migrasi terakhir | `026_event_room_timezone.sql` |
| UAT local test bed | `http://127.0.0.1:8082` — app/web/db sehat |
| UAT live | `http://<uat-host>:8082` — app/web/db sehat |
| Domain baru | `<uat-domain>` — DNS + vhost nginx **belum aktif** |
| Database | `360booking` (PostgreSQL 16 di stack Docker UAT) |
| Commit rilis 3.12.1 (historis) | `69fc547` + `3.12.0` (bump) + `ec6baac` + `5509fe8` + `c43be28` + `45785a5` + `60af46e` + `6452b7c` + `4f463fb` + `26691c8` + `1ee10c7` + `3b9f623` + `6cb0704` + `0d17a4f` |
| Commit dasar app (historis) | `9eb8c37` + `37cebaa` + `678ab49` |
| Commit kiosk | `a6390a2` (APK 1.4.5 build tag `1.4.5-26-a6390a2`) |
| Commit clean | snapshot `clean` terbaru (sinkron dengan master) |
| Commit artefak REA | `f266e33` (`app_360booking`) |

## Posisi kesiapan

- **Kesiapan UAT — ≈91%**: aplikasi, APK, server UAT, akses pintu, dan
  training sudah jalan. Sisa UAT formal dan hardware opsional.
- **Kesiapan produksi — ≈84%**: belum siap promote apa adanya. Blocker utama
  ada di domain/TLS, environment produksi, backup off-host, signing APK, dan
  pembersihan data UAT.

| Aspek | Bobot | Skor | Catatan |
|---|---:|---:|---|
| Software/fitur | 25% | 99% | Core, kiosk, branding, backup, kalender, akses per peran selesai |
| Data/migrasi | 20% | 88% | DB UAT bersih untuk UAT; data produksi + kepastian floor HR belum final |
| Infrastruktur | 15% | 75% | UAT current + health 200; domain/TLS/nginx produksi belum aktif |
| Keamanan | 15% | 78% | Reset sandi/audit/menu hardened; TLS, signing produksi, dan hardening host belum |
| Backup/monitoring | 10% | 65% | Backup + restore lokal lulus; off-host copy + alert belum |
| UAT/training | 8% | 92% | UAT Docker + deck 22 slide; UAT formal pengguna belum |
| Hardware | 7% | 70% | CH340 relay terbukti; NFC 7-byte + autostart belum |

## Sudah selesai

- CMS/API 3.13.0, APK 1.4.5, branding upload, week start, backup settings.
- **Resepsionis**: tombol Edit/Batalkan mengikuti flag `can_mutate`; meeting
  karyawan di lantai akses resepsionis bisa dibatalkan.
- **Update APK semi-otomatis**: kiosk cek `/apk/latest.json` tiap 6 jam,
  download + verifikasi SHA-256/signature, lalu buka installer Android.
- **Akses per peran**: akun `/setup` menjadi `super_admin` (dilindungi),
  matrix menu per peran di Manajemen → Pengaturan, `tbl_users.floors` untuk
  multi-lantai, resepsionis melihat/mengubah booking di semua lantai yang
  dipegang, dan log audit untuk role/lantai/kartu/pengaturan/akses
  (endpoint `/api/access/*` dan `/api/audit` hanya untuk Super Admin).
- **Distribusi APK**: halaman `/apk/index.html` + `kiosk-release.apk` current
  (build tag `1.4.5-26-a6390a2`, 21.530.462 byte, SHA-256 `adb6af93…a338d6`);
  copy kiosk netral "Siap digunakan / Belum ada jadwal berikutnya".
- **UAT berjalan sebagai stack Docker Compose di VM Linux**: UAT local test bed
  `http://127.0.0.1:8082` dan UAT live `http://<uat-host>:8082` sama-sama
  tag `v3.13.0`; CMS root, `/api/health`, dan `/apk/index.html` balas
  HTTP 200; container app/web/db healthy.
- **Revamp CMS Ant Design 5 sudah merge ke `master` dan dirilis `v3.13.0`**;
  tag `v3.13.0` sudah dibuat; go-live produksi belum.
- **Alur `npm run demo` tidak lagi dipakai.** Skrip demo masih ada di repo
  karena dirujuk harness unit/parity, bukan prosedur kerja; pengujian berjalan
  di UAT local test bed dan UAT live. Tidak ada migrasi baru setelah
  `026_event_room_timezone.sql`.
- **Server UAT remote diperbarui 2026-10-27** (historis): CMS current dan APK
  current terpasang; health 200. Insiden password DB setelah `.env` tertimpa
  sudah diperbaiki dengan reset role + env baru, volume database dipertahankan.
  Permission tree dinormalkan (755/644/755 untuk script) dan deploy script
  tidak lagi menimpa `.env` yang ada.
- **Setup admin selesai** dan **impor user bersih** di DB UAT; satu akun
  meeting room dibuat dan tablet sudah **dipairing** ke server UAT.
- **Akses pintu end-to-end terbukti di tablet**: APK → validasi kartu API 200
  → relay CH340 di tablet → bunyi klik relay fisik. CH340 juga terverifikasi
  lewat COM Windows dan bridge `/dev/ttyUSB0` di WSL sebelumnya.
- Kalender 24 jam, format tanggal, validasi backdate, CORS error yang jelas.
- Kiosk: check-in, +15, Finish 5 tap, early-finish hint, judul STARTING SOON,
  hint kartu organizer/peserta/master.
- Impor CSV overwrite transaksional; floor lama dipertahankan bila kolom
  tidak ada; admin aktif terakhir tidak bisa diturunkan (`LAST_ADMIN`).
- Setup admin terlindungi (`is_protected`, migrasi 021): delete `403
  PROTECTED_ACCOUNT`; UAT ADMIN-001 terverifikasi.
- UAT lintas lantai dan multi-room; data kartu UAT.
- Angka uji akhir 2026-10-30 di checkout build `/home/goodmeow/build/app_booking`
  (tag `v3.13.0`): unit server **85/85**, unit kiosk **21/21**, client
  **99/99**, regresi **105/105** (0 skip), parity prepare **2/2**, parity
  **8/8**; `build:client` dan `build:server:check` lulus, lint 0 error
  (warning tersisa).
- Angka uji 2026-10-26 (historis, sebelum revamp AntD): unit server 85/85,
  unit kiosk 21/21, client 98/98, regresi 95/95 (0 skip), parity 8/8.
- Deploy native satu perintah: `deploy/bootstrap.sh` (IP + HTTP + 80);
  deploy external nginx punya opsi argumen wajib (origin/proxy-ip).
- Repo dipecah: `app_booking`, `app_360booking`, `kioskapp` root repo.
- XERJ reindex 16.251 dokumen.
- Cleanup file UI/aset tidak terpakai; logo asli dipertahankan.

## Keputusan scope (2026-10-25)

- TLS/domain/firewall menjadi tanggung jawab tim deploy, bukan aplikasi.
- Rotasi password/kartu dan purge old SHA tidak diperlukan saat ini.
- Verifikasi floor HR tidak diperlukan; karyawan ditambahkan sendiri bila belum terdaftar.
- UAT formal/training dikerjakan oleh pemilik produk.
- Monitoring alert opsional; health endpoint tetap tersedia.

## Selesai pada gelombang ini

- [x] UAT Docker Compose di VM Linux: CMS root HTTP 200, `/api/health` 200,
  `/apk/kiosk-release.apk` 200 (port 8082).
- [x] Setup admin + impor user bersih di DB UAT; akun meeting room dibuat.
- [x] Tablet dipairing ke server UAT, footer `v1.4.4 (25) · CMS 3.12.0`
  (historis; sekarang `v1.4.5 (26) · CMS 3.13.0`).
- [x] Akses pintu end-to-end: APK → `/api` validasi kartu 200 → CH340 relay
  di tablet → klik relay fisik.
- [x] Akses per peran: `super_admin` dari `/setup`, matrix menu per peran,
  multi-lantai (`tbl_users.floors`), resepsionis lintas lantai, log audit.
  Commit `60af46e` + `45785a5`.
- [x] Halaman unduh APK `/apk/index.html` + paket `1.4.5` rebuild
  (build tag `1.4.5-26-a6390a2`). Commit halaman APK `c43be28`; bump `a6390a2`.
- [x] Update server UAT remote ke CMS/APK current (2026-10-27); health 200,
  APK checksum sama dengan build lokal.
- [x] Dokumentasi + deck training 22 slide (commit `5509fe8`); deck disalin
  ke Downloads untuk review.
- [x] Backup + restore test: dump terbaru direstore ke DB disposable;
  users 260, events 114, cards 202, migrations 20; DB uji dihapus.
- [x] Deck training 22 slide (CMS + tablet + screenshot) masuk docs.
- [x] Client 98/98, server unit 85/85, kiosk unit 21/21, typecheck kiosk
  bersih (2026-10-26, historis).
- [x] Regression 95/95 (0 skip) dan parity 8/8 sudah lulus (2026-10-26,
  historis).
- [x] Revamp AntD 5 merge ke `master` → tag `v3.13.0`; UAT local test bed dan
  UAT live di commit yang sama, app/web/db sehat (2026-10-30).
- [x] Verifikasi final 2026-10-30: client 99/99, server unit 85/85, regresi
  105/105 (0 skip), parity 8/8, build client/server lulus.

## Sisa pekerjaan kita

Tidak ada blocker aplikasi yang tersisa. Promote produksi masih tertahan di
sisi deployment dan operasi:

### Blocker produksi

- [ ] DNS record + vhost nginx + TLS untuk `<uat-domain>`.
- [ ] Environment produksi terpisah: `.env` baru, JWT/DB password strong,
  volume DB produksi, dan `FLOOR_RESTRICTION=true`.
- [ ] Backup off-host + restore test di environment produksi.
- [ ] Bersihkan data UAT (akun/event/kartu test), rotasi akun admin/Super Admin,
  dan paksa ganti password.
- [ ] APK signing produksi atau keputusan resmi tetap memakai debug cert untuk
  sideload internal; naikkan versi/tag rilis.
- [ ] Monitoring, log rotation, dan rollback plan.

### Setelah blocker

- [ ] UAT formal / training pengguna (pemilik produk).
- [x] Tag rilis CMS `v3.13.0` (2026-10-30).
- [ ] Go-live produksi.
- [ ] Hardware opsional: NFC 7-byte, autostart/kiosk lock.
- [ ] 16 kartu placeholder RMH ditunda.

## P1

- Putuskan room usage report (pertahankan/hide).
- Audit format tanggal pada date-picker/kiosk.
