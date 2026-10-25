# Index Dokumentasi RoomBooking

Peta seluruh dokumentasi proyek. Mulai dari
[`handover/START-HERE.md`](handover/START-HERE.md) bila baru bergabung, atau
dari [`../README.md`](../README.md) untuk instalasi cepat.

Versi acuan dokumen: CMS/API **3.11.0** (Ver 3 Rev 12), APK kiosk **1.3.7**
(versionCode 18). Setiap perubahan versi dicatat di
[`VERSIONING.md`](VERSIONING.md).

## Untuk product champion dan operator

| Dokumen | Isi |
|---|---|
| [`product-champion.md`](product-champion.md) | Alur harian, skenario umum, batas wewenang, dan jalur eskalasi |
| [`business-processes.md`](business-processes.md) | Aturan bisnis lengkap yang dijalankan kode (peran, lantai, kartu, rekurensi, kiosk) |
| [`operations-runbook.md`](operations-runbook.md) | Deploy pertama, restart, backup/restore, impor data, re-pair tablet, insiden |
| [`CMS.md`](CMS.md) | Peta halaman CMS, tombol, dan alur tiap layar |
| [`scenarios.md`](scenarios.md) | Katalog skenario uji manual end-to-end |

## Untuk developer

| Dokumen | Isi |
|---|---|
| [`handover/START-HERE.md`](handover/START-HERE.md) | Orientasi 10 menit: apa ini, demo, peta repo, gate kualitas |
| [`architecture.md`](architecture.md) | Komponen, diagram, alur request, zona waktu, privasi proyeksi |
| [`api-reference.md`](api-reference.md) | Endpoint, field, kode error, dan pemetaan ke UI |
| [`erd.md`](erd.md) | ERD dan kamus data tabel utama |
| [`localization.md`](localization.md) | Katalog locale en/id dan alur Crowdin |

## Rilis dan riwayat

| Dokumen | Isi |
|---|---|
| [`project-status.md`](project-status.md) | Status kesiapan, blocker, dan prioritas go-live |
| [`VERSIONING.md`](VERSIONING.md) | Skema `Ver.Rev`, posisi versi saat ini, riwayat tiap Rev |
| [`release-v3.11.0.md`](release-v3.11.0.md) | Catatan rilis Ver 3 Rev 12 + checklist sebelum tag |
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
| [`../deploy/docker/README.md`](../deploy/docker/README.md) | Stack Docker Alpine (`node:20-alpine`, `postgres:16-alpine`, `nginx:alpine`) |
| [`../public/apk/README.md`](../public/apk/README.md) | Riwayat APK yang ditebar di `/apk/kiosk-release.apk` |

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
