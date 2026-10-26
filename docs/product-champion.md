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
| **Super Admin** | Semua menu (tetap), semua lantai; mengatur **matrix menu per peran** dan membaca **log audit**; bisa menetapkan role Super Admin | Dihapus atau diturunkan role-nya (akun dilindungi) |
| **Admin** | Semua lantai, semua event; kelola user, ruangan, kartu, pengaturan, perangkat tablet, laporan | Mengubah matrix menu, membaca log audit, mengubah akun Super Admin |
| **Resepsionis** | Memesan **atas nama karyawan lain**; melihat dan mengubah booking di **semua lantai yang ia pegang** (`floors`), bukan hanya booking yang ia buat | Memesan di luar lantainya, mengelola user/kartu |
| **Karyawan** | Memesan ruangan di lantai kerjanya, event miliknya/undangannya, ganti sandi sendiri | Memesan lantai lain, melihat detail event orang lain |
| **Akun ruangan** | Login kiosk tablet saja | Masuk CMS |

Karyawan yang butuh ruangan di lantai lain meminta **resepsionis lantai tujuan**
membuat booking atas namanya. Ini jalur resmi lintas lantai; jangan membagikan
akun admin untuk keperluan ini.

## 2. Hari pertama setelah instalasi

Urutan yang aman, jangan diacak:

1. Buka `http://<ip-server>:8082/setup` (stack Docker) atau
   `https://<domain>/setup`, buat akun pertama. Akun itu otomatis berperan
   **Super Admin** dan dilindungi (tidak bisa dihapus/diturunkan). Setelah
   sukses form terkunci (`409 SETUP_COMPLETED`) dan CMS masuk otomatis ke
   kalender.
2. Login, lalu **ganti kata sandi Super Admin** dan simpan di tempat aman.
   Buat akun **Admin** dan **Resepsionis** untuk pemakaian harian — jangan
   pakai akun Super Admin untuk operasional.
3. Isi master data: **ruangan** (nama, lantai, kapasitas, email ruangan),
   **user** (nama, email, employee ID/NIK, role, **lantai kerja — bisa lebih
   dari satu**), **kartu** per user.
4. Cek **Manajemen → Pengaturan**: `self_signup_enabled` (default mati), timer
   check-in (`time_of_event_start_soon`, `not_checked_in_time_limit`), timer
   kunci, timer LED, input meja, hari pertama minggu.
5. Selama masih Super Admin, atur **matrix peran** di bagian bawah Pengaturan
   (lihat §3.6) dan cek **Log audit** kosong/terisi wajar.
6. Pasangkan tablet per ruangan dari layar tablet (URL server, email ruangan,
   sandi) — satu tablet aktif per ruangan. APK terbaru diunduh dari
   `https://<domain>/apk/index.html`.
7. Uji satu booking, satu check-in kartu, satu buka pintu, dan satu laporan.

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
2. Pilih ruangan di salah satu lantai yang dipegang resepsionis; pilihan
   ruangan lantai lain tidak muncul.
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

### 3.6 Lantai kerja (bisa lebih dari satu)

Satu akun bisa memegang beberapa lantai — misalnya resepsionis gedung yang
melayani lantai 1, 3, dan 5, atau staf yang memang lintas lantai.

1. Manajemen → **Pengguna** → Tambah/Edit Pengguna.
2. Di **Lantai kerja**, pilih satu atau beberapa lantai, atau **Semua
   lantai**. Daftar lantai berasal dari lantai ruangan yang sudah dibuat.
3. Simpan. Kolom **Lantai** menampilkan satu chip per lantai; akun tanpa
   lantai diberi chip peringatan "belum diatur".
4. Dampaknya: pilihan ruangan di kalender mengikuti lantai akun, dan
   resepsionis bisa melihat/mengubah booking di semua lantainya. Karyawan
   tanpa lantai akan ditolak `403 FLOOR_REQUIRED` saat memesan.

Data lama tetap aman: akun yang sebelumnya hanya punya satu nilai lantai tetap
terbaca. Saat form disimpan, daftar lantai menjadi acuan dan nilai tunggal
lama ikut diperbarui.

### 3.7 Matrix menu per peran (Super Admin)

1. Login sebagai **Super Admin** → Manajemen → tab **Pengaturan**.
2. Gulir ke bawah ke **Manajemen Peran Pengguna**.
3. Centang menu yang boleh dibuka untuk Admin, Resepsionis, dan Pengguna:
   Kalender, Laporan, Pengguna, Ruangan, Perangkat, Pengaturan.
4. Klik **Simpan matriks**. Perubahan berlaku pada permintaan berikutnya.

Yang perlu diketahui:

- Baris Super Admin terkunci penuh — jangan berharap bisa mencabutnya.
- Matrix juga menutup API, bukan hanya tampilan: peran tanpa menu Pengguna
  tidak bisa membuat/mengubah user, peran tanpa Kalender ditolak di semua
  endpoint `/api/events`.
- Minimal sisakan satu akun Super Admin yang aktif. Kalau akun Super Admin
  terkunci, pemulihan hanya lewat akses database (tim teknis).
- Perubahan matrix tercatat di log audit sebagai **Akses peran diubah**.

### 3.8 Log audit

Super Admin membuka **Pengaturan → Log audit**: 100 entri terbaru, terbaru di
atas, berisi waktu, pelaku, aksi, dan ringkasan nilai lama/baru.

| Tercatat | Tidak tercatat |
|---|---|
| Buat/ubah/hapus pengguna (termasuk role & lantai), kartu (tambah, hilang/aktif, master), reset sandi oleh admin, pengaturan & backup, master card, matrix akses | Login/logout, pembuatan meeting, check-in kiosk, buka pintu |

Nomor kartu disamarkan (hanya 4 digit terakhir). Audit tidak bisa diubah atau
dihapus dari CMS; untuk investigasi mendalam, tim teknis membaca
`tbl_audit_log` langsung dari database.

### 3.9 Update APK tablet

1. Unduh dari `https://<domain>/apk/index.html` (tombol **Download APK**) atau
   tombol **Unduh APK Tablet** di tab Perangkat Tablet.
2. Pindahkan file ke tablet, buka, dan izinkan instalasi (izinkan sekali dari
   browser/file manager).
3. Buka aplikasi kiosk; cek footer `v1.3.8 (19) · CMS 3.11.0`.
4. Cek status **Online** di tab Perangkat Tablet. Bila perangkat sudah tidak
   aktif, pairing ulang dari layar setup tablet.
5. Catat versi yang dipasang di buku serah terima; satu tablet bisa berbeda
   versi dari tablet lain, jadi sebutkan nomor versi saat melapor masalah.

## 4. Batas wewenang product champion

Boleh dilakukan sendiri: membuat/mengubah user, ruangan, kartu, pengaturan,
booking, mencabut perangkat tablet, mengunduh APK, membaca laporan.

Khusus **Super Admin**: mengubah matrix menu per peran dan membaca log audit.
Jangan membagikan akun Super Admin; pemegangnya sebaiknya satu orang/IT.

Wajib melibatkan tim teknis: `docker compose down -v`, `npm run demo` pada
mesin yang dipakai bersama, restore database, impor massal (`--apply`),
mengubah `JWT_SECRET`/env produksi, rotasi sertifikat, dan pembersihan data.

## 5. Bukti dan angka yang boleh dikutip

Angka uji terbaru yang **tercatat** ada di
[`VERSIONING.md`](VERSIONING.md) bagian "Posisi saat ini". Kutip angkanya
beserta tanggalnya; jangan menjanjikan angka baru tanpa menjalankan suite.
Kalau ragu, sebut commit/tanggal bukti, bukan angka.

## 6. Kapan memanggil tim teknis

| Gejala | Cek cepat | Eskalasi bila |
|---|---|---|
| Tidak bisa login | domain email lengkap, akun aktif, role terisi | semua akun gagal → kemungkinan `JWT_SECRET`/server |
| Menu hilang setelah diubah | matrix peran di Pengaturan | perlu Super Admin membuka kembali menunya |
| 403 padahal tombol terlihat | menu peran baru dicabut (±30 detik cache) | minta Super Admin cek matrix |
| 403 pada Log audit / matrix | akun bukan Super Admin | pakai akun Super Admin |
| `/setup` putih atau form terkunci | status `GET /api/setup/status` | `required=false` padahal belum ada admin → cek DB |
| Error 403 `FLOOR_REQUIRED` | lantai user kosong | perlu isi lantai (bisa massal lewat impor) |
| Error 403 `FLOOR_RESTRICTED` | lantai user vs ruangan | tambahkan lantai akun atau pilih ruangan yang benar |
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
