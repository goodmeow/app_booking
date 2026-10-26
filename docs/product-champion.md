# Panduan Product Champion

Dokumen ini untuk orang yang mendampingi pemakaian RoomBooking sehari-hari:
menjawab pertanyaan pengguna, memandu setup awal, dan memutuskan kapan
memanggil tim teknis. Aturan yang mengikat tetap
[`business-processes.md`](business-processes.md); dokumen ini menjelaskan
_apa yang harus dilakukan_, bukan detail kode.

Versi acuan: CMS/API **3.11.0**, APK kiosk **1.3.8 (19)**.

## 1. Peran dan wewenang

| Peran | Boleh | Tidak boleh |
|---|---|---|
| **Admin** | Semua lantai, semua event; kelola user, ruangan, kartu, pengaturan, perangkat tablet, laporan | — |
| **Resepsionis** | Memesan **atas nama karyawan lain**, hanya untuk ruangan di lantainya sendiri; melihat/mengubah booking yang ia buat | Memesan lintas lantai, mengelola user/kartu |
| **Karyawan** | Memesan ruangan di lantai kerjanya, event miliknya/undangannya, ganti sandi sendiri | Memesan lantai lain, melihat detail event orang lain |
| **Akun ruangan** | Login kiosk tablet saja | Masuk CMS |

Karyawan yang butuh ruangan di lantai lain meminta **resepsionis lantai tujuan**
membuat booking atas namanya. Ini jalur resmi lintas lantai; jangan membagikan
akun admin untuk keperluan ini.

## 2. Hari pertama setelah instalasi

Urutan yang aman, jangan diacak:

1. Buka `http://<ip-server>:8082/setup` (stack Docker) atau
   `https://<domain>/setup`, buat akun admin pertama. Setelah sukses form
   terkunci (`409 SETUP_COMPLETED`) dan CMS masuk otomatis ke kalender.
2. Login, lalu **ganti kata sandi admin** dan simpan di tempat aman.
3. Isi master data: **ruangan** (nama, lantai, kapasitas, email ruangan),
   **user** (nama, email, employee ID/NIK, role, lantai), **kartu** per user.
4. Cek **Manajemen → Pengaturan**: `self_signup_enabled` (default mati), timer
   check-in (`time_of_event_start_soon`, `not_checked_in_time_limit`), timer
   kunci, timer LED, input meja.
5. Pasangkan tablet per ruangan dari layar tablet (URL server, email ruangan,
   sandi) — satu tablet aktif per ruangan.
6. Uji satu booking, satu check-in kartu, satu buka pintu, dan satu laporan.

Event historis dari sistem lama **tidak dimigrasikan**; instalasi baru mulai
dari kalender kosong. Itu keputusan yang disepakati, bukan bug.

## 3. Alur harian yang paling sering ditanya

### 3.1 Karyawan membuat meeting

1. Kalender → **Add Meeting**, pilih ruangan sesuai lantai.
2. Isi subjek, tanggal, jam (format 24 jam), peserta bila perlu.
3. Simpan. Konflik jadwal ditolak dengan pesan yang menyebut ruangan dan jam
   bentrok; gunakan **preview** bila ingin memeriksa slot lebih dulu.
4. Booking berulang memakai mode Recurring (harian/mingguan/bulanan, maksimal
   200 occurrence, horizon 366 hari).

### 3.2 Resepsionis memesan untuk karyawan

1. **Add Meeting** → isi field **"Pesan untuk karyawan"** dengan nama/email
   karyawan (autocomplete).
2. Pilih ruangan di lantai resepsionis; pilihan ruangan lantai lain tidak
   muncul.
3. Simpan. Organizer tetap karyawan tersebut; CMS menampilkan **"Dipesan
   oleh"** untuk audit.

### 3.3 Karyawan tiba di ruangan (tablet)

| State tablet | Arti | Tindakan |
|---|---|---|
| `AVAILABLE` | Tidak ada meeting berjalan | **30 minutes** (instant) atau **Pick a time** memakai kartu |
| Menunggu check-in | Meeting akan/sedang mulai | Tap kartu pada **Check-in** |
| `IN USE` | Meeting berjalan | **+15 menit** dengan kartu organizer/peserta/master |
| `IN USE` tanpa tombol Finish | Disengaja (1.3.7+) | Tap pill **IN USE** 5× untuk memunculkan **Finish**; di 1.3.8 tombol aktif sendiri saat jam mulai |
| `OFFLINE` | Server tak terjangkau setelah 3 percobaan | Cek jaringan/tablet; lihat §6 |

Instant dan "Pick a time" hanya untuk **hari itu**, wajib kartu karyawan, dan
tunduk aturan lantai kartu.

### 3.4 Kartu karyawan

- Maksimal **2 kartu aktif** per user; slot ketiga ditolak.
- Kartu hilang ditandai **`lost`**: record tetap tersimpan, kartu berhenti
  berlaku untuk kiosk dan pintu master.
- Kartu ditemukan → tombol **Aktifkan kembali** (status `active`, `lost_at`
  dikosongkan), hanya bila slot aktif masih di bawah 2.
- Ganti nomor kartu mencabut kartu lama dari master pintu.

### 3.5 Kata sandi

- Akun hasil impor dan akun yang di-reset admin memakai flag
  **wajib ganti kata sandi**; login pertama dipaksa mengganti sandi sebelum
  halaman lain terbuka.
- Flag ini opsional per user: admin bisa mencentang/mematikannya di form
  Pengguna. Untuk akun bersama operasional, matikan; untuk akun pribadi,
  biarkan menyala.

## 4. Batas wewenang product champion

Boleh dilakukan sendiri: membuat/mengubah user, ruangan, kartu, pengaturan,
booking, mencabut perangkat tablet, mengunduh APK, membaca laporan.

Wajib melibatkan tim teknis: `docker compose down -v`, `npm run demo` pada
mesin yang dipakai bersama, restore database, impor massal (`--apply`),
mengubah `JWT_SECRET`/env produksi, rotasi sertifikat, dan pembersihan data.

## 5. Bukti dan angka yang boleh dikutip

Angka uji terakhir yang tercatat untuk 3.10.3: unit **79/79**, client
**92/92**, regresi **83/83**, parity **8/8** (2026-10-24). Kutip angkanya
beserta tanggal; jangan menjanjikan angka baru tanpa menjalankan suite.

## 6. Kapan memanggil tim teknis

| Gejala | Cek cepat | Eskalasi bila |
|---|---|---|
| Tidak bisa login | domain email lengkap, akun aktif, role terisi | semua akun gagal → kemungkinan `JWT_SECRET`/server |
| `/setup` putih atau form terkunci | status `GET /api/setup/status` | `required=false` padahal belum ada admin → cek DB |
| Error 403 `FLOOR_REQUIRED` | lantai user kosong | perlu isi massal lantai |
| Error 403 `FLOOR_RESTRICTED` | lantai user vs ruangan | pemetaan lantai HR belum selesai |
| Tablet `OFFLINE` | kabel/jaringan, URL server di layar setup | server sehat tapi tablet tetap offline |
| Tablet menolak pairing | `409 ROOM_ALREADY_PAIRED` | perlu cabut perangkat lama (admin) |
| NFC tidak terbaca | kartu 4-byte, posisi tap | kartu 7-byte (belum didukung) atau reader rusak |
| LED tidak menyala | pengaturan LED di CMS | tablet memang tanpa LED (didukung sejak 1.3.7) |
| Laporan kosong | rentang tanggal, status check-in | angka tidak cocok dengan kalender |
| CMS 502/blank | `systemctl status` / `docker compose ps` | restart tidak memulihkan |

## 7. Checklist sebelum operasi berisiko

1. Backup terbaru ada dan bisa dibaca (`database/scripts/backup-db.sh`).
2. Tahu apakah yang dijalankan `npm run demo` (menghapus DB demo + pairing)
   atau `demo:resume` (aman untuk pairing).
3. Komunikasikan jendela gangguan ke pengguna ruangan.
4. Setelah selesai: cek `GET /api/health` → `{"ok":true}`, lalu uji satu
   pairing tablet dan satu booking.

## 8. Rujukan

- Aturan lengkap: [`business-processes.md`](business-processes.md)
- Langkah operasional dan insiden: [`operations-runbook.md`](operations-runbook.md)
- Peta layar CMS: [`CMS.md`](CMS.md)
- Riwayat versi: [`VERSIONING.md`](VERSIONING.md)
