# Status Proyek RoomBooking

Snapshot: **2026-10-25, 21:05 WIB**. Angka kesiapan adalah penilaian berbobot, bukan
metrik otomatis.

## Versi dan akses

| Item | Nilai |
|---|---|
| CMS/API | **3.11.0** (Ver 3 Rev 12) |
| APK kiosk | **1.3.8 (19)** |
| URL UAT Docker | `http://<ip-server>:8082` |
| Database | `360booking` |
| Commit app | `bfbb962` + `db57d7a` + `99d0043` |
| Commit kiosk | `8277b93` |
| Commit artefak REA | `f266e33` (`app_360booking`) |

## Kesiapan produksi — ≈86%

| Aspek | Bobot | Skor | Catatan |
|---|---:|---:|---|
| Software/fitur | 25% | 99% | Core, kiosk, branding, backup, kalender selesai |
| Data/migrasi | 20% | 90% | Data UAT terisi; floor HR belum final |
| Infrastruktur | 15% | 88% | Docker 8082 + bootstrap native; TLS/host final di tim deploy |
| Keamanan | 15% | 88% | Auth/CORS/history bersih; TLS, password awal, old SHA |
| Backup/monitoring | 10% | 80% | Backup + restore test sukses; off-host/alert di luar scope |
| UAT/training | 8% | 80% | UAT teknis, perangkat, deck training; formal training oleh owner |
| Hardware | 7% | 35% | NFC 4-byte + LED; relay, 7-byte, autostart belum |

## Sudah selesai

- CMS/API 3.11.0, APK 1.3.8, branding upload, week start, backup settings.
- Kalender 24 jam, format tanggal, validasi backdate, CORS error yang jelas.
- Kiosk: check-in, +15, Finish 5 tap, early-finish hint, judul STARTING SOON,
  hint kartu organizer/peserta/master.
- Impor CSV overwrite transaksional; floor lama dipertahankan bila kolom
  tidak ada; admin aktif terakhir tidak bisa diturunkan (`LAST_ADMIN`).
- Setup admin terlindungi (`is_protected`, migrasi 021): delete `403
  PROTECTED_ACCOUNT`; UAT ADMIN-001 terverifikasi.
- UAT lintas lantai dan multi-room; data kartu UAT.
- Regression 87 tes (85 lulus, 2 skip tengah malam), parity prepare 2/2,
  parity 8/8, client 98/98, server unit 79/79, kiosk 21/21.
- Deploy native satu perintah: `deploy/bootstrap.sh` (IP + HTTP + 80).
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

- [x] Backup + restore test: dump terbaru direstore ke DB disposable;
  users 260, events 114, cards 202, migrations 20; DB uji dihapus.
- [x] Tablet diverifikasi: APK 1.3.8 (19), online, footer CMS 3.11.0.
- [x] Deck training 16 slide (CMS + tablet + screenshot) masuk docs.
- [x] Client 98/98, server unit 79/79, kiosk unit 21/21, typecheck kiosk bersih.
- [x] Regression 87 tes (85 lulus, 2 skip) dan parity 8/8 sudah lulus.

## Sisa pekerjaan kita

Tidak ada blocker aplikasi yang tersisa. Pekerjaan deploy/TLS, training formal,
dan hardware berada di luar scope ini.

## P1

- Tag rilis `v3.11.0`.
- Putuskan room usage report (pertahankan/hide).
- Hardware: relay CH340, NFC 7-byte, autostart/kiosk lock.
- Audit format tanggal pada date-picker/kiosk.
