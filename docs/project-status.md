# Status Proyek RoomBooking

Snapshot: **2026-10-26, WIB**. Angka kesiapan adalah penilaian berbobot, bukan
metrik otomatis.

## Versi dan akses

| Item | Nilai |
|---|---|
| CMS/API | **3.11.0** (Ver 3 Rev 12) |
| APK kiosk | **1.3.8 (19)** |
| URL UAT Docker | `http://<uat-host>:8082` (LAN langsung, belum lewat domain) |
| Domain baru | `<uat-domain>` — DNS + vhost nginx **belum aktif** |
| Database | `360booking` (PostgreSQL di stack Docker UAT) |
| Commit app | `febd049` (kepala) + `5ae6b0b` + `dabbfbb` + `8e1854d` + `e2abf77` + `85f57dd` + `2c064dd` |
| Commit dasar app | `bfbb962` + `db57d7a` + `99d0043` |
| Commit kiosk | `8277b93` |
| Commit artefak REA | `f266e33` (`app_360booking`) |

## Kesiapan produksi — ≈90%

| Aspek | Bobot | Skor | Catatan |
|---|---:|---:|---|
| Software/fitur | 25% | 99% | Core, kiosk, branding, backup, kalender selesai |
| Data/migrasi | 20% | 92% | Setup admin + impor user bersih di DB UAT; floor HR belum final |
| Infrastruktur | 15% | 90% | Docker Compose di VM Linux, CMS/API 8082; domain/nginx produksi pending |
| Keamanan | 15% | 90% | CORS host langsung + domain tujuan, JWT secret & password DB di-generate; TLS akhir pending |
| Backup/monitoring | 10% | 80% | Backup + restore test sukses; off-host/alert di luar scope |
| UAT/training | 8% | 88% | UAT Docker jalan, pairing + akses pintu terbukti; training formal oleh owner |
| Hardware | 7% | 70% | CH340 relay terbukti end-to-end; NFC 7-byte + autostart belum |

## Sudah selesai

- CMS/API 3.11.0, APK 1.3.8, branding upload, week start, backup settings.
- **UAT berjalan sebagai stack Docker Compose di VM Linux**: CMS/API di port
  `8082`; CMS root, `/api/health`, dan `/apk/kiosk-release.apk` balas HTTP 200.
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
- Regression 87/87 (0 skip), parity prepare 2/2,
  parity 8/8, client 98/98, server unit 79/79, kiosk 21/21.
- Perubahan UI terakhir (clear filter role) lulus `build:client` + client 98/98.
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
- [x] Tablet dipairing ke server UAT, footer `v1.3.8 (19) · CMS 3.11.0`.
- [x] Akses pintu end-to-end: APK → `/api` validasi kartu 200 → CH340 relay
  di tablet → klik relay fisik.
- [x] Backup + restore test: dump terbaru direstore ke DB disposable;
  users 260, events 114, cards 202, migrations 20; DB uji dihapus.
- [x] Deck training 16 slide (CMS + tablet + screenshot) masuk docs.
- [x] Client 98/98, server unit 79/79, kiosk unit 21/21, typecheck kiosk bersih.
- [x] Regression 87/87 (0 skip) dan parity 8/8 sudah lulus.

## Sisa pekerjaan kita

Tidak ada blocker aplikasi yang tersisa. Sisa pekerjaan ada di sisi deploy
(domain + nginx), training formal, dan hardware opsional:

- [ ] DNS record + vhost nginx untuk `<uat-domain>`; selama ini akses lewat
  `http://<uat-host>:8082` langsung.
- [ ] UAT formal / training pengguna (pemilik produk).
- [ ] Go-live produksi + tag rilis.
- [ ] Hardware opsional: NFC 7-byte, autostart/kiosk lock.
- [ ] 16 kartu placeholder RMH ditunda.

## P1

- Putuskan room usage report (pertahankan/hide).
- Audit format tanggal pada date-picker/kiosk.
