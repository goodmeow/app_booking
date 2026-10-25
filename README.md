# RoomBooking

## Apa ini

RoomBooking adalah aplikasi pemesanan ruang meeting: **CMS web** untuk admin,
resepsionis, dan karyawan (React 17 + MUI 5), **API + realtime** berbasis
Express dan Socket.io, **PostgreSQL** sebagai basis data, dan **tablet kiosk**
(APK React Native di repo `kioskapp`) yang menempel di depan tiap ruangan.
Tablet menampilkan status ruangan hari itu, menerima check-in, perpanjangan,
pemesanan mendadak, dan membuka pintu lewat kartu NFC.

Versi saat ini: CMS/API **3.11.0** (Ver 3 Rev 12) · APK kiosk **1.3.7**
(versionCode 17). Riwayat lengkap ada di [`docs/VERSIONING.md`](docs/VERSIONING.md).

- Baru bergabung? Mulai dari [`docs/handover/START-HERE.md`](docs/handover/START-HERE.md).
- Mencari dokumen tertentu? Lihat index [`docs/README.md`](docs/README.md).

## Quick install (Docker Alpine)

Stack ini menjalankan tiga container: `db` (`postgres:16-alpine`), `app`
(`node:20-alpine`), dan `web` (`nginx:alpine`) yang menyajikan CMS sekaligus
mem-proxy `/api` dan `/socket.io`.

```bash
git clone <repo-url> app_booking
cd app_booking

# jalankan dari root repo (build context harus root)
docker compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine \
  up -d --build

docker compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine ps
```

Buka `http://<ip-server>:8082`. Bila CMS diakses dari perangkat lain di LAN,
set dulu origin-nya agar CORS lolos:

```bash
ALPINE_CORS_ORIGINS=http://<ip-server>:8082 \
docker compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine up -d
```

Lalu:

1. Buka **`/setup`** dan buat akun admin pertama. Entrypoint container sudah
   menerapkan seluruh migrasi dan seed role, jadi form setup hanya muncul pada
   database yang belum punya admin. Setelah sukses form terkunci
   (`409 SETUP_COMPLETED`) dan CMS masuk otomatis.
2. **Impor data awal (fresh install).** Ikuti
   [`docs/operations-runbook.md`](docs/operations-runbook.md) §5.3: backup dulu,
   `preflight-import.mjs`, dry-run, lalu `import-fresh-assets.mjs` untuk
   ruangan + master card dan `import-bjb-users.mjs --fresh --apply` untuk
   user + kartu. Event historis **tidak** dimigrasikan.
3. **Pairing ulang tablet** dari layar kiosk (URL server, email ruangan, sandi
   ruangan). Satu tablet aktif per ruangan; perangkat lama harus dicabut lebih
   dulu bila server pernah dipakai.

Alternatif deploy Ubuntu + systemd + nginx ada di
[`deploy/README.md`](deploy/README.md) dan
[`docs/operations-runbook.md`](docs/operations-runbook.md) — pilih satu jalur,
jangan dicampur.

## Setelah setup

1. **Login** sebagai admin, lalu **ganti kata sandi** dan simpan di tempat aman.
2. Isi master data lewat **Manajemen**: ruangan (nama, lantai, kapasitas,
   email ruangan), user (nama, email, employee ID/NIK, role, lantai), dan
   kartu per user.
3. Periksa **Manajemen → Pengaturan**: pendaftaran mandiri (default mati),
   timer check-in, timer kunci, timer LED, input meja.
4. Cek tablet: layar menampilkan jadwal hari ini, versi `v1.3.7 (18) · CMS
   3.11.0` di footer.
5. Uji satu booking, satu check-in kartu, satu buka pintu, dan satu laporan
   pemakaian ruangan.

## Peran dan aturan produk

| Peran | Ringkas |
|---|---|
| **Admin** | Semua lantai dan semua event; kelola user, ruangan, kartu, pengaturan, perangkat tablet, laporan |
| **Resepsionis** | Memesan **atas nama karyawan** untuk ruangan di lantainya sendiri; melihat booking yang ia buat |
| **Karyawan** | Memesan ruangan di lantai kerjanya, event miliknya, ganti sandi sendiri |

Aturan yang sering ditanyakan:

- **Lantai.** Karyawan hanya memesan ruangan di lantai kerjanya (kolom
  `floor`). Lantai kosong ditolak `403 FLOOR_REQUIRED`; lantai berbeda ditolak
  `403 FLOOR_RESTRICTED`. Lintas lantai hanya lewat **resepsionis lantai
  tujuan** yang membuat booking atas nama karyawan tersebut.
- **Kartu.** Maksimal **2 kartu aktif** per user. Kartu hilang ditandai
  **`lost`** (record tetap ada, tidak berlaku untuk kiosk/pintu) dan bisa
  **diaktifkan kembali** bila ditemukan, selama slot aktif masih di bawah 2.
- **Perpanjangan.** **+15 menit** di tablet wajib tap kartu organizer, peserta,
  atau master card; server yang memverifikasi, bukan sekadar tombol UI.
- **Kata sandi.** Akun impor dan akun hasil reset admin wajib mengganti sandi
  saat login pertama; flag ini bisa dicentang/dimatikan per user oleh admin.
- **Pendaftaran mandiri.** Default **mati**; tombol Daftar dan `/signup`
  hilang, endpoint signup menolak `403 SIGNUP_DISABLED`. Akun dibuat admin
  lewat tab Pengguna.
- **Data historis.** Event lama tidak dimigrasikan — instalasi baru mulai dari
  kalender kosong (keputusan sadar, bukan bug).
- **Kiosk.** Tombol **Finish** adalah easter egg: 5 tap pada pill **IN USE**.
  LED opsional (tablet tanpa path LED tetap jalan). NFC yang didukung baru
  kartu **UID 4 byte**; UID 7 byte belum.

Detail aturan lengkap: [`docs/business-processes.md`](docs/business-processes.md).
Panduan harian dan eskalasi untuk pendamping produk:
[`docs/product-champion.md`](docs/product-champion.md).

## Operasional singkat

```bash
C="docker compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine"

# health check
curl -fsS http://<ip-server>:8082/api/health        # {"ok":true}

# status, log, restart satu service
$C ps
$C logs -f app
$C restart app

# hentikan stack (volume DB tetap, pairing tablet aman)
$C down

# hentikan dan hapus data (HANYA untuk instalasi uji)
$C down -v
```

- **Backup/restore.** Backup harian + uji restore: lihat
  [`docs/operations-runbook.md`](docs/operations-runbook.md) §5. Untuk stack
  Alpine, salin volume `roombooking-alpine_alpine-db-data`
  ([`deploy/docker/README.md`](deploy/docker/README.md)).
- **APK tablet.** Unduh dari CMS atau langsung di
  `/apk/kiosk-release.apk`; riwayat versi di
  [`public/apk/README.md`](public/apk/README.md).
- **Deploy Ubuntu (systemd + nginx).** `sudo systemctl restart
  360booking-server`, log via `sudo journalctl -u 360booking-server -n 50`.
- **Jangan** menjalankan `down -v`, restore, atau impor `--apply` tanpa backup
  terbaru dan persetujuan tim teknis.

## Troubleshooting

| Gejala | Penyebab umum | Tindakan |
|---|---|---|
| Tidak bisa login | email tidak memakai domain lengkap; akun nonaktif; role kosong | tulis email utuh (`nama@<domain>`), cek status akun di Manajemen → Pengguna |
| Halaman `/setup` putih atau form terkunci | instalasi sudah punya admin; cache gate | cek `GET /api/setup/status`; `required=false` berarti setup memang selesai — login biasa |
| Tablet `OFFLINE` | kabel/jaringan, URL server salah, server restart | cek kabel + URL di layar setup; tablet mencoba 3× sebelum `OFFLINE` dan pulih sendiri |
| LED tidak menyala | tablet tanpa LED, timer LED mati | 1.3.7 mendukung tablet tanpa LED; cek `led_timer` di Pengaturan |
| NFC tidak terbaca | kartu 7 byte, posisi tap, reader | hanya UID 4 byte yang didukung; daftarkan UID yang tampil di layar |
| Jadwal tablet `OFFLINE` terus | `/api/health` gagal, CORS, TLS | cek health dari jaringan tablet, `ALPINE_CORS_ORIGINS`, sertifikat |
| Booking ditolak `403 FLOOR_RESTRICTED` | lantai user ≠ lantai ruangan | pilih ruangan sesuai lantai, atau minta resepsionis lantai tujuan |
| Tombol Selesai tidak ada | desain 1.3.7 | tap pill **IN USE** 5×; sebelum jam mulai muncul “Tombol Selesai aktif pukul HH:MM” |

Tabel insiden yang lebih lengkap: [`docs/operations-runbook.md`](docs/operations-runbook.md) §9.

## Peta dokumentasi

| Dokumen | Isi |
|---|---|
| [`docs/README.md`](docs/README.md) | Index seluruh dokumentasi |
| [`docs/handover/START-HERE.md`](docs/handover/START-HERE.md) | Orientasi cepat untuk developer/operator baru |
| [`docs/CMS.md`](docs/CMS.md) | Peta halaman dan alur CMS |
| [`docs/api-reference.md`](docs/api-reference.md) | Endpoint, field, kode error |
| [`docs/architecture.md`](docs/architecture.md) | Komponen, alur request, kiosk & hardware |
| [`docs/business-processes.md`](docs/business-processes.md) | Aturan bisnis lengkap |
| [`docs/product-champion.md`](docs/product-champion.md) | Alur harian, skenario, eskalasi |
| [`docs/operations-runbook.md`](docs/operations-runbook.md) | Instalasi, env, systemd, nginx, TLS, backup, impor |
| [`docs/erd.md`](docs/erd.md) | ERD dan kamus data |
| [`docs/VERSIONING.md`](docs/VERSIONING.md) | Skema versi dan riwayat Rev |
| [`docs/release-v3.11.0.md`](docs/release-v3.11.0.md) | Catatan rilis 3.11.0 + checklist tag |
| [`docs/release-v3.10.4.md`](docs/release-v3.10.4.md) | Catatan rilis 3.10.4 |
| [`docs/release-v3.10.3.md`](docs/release-v3.10.3.md) | Catatan rilis 3.10.3 (riwayat) |
| [`database/README.md`](database/README.md) | Migrasi, seed, dan batas aman database uji |
| [`database/scripts/README.md`](database/scripts/README.md) | Skrip backup, restore, preflight, impor |
| [`deploy/README.md`](deploy/README.md) | Deploy Ubuntu 22.04 (`deploy/01`…`05`) |
| [`deploy/docker/README.md`](deploy/docker/README.md) | Stack Docker Alpine |
| [`TODO.md`](TODO.md) | Status pengerjaan dan bukti uji |

## Lisensi

MIT — lihat `LICENSE`.
