# Index Dokumentasi RoomBooking

Peta seluruh dokumentasi proyek. Mulai dari
[`handover/START-HERE.md`](handover/START-HERE.md) bila baru bergabung, atau
dari [`../README.md`](../README.md) untuk instalasi cepat.

Versi acuan dokumen: CMS/API **3.12.1** (Ver 3 Rev 13), APK kiosk **1.4.5**
(versionCode 26, build tag `1.4.5-26-a6390a2`). Setiap perubahan versi dicatat
di [`VERSIONING.md`](VERSIONING.md).

Lingkungan saat ini (2026-10-30, commit `9c96999`, migrasi terakhir
`026_event_room_timezone.sql`): UAT local test bed `http://127.0.0.1:8082` dan
UAT live `http://<uat-host>:8082`, keduanya app/web/db sehat. Bukti uji
terakhir: client **99/99**, unit server **85/85**, regresi **105/105**, parity
**8/8**. Alur `npm run demo` sudah tidak dipakai; lihat
[`operations-runbook.md`](operations-runbook.md) §3.

## Untuk product champion dan operator

| Dokumen | Isi |
|---|---|
| [`product-champion.md`](product-champion.md) | Alur harian, skenario umum, batas wewenang per peran, dan jalur eskalasi |
| [`business-processes.md`](business-processes.md) | Aturan bisnis lengkap yang dijalankan kode (peran, lantai, kartu, rekurensi, kiosk) |
| [`operations-runbook.md`](operations-runbook.md) | Deploy pertama, restart, backup/restore, impor data, re-pair tablet, insiden |
| [`backup-restore.md`](backup-restore.md) | Prosedur backup, verifikasi restore, restore produksi Docker/native, rollback |
| [`CMS.md`](CMS.md) | Peta halaman CMS, tombol, dan alur tiap layar (termasuk matrix peran dan log audit) |
| [`user-import.md`](user-import.md) | Bulk import user dari CSV: employee_id sebagai master key, skip/overwrite, kartu |
| [`scenarios.md`](scenarios.md) | Katalog skenario uji manual end-to-end |
| [`training/RoomBooking-Panduan-CMS-Tablet.pptx`](training/RoomBooking-Panduan-CMS-Tablet.pptx) | Deck 22 slide: panduan CMS + tablet (termasuk Super Admin, multi-lantai, audit, update APK) |

## Untuk developer

| Dokumen | Isi |
|---|---|
| [`handover/START-HERE.md`](handover/START-HERE.md) | Orientasi 10 menit: apa ini, lingkungan uji, peta repo, gate kualitas |
| [`architecture.md`](architecture.md) | Komponen, diagram, alur request, zona waktu, privasi proyeksi |
| [`api-reference.md`](api-reference.md) | Endpoint, field, kode error, dan pemetaan ke UI |
| [`erd.md`](erd.md) | ERD dan kamus data tabel utama |
| [`localization.md`](localization.md) | Katalog locale en/id dan alur Crowdin |

## Rilis dan riwayat

| Dokumen | Isi |
|---|---|
| [`project-status.md`](project-status.md) | Status kesiapan, blocker, dan prioritas go-live |
| [`VERSIONING.md`](VERSIONING.md) | Skema `Ver.Rev`, posisi versi saat ini, riwayat tiap Rev |
| [`release-v3.12.0.md`](release-v3.12.0.md) | Catatan rilis Ver 3 Rev 13 + checklist sebelum tag |
| [`release-v3.10.4.md`](release-v3.10.4.md) | Catatan rilis Ver 3 Rev 11 |
| [`release-v3.10.3.md`](release-v3.10.3.md) | Catatan rilis Ver 3 Rev 10 (riwayat) |
| [`baseline/README.md`](baseline/README.md) | Baseline rekonstruksi (runtime, checksum artefak `dist/`) |
| [`reconstruction/`](reconstruction/) | Laporan rekonstruksi per fase (paritas server/client, peta modul, audit) |
| [`reference/README.md`](reference/README.md) | Aturan material referensi dan sanitasi |

## Basis data dan deploy

| Dokumen | Isi |
|---|---|
| [`../database/README.md`](../database/README.md) | Batas aman database uji, rebuild migrasi, seed sanitized |
| [`../database/scripts/README.md`](../database/scripts/README.md) | Skrip backup, restore, reset, preflight, dan impor |
| [`../deploy/README.md`](../deploy/README.md) | Deploy Ubuntu 22.04 lewat `deploy/01`…`05` |
| [`../deploy/docker/README.md`](../deploy/docker/README.md) | Stack Docker Alpine (`node:22-alpine`, `postgres:16-alpine`, `nginx:alpine`) |
| [`../public/apk/README.md`](../public/apk/README.md) | Riwayat APK yang ditebar di `/apk/kiosk-release.apk`; halaman unduh `/apk/index.html` |

## Catatan proyek

| Dokumen | Isi |
|---|---|
| [`../TODO.md`](../TODO.md) | Status pengerjaan per fase, bukti uji, dan sisa item |
| [`../AGENTS.md`](../AGENTS.md) | Aturan kerja agen/rekan tim (XERJ, gaya kode, larangan rahasia) |
| [`design/tablet-ruang-meeting-cms.html`](design/tablet-ruang-meeting-cms.html) | Mockup HTML tampilan tablet dan CMS |

## Konvensi penulisan dokumen

- Body dokumen berbahasa Indonesia; nama berkas, kode, dan istilah teknis
  tetap Inggris.
- Placeholder wajib: `<ip-server>`, `<domain>`, `<email>`. Jangan menulis IP,
  email pribadi, nomor kartu, atau kata sandi nyata.
- Angka uji yang dicantumkan harus berasal dari bukti terakhir yang tercatat
  (commit atau entri `TODO.md` bertanggal), bukan perkiraan.
- Dokumen yang sudah valid dipindahkan isinya, bukan diduplikasi; README root
  hanya ringkasan dan tautan.
