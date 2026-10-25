# Status Proyek RoomBooking

Snapshot: **2026-10-25**. Angka kesiapan adalah penilaian berbobot, bukan
metrik otomatis.

## Versi dan akses

| Item | Nilai |
|---|---|
| CMS/API | **3.11.0** (Ver 3 Rev 12) |
| APK kiosk | **1.3.7 (18)** |
| URL UAT Docker | `http://<ip-server>:8082` |
| Database | `360booking` |
| Commit app | master terbaru; clean `362456c` |
| Commit kiosk | `6acd7c4` |
| Commit artefak REA | `f266e33` (`app_360booking`) |

## Kesiapan produksi — ≈85%

| Aspek | Bobot | Skor | Catatan |
|---|---:|---:|---|
| Software/fitur | 25% | 99% | Core, kiosk, branding, backup, kalender selesai |
| Data/migrasi | 20% | 90% | Data UAT terisi; floor HR belum final |
| Infrastruktur | 15% | 88% | Docker 8082 + bootstrap native; TLS/host final di tim deploy |
| Keamanan | 15% | 88% | Auth/CORS/history bersih; TLS, password awal, old SHA |
| Backup/monitoring | 10% | 75% | Backup dari Settings; alert/off-host/restore drill belum |
| UAT/training | 8% | 75% | UAT teknis + regression/parity; training formal belum |
| Hardware | 7% | 35% | NFC 4-byte + LED; relay, 7-byte, autostart belum |

## Sudah selesai

- CMS/API 3.11.0, APK 1.3.7, branding upload, week start, backup settings.
- Kalender 24 jam, format tanggal, validasi backdate, CORS error yang jelas.
- Kiosk: check-in, +15, Finish 5 tap, early-finish hint, judul STARTING SOON.
- UAT lintas lantai dan multi-room; data kartu UAT.
- Regression 83/83, parity 8/8, client 96/96, server unit 79/79, kiosk 21/21.
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

## Sisa pekerjaan kita

1. Uji backup + restore (dan salinan off-host bila tersedia).
2. Verifikasi perangkat kiosk setelah perubahan APK/ikon.
3. Rapikan temuan UI/UX yang masih terbuka bila diminta.
4. Jaga regression/parity/client/unit tetap hijau.

## P1

- Tag rilis `v3.11.0`.
- Putuskan room usage report (pertahankan/hide).
- Hardware: relay CH340, NFC 7-byte, autostart/kiosk lock.
- Audit format tanggal pada date-picker/kiosk.
