# Proses Bisnis RoomBooking

Ringkasan aturan yang dijalankan kode saat ini (diperiksa 2026-10-24).
Referensi teknis: [`architecture.md`](architecture.md),
[`api-reference.md`](api-reference.md), dan [`erd.md`](erd.md).

## 1. Auth dan peran

| Hal | Aturan | Sumber |
|---|---|---|
| Login | Email **atau** username + password; hanya `type='employee'` dengan `role` yang boleh masuk | `auth.service.authenticateCredentials` |
| Token | JWT HS256, `sub` = user id, `iss`/`aud` diperiksa, umur `JWT_EXPIRY_TOKEN` (default 1 hari) | `auth.service.signPrincipalToken` |
| Peran | `role_name` di `tbl_role` diubah ke huruf besar (`ADMIN`/`USER`/`RECEPTIONIST`) | `auth.repository.principalSelect` |
| Admin | Boleh melihat semua event, memesan lintas lantai, mengelola user/ruangan/kartu/settings/perangkat | `adminOnly`, `canView`, `FLOOR_EXEMPT_ROLES` |
| Resepsionis | Non-admin; boleh membuat booking **atas nama karyawan lain** (`organizer_email`) dan melihat/mengubah booking di ruangan pada lantai yang ia pegang (`tbl_users.floors`) | `POST /api/events`, `canView`, `canMutate`, `tbl_events.booked_by` |
| User | Hanya event miliknya/event tempat ia peserta; hanya ruangan lantainya | `listEventsForPrincipal`, `assertRoomFloorAccess` |
| Akun nonaktif | Dihapus (`is_deleted=true`), role dihapus, atau role kosong → request berikutnya `401` | `verifyPrincipalToken` |
| Signup publik | Membuat akun `type='employee'` dengan role `user`; role harus ada di `tbl_role`, jika tidak → error server | `auth.repository.createEmployeeAccount` |
| Cookie | `t` httpOnly ikut dikirim saat login, tetapi CMS menyimpan token di storage dan memakai header Bearer | `auth.controller.signin`, `auth-helper.js` |

Tidak ada refresh token untuk CMS. Sesi berakhir saat JWT kedaluwarsa atau
akun dinonaktifkan; pengguna harus login ulang.

## 2. Siklus user

| Tahap | Aturan |
|---|---|
| Buat | Admin mengisi `name, email, password, roleId` (UUID). Password 8–72 byte; bcrypt cost 12. `card_number` opsional, `master_card=true` hanya berlaku bila kartu diisi |
| Ubah | Self boleh mengubah nama/email/username; `roleId`, `card_number`, dan `floor` hanya admin |
| Ganti sandi | Self wajib menyertakan `oldPassword`; admin boleh mengganti sandi user lain tanpa sandi lama; konfirmasi harus sama |
| Hapus | Soft delete (`is_deleted=true`); kartu master milik user dicabut otomatis |
| Kartu | Ganti nomor kartu → kartu lama dicabut dari `tbl_card_masters`; status master dipindah bila sebelumnya master |
| Login | Email/username unik case-insensitive; duplikat → `409 IDENTITY_EXISTS` |

Catatan: akun ruangan **bukan** user untuk login CMS. Akun ruangan dibuat
lewat endpoint ruangan dan tidak punya `role_id`.

## 3. Siklus ruangan

| Tahap | Aturan |
|---|---|
| Buat | `type='room'`, `role_id=NULL`, email wajib; `password` opsional untuk login kiosk; `floor` menentukan aturan lantai |
| Ubah | Field ruangan (`name,email,username,floor,capacity,building,feature`); `roleId` tidak dipakai |
| Hapus | Soft delete; semua perangkat kiosk ruangan dicabut dan socket-nya diputus |
| Pairing | Hanya satu perangkat aktif per ruangan; pairing kedua ditolak sampai perangkat lama dicabut |
| Ganti sandi ruangan | Semua perangkat kiosk ruangan dicabut (tablet harus pairing ulang) |
| Status | `GET /api/rooms/status` menampilkan okupansi, organizer pertama, dan status tablet online |

Ruangan dianggap “online” bila `last_seen_at` ≤60 detik. Status perangkat
dihitung: `revoked` bila `revoked_at` terisi, `expired` bila refresh
kedaluwarsa, selain itu `active`.

## 4. Meeting: buat, ubah, batal

### 4.1 Membuat

| Langkah | Perilaku |
|---|---|
| Validasi header | Subjek wajib; akhir > mulai; durasi ≤ `MAX_BOOKING_DURATION_HOURS` (default 168 jam); timezone valid |
| Peserta | Minimal satu ruangan aktif; karyawan harus akun aktif; email tamu harus format email (untuk bentuk modern) |
| Lantai | Non-admin hanya boleh memakai ruangan pada lantai yang tercantum di `floors` |
| Rekurensi | Bila `bookingKind=recurring`, occurrence dibangkitkan sebelum transaksi |
| Bentrok | Constraint exclusion DB menolak overlap → `409 ROOM_CONFLICT` |
| Atomisitas | Semua occurrence + peserta ditulis dalam satu transaksi; gagal satu → rollback semua |
| Notifikasi | Setelah commit, invalidasi Socket.io ke organizer, peserta, dan ruangan |

Single booking dari CMS dikirim sebagai array legacy per peserta
(`attendee_email`); recurring memakai `roomIds`/`attendeeIds`/`visitorEmails`.
Keduanya diterima server.

### 4.2 Mengubah

| Scope | Yang berubah |
|---|---|
| `occurrence` | Hanya event yang dipilih. Bila bagian seri, `is_exception=true` |
| `following` | Event dengan `occurrence_index >=` occurrence pivot |
| `series` | Semua occurrence dalam seri + header seri (`subject`, `description`, `timezone`) |

Saat mengubah, jam digeser berdasarkan selisih jam lokal, bukan selisih UTC,
sehingga pergantian DST tidak mengubah jam dinding. Peserta ditulis ulang
(clear + insert) dan `tbl_event_rooms` disusun ulang oleh trigger. Overlap →
`409 ROOM_CONFLICT`; organizer/admin saja yang boleh mengubah.

### 4.3 Membatalkan

- Scope sama: `occurrence`, `following`, `series`.
- Pembatalan mengisi `is_cancel=true`; untuk `series` juga `tbl_event_series.is_cancel=true`.
- Trigger menonaktifkan baris `tbl_event_rooms`, jadi ruangan langsung bebas.
- Event tidak dihapus dari DB; hilang dari kalender dan laporan karena laporan
  hanya membaca booking aktif.
- Menghapus peserta event bersifat hard delete pada `tbl_event_details` dan
  hanya organizer/admin.

### 4.4 Konflik dan preview

`POST /api/events/preview` memakai perencanaan yang sama dengan create dan
mengembalikan maksimal `MAX_PREVIEW_CONFLICTS` (default 50) konflik, plus
`conflictTotal` dan `conflictsTruncated`. Preview **tidak** memeriksa lantai;
pesan lantai baru muncul saat menyimpan.

## 5. Aturan lantai

| Kondisi | Hasil |
|---|---|
| `FLOOR_RESTRICTION=false` | Semua aturan lantai dilewati |
| Role `ADMIN` | Bebas semua lantai |
| `tbl_users.floors` kosong dan `floor` kosong | `403 FLOOR_REQUIRED` |
| `floors` berisi `all` | Boleh semua lantai |
| `floor` ruangan tidak ada di `floors` karyawan | `403 FLOOR_RESTRICTED` |
| Kiosk: kartu karyawan tanpa lantai | `403 FLOOR_REQUIRED` |
| Kiosk: lantai kartu ≠ lantai ruangan | `403 FLOOR_RESTRICTED` |

`tbl_users.floors` adalah daftar lantai yang dipegang akun; `floor` lama tetap
dibaca sebagai fallback bila daftar kosong. Perbandingan lantai memakai string
yang sudah di-trim dan case-insensitive. Gunakan nilai yang konsisten (`1`, `2`, `all`).

### 5.1 Booking atas nama (resepsionis)

| Hal | Aturan |
|---|---|
| Siapa | Role `receptionist` (non-admin) dan `admin` |
| Organizer | Tetap **karyawan** yang namanya diisi di field "Pesan untuk karyawan" (`organizer_email`) |
| Audit | Kolom `tbl_events.booked_by` mencatat user yang membuat booking |
| Ruangan | Hanya ruangan pada lantai yang dipegang resepsionis; pilihan lantai lain tidak tersedia di CMS dan ditolak server |
| Lintas lantai | Hanya untuk lantai yang ada di `floors` resepsionis. Karyawan yang butuh lantai lain meminta resepsionis **lantai tujuan** membuatkannya |
| Ubah/batal | Resepsionis boleh mengubah booking di lantainya atau booking yang ia buat; admin penuh; user biasa tetap hanya booking sendiri |

Field ini hanya dipakai saat membuat booking (`create-only`); nilai yang
dikirim pada update diabaikan.

## 6. Rekurensi

| Parameter | Aturan |
|---|---|
| Cadence | `daily`, `weekly`, `monthly` |
| Interval | 1–52 |
| Hari (weekly) | Array 0–6; 0=Sunday; wajib tidak kosong |
| Pola bulanan | `date` (tanggal sama) atau `weekday` (minggu ke-1..4 atau `-1` = terakhir) |
| Akhir | `endDate` wajib `YYYY-MM-DD`; horizon 0–366 hari |
| Jumlah | Maksimal 200 occurrence |
| Occurrence kosong | Ditolak `400 INVALID_RECURRENCE` |
| Bulan tanpa tanggal | Pola `date` **melewati** bulan itu (mis. 31 Januari tidak muncul di Februari) |
| Akhir pekan | Tidak ada aturan khusus; semua hari valid |

Semua occurrence dibuat sebagai baris event nyata. Header seri hanya menyimpan
cadence/interval/weekdays/end date; pola bulanan tidak tersimpan (lihat
`erd.md` §2.6).

## 7. Kiosk

### 7.1 Pairing dan sesi

1. Admin membuat akun ruangan dengan sandi.
2. Tablet mengirim `POST /api/kiosk/auth` (`email`/`username` ruangan + sandi
   + `deviceName`).
3. Server membuat baris `tbl_kiosk_devices`, mengembalikan access token
   (default 15 menit) dan refresh token (default 30 hari).
4. Tablet menyimpan sesi; saat access token `401`, tablet memanggil
   `/api/kiosk/refresh` dan menyimpan sesi baru.
5. Admin dapat mencabut perangkat di CMS; token_version naik dan socket
   perangkat diputus. Tablet harus pairing ulang.
6. Bila ruangan sudah punya perangkat aktif, pairing baru ditolak
   `409 ROOM_ALREADY_PAIRED`.

### 7.2 Layar dan privasi

- Layar menampilkan state ruangan (tersedia / akan mulai / terpakai / offline)
  dan jadwal hari ini.
- Judul pada tablet **selalu** `[NamaDepan, HH:mm - HH:mm]`.
- Subjek dan nama lengkap organizer hanya dikirim bila admin mengaktifkan
  `showSubject` untuk perangkat itu.
- Tablet memuat ulang `/context` + `/schedule` tiap 20 detik; tidak ada
  koneksi Socket.io dari APK.

### 7.3 Check-in

| Aturan | Nilai |
|---|---|
| Kartu | Kartu organizer, kartu peserta, atau kartu master |
| Ruangan | Event harus memakai ruangan perangkat |
| Jendela | `start - time_of_event_start_soon` sampai `start + not_checked_in_time_limit` |
| Sebelum jendela | `409 CHECK_IN_WINDOW` |
| Sudah check-in | `409 ALREADY_CHECKED_IN` |
| Efek | `tbl_events.checked_in = now()`; state tablet berubah |

Nilai settings berasal dari `tbl_app_settings` baris pertama. Seed demo: buka
10 menit sebelum mulai, toleransi 15 menit.

### 7.4 Selesai lebih awal

- Tombol **Finish/Selesai** di tablet memakai
  `POST /api/kiosk/events/complete` (tanpa kartu, sesuai keputusan produk
  2026-10-23). Sejak APK 1.3.4 tombol ini **disembunyikan** dan baru muncul
  setelah **5 tap** pada pill **IN USE** (easter egg operator) agar tidak
  tersentuh tanpa sengaja.
- Endpoint alternatif `PUT /api/kiosk/events/early-finish` masih ada dan
  mensyaratkan kartu; keduanya hanya berlaku untuk meeting yang sudah
  check-in dan sedang berjalan (`start <= now < end`).
- Efek: `end_date = now()` pada zona event; ruangan bebas; durasi laporan
  terpotong.

### 7.5 Perpanjangan

`POST /api/kiosk/events/extend` menambah 5–60 menit (default 15) hanya untuk
meeting checked-in yang sedang berjalan. Body wajib membawa `card_number`;
server menerima kartu organizer, kartu peserta, atau kartu master dan menolak
kartu lain (`403`). Bila slot berikutnya sudah dipakai → `409 ROOM_CONFLICT`.

### 7.6 Auto-release no-show

- Timer server berjalan setiap 60 detik.
- Booking dilepas bila belum check-in, tidak dibatalkan, dan
  `now >= start + not_checked_in_time_limit`.
- Yang dinonaktifkan hanya baris ruangan (`tbl_event_rooms.active=false`) dan
  peserta ruangan di-soft-delete; **event tetap ada** di kalender peserta dan
  tidak ditandai batal.
- Setelah dilepas, ruangan bisa dipakai meeting lain; invalidasi dikirim ke
  audience event.

### 7.7 Instant booking (“Pesan sekarang”)

| Aturan | Nilai |
|---|---|
| Kartu | Wajib; karyawan aktif; lantai kartu = lantai ruangan |
| Durasi | 5–240 menit; default 30 |
| Akhir | Tidak melewati tengah malam waktu server |
| Pemotongan | Bila `until_next=true`, berakhir di meeting berikutnya hari itu |
| Check-in | Otomatis checked-in (orang sudah di ruangan) |
| Konflik | Slot berikutnya dihormati; bila tidak ada sisa waktu → `409 NO_FREE_WINDOW` |
| Subjek | `Room usage - <nama karyawan>` |

### 7.8 Booking terjadwal hari ini (“Pilih waktu”)

| Aturan | Nilai |
|---|---|
| Hari | Hanya hari ini menurut `APP_TIMEZONE` |
| Mulai | Tidak boleh lewat (toleransi 1 menit) |
| Durasi | 5–240 menit |
| Akhir | Harus hari yang sama |
| Check-in | Mulai ≤2 menit dari sekarang → langsung checked-in; selain itu `scheduled=true` |
| Konflik | `409 ROOM_CONFLICT` |
| Subjek | `Room usage - <nama karyawan>` |

### 7.9 Buka pintu

- `POST /api/kiosk/door-open` dengan kartu master atau kartu karyawan aktif →
  `200`; tablet yang menulis frame relay.
- Endpoint CMS `POST /api/door-open` memakai JWT user dan aturan kartu yang
  sama.
- Nomor kartu tidak dikenal → `400 INVALID_CARD`.

## 8. Laporan pemakaian

| Aspek | Perilaku |
|---|---|
| Akses | Admin (`GET /api/rooms/usage-report`) |
| Rentang | `start`/`end` `YYYY-MM-DD`, inklusif; `start > end` ditolak |
| Sumber | `tbl_event_rooms.active` yang beririsan dengan rentang |
| Pemotongan | Durasi dipotong ke batas rentang (`greatest`/`least`) |
| Total | `total_pemakaian` berupa teks `HH:MM:SS` |
| Daftar meeting | `subject, organizer, description, start_date, end_date, checked_in` |
| Ruangan kosong | Tetap muncul dengan `00:00:00` dan `list_meeting=[]` |
| Zona waktu | Batas rentang ditafsirkan pada `APP_TIMEZONE` |
| Ekspor | XLSX dibuat di browser (ExcelJS), nama sheet/file disanitasi; bukan endpoint server |

Laporan hanya membaca booking **aktif**. Meeting yang dibatalkan atau ruangan
yang dilepas karena no-show tidak dihitung.

## 9. Matriks aturan utama

| Aturan | Nilai default | Dapat diubah lewat |
|---|---|---|
| Zona waktu | `Asia/Jakarta` | `APP_TIMEZONE` |
| Durasi booking maksimum | 168 jam | `MAX_BOOKING_DURATION_HOURS` |
| Rentang kalender maksimum | 366 hari | `MAX_CALENDAR_RANGE_DAYS` |
| Konflik preview maksimum | 50 | `MAX_PREVIEW_CONFLICTS` |
| Horizon rekurensi | 366 hari | `RECURRENCE_MAX_DAYS` |
| Occurrence maksimum | 200 | `RECURRENCE_MAX_OCCURRENCES` |
| Aturan lantai | aktif | `FLOOR_RESTRICTION` |
| Buka check-in | 10 menit sebelum | `time_of_event_start_soon` |
| Toleransi terlambat | 15 menit | `not_checked_in_time_limit` |
| Access token kiosk | 15 menit | `KIOSK_JWT_EXPIRY` |
| Refresh kiosk | 30 hari | `KIOSK_REFRESH_DAYS` |

## 10. Belum dapat diverifikasi

- Belum ada uji usability pengguna pertama (item TODO Phase 10B masih terbuka).
- Perilaku auto-release pada beban nyata dan waktu tepat batas belum diuji
  ulang pada sesi ini; logika dibaca dari kode dan unit/regression test yang
  sudah ada.
- Kebijakan cuti/hari libur tidak ada di kode; kalender menganggap semua hari
  sama.
