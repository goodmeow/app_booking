# Referensi API 360 Scheduler

Diverifikasi langsung dari route/controller/service per 2026-10-24. Semua
endpoint berada di bawah prefiks **`/api`** (`server/routes/index.js:15-21`).
Dokumen ini menggantikan ringkasan di `README.md` bila ada perbedaan.

## 1. Konvensi

| Hal | Aturan |
|---|---|
| Format | JSON (`Content-Type: application/json`), batas body 1 MB |
| Auth user | `Authorization: Bearer <JWT>`; JWT HS256, `iss`/`aud` diperiksa, masa berlaku `JWT_EXPIRY_TOKEN` (default `1d`) |
| Auth kiosk | Bearer JWT audience `360-scheduler-kiosk`, terikat `device_id`, `room_id`, dan `token_version` |
| Cookie | Login CMS juga menaruh cookie `t` (httpOnly, `sameSite=lax`, 24 jam) |
| Envelope error | `{ "error": "<pesan>", "code": "<KODE>", "details"?: ... }`; status 500 menyembunyikan pesan asli |
| Rate limit | Header `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`; kode `429 RATE_LIMITED` |
| Trailing slash | Tidak dipakai route; Express tetap menerima `/users/` karena strict routing mati |
| Zona waktu | Timestamp input wajib berakhiran `Z` atau offset (`+07:00`); tanggal kalender memakai `YYYYMMDD` |
| Status sukses | `201` hanya untuk signup, buat ruangan, buat user, dan buat kartu master; sisanya `200` |

Kode status yang dipakai: `200`, `201`, `400`, `401`, `403`, `404`, `409`,
`429`, `500`.

## 2. Auth

| Method & path | Akses | Body / query | Sukses | Error penting |
|---|---|---|---|---|
| `POST /api/auth/signin` | Publik | `{email\|username, password}` | `200 {token, user:{_id,name,email,username,type,floor,role,mustChangePassword}}` + cookie `t` | `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED` |
| `POST /api/auth/signup` | Publik | `{name, email, username?, password}` | `201 {message}` — hanya bila `self_signup_enabled=true` | `403 SIGNUP_DISABLED` (toggle mati), `400 INVALID_SIGNUP/INVALID_EMAIL/INVALID_USERNAME/INVALID_PASSWORD`, `409 IDENTITY_EXISTS`, `429` |
| `GET /api/auth/signout` | Publik | – | `200 {message:"signed out"}`, cookie dihapus | – |
| `POST /api/door-open` | JWT user | `{card_number}` | `200 {message:"Door opened"}` | `400 INVALID_CARD`, `401` |

Catatan:
- Signin hanya untuk `type="employee"` yang punya `role`; akun ruangan tidak
  bisa login CMS.
- Password harus 8–72 byte UTF-8 untuk signup/ganti sandi; akun demo lama
  (`1234`) dibuat lewat skrip, bukan endpoint ini.
- **Password awal wajib diganti**: akun hasil impor dan akun yang di-reset
  admin memiliki `must_change_password=true`. Login tetap `200`, tetapi semua
  endpoint JWT (kecuali `PUT /api/users/change-password` dan
  `GET /api/auth/signout`) menolak `403 PASSWORD_CHANGE_REQUIRED` sampai
  pemilik mengganti password. Ganti sendiri menghapus flag; reset oleh admin
  menyalakannya kembali.
- Rate limit signin: 10 kegagalan per akun per IP dan 100 kegagalan per IP
  dalam 15 menit; signup 5 per jam per IP saat toggle aktif.
- **Self signup mengikuti toggle** `self_signup_enabled` di
  `tbl_app_settings` (default `false`). Saat mati, endpoint menolak dengan
  `403 SIGNUP_DISABLED`, tombol/halaman Daftar disembunyikan, dan akun hanya
  dibuat admin lewat `POST /api/users`.

## 3. Users

| Method & path | Akses | Body / query | Sukses | Error penting |
|---|---|---|---|---|
| `GET /api/users` | JWT user | `q` (khusus non-admin, minimal 2 karakter) | `200` array karyawan aktif (lihat catatan privasi) | `400 INVALID_QUERY` (q terlalu pendek), `401` |
| `POST /api/users` | JWT admin | `{name, email, employee_id, password, roleId(UUID), username?, floor?, card_number?, master_card?, must_change_password?}` | `201` user + `cards[]` | `400 INVALID_USER/INVALID_EMAIL/INVALID_USERNAME/INVALID_PASSWORD/INVALID_EMPLOYEE_ID`, `403 FORBIDDEN`, `409 IDENTITY_EXISTS/EMPLOYEE_ID_EXISTS` |
| `PUT /api/users/change-password` | JWT user/admin | `{userId?, oldPassword?, newPassword, newPasswordConfirmation}` | `200 {message}`; ganti sendiri menghapus flag, reset admin menyalakannya | `400 INVALID_PASSWORD`, `403`, `404 NOT_FOUND` |
| `GET /api/users/:userId` | JWT self/admin | – | `200` user + `cards[]` | `401`, `403`, `404` |
| `PUT /api/users/:userId` | JWT self/admin | `{name?, email?, username?, employee_id?, must_change_password?, ...}`; `roleId`/`employee_id`/`card_number`/`floor`/`must_change_password` hanya admin | `200` user + `cards[]` | `400`, `403`, `404`, `409 IDENTITY_EXISTS/EMPLOYEE_ID_EXISTS` |
| `DELETE /api/users/:userId` | JWT self/admin | – | `200` user dengan `is_deleted=true` | `401`, `403`, `404` |
| `POST /api/users/:userId/cards` | JWT admin | `{card_number}` | `201 {id, card_number, status, lost_at}` | `400 INVALID_CARD`, `403`, `404`, `409 CARD_EXISTS/CARD_LIMIT` |
| `PATCH /api/users/:userId/cards/:cardId` | JWT admin | `{status: "lost" \| "active"}` | `200 {id, card_number, status, lost_at}` | `400 INVALID_CARD_STATUS`, `403`, `404`, `409 CARD_ALREADY_LOST/CARD_ALREADY_ACTIVE/CARD_LIMIT` |

Catatan:
- Respons tetap berupa array objek (tidak dibungkus `{data: ...}`).
- Admin melihat semua karyawan dengan field lengkap (`employee_id`, `floor`,
  `is_master_card`, `cards[]`); parameter `q` diabaikan untuk admin.
- Non-admin hanya melihat rekan **satu lantai** (`principal.floor`) dengan field
  minimal `{_id, name, email, type}`; `employee_id`, `card_number`, `cards`,
  `is_master_card`, dan `floor` tidak pernah dikirim (`publicEmployee`).
- Non-admin tanpa `floor` menerima `[]` (direktori tidak dibuka), kecuali memakai
  pencarian. Floor `"all"` berarti seluruh direktori, tetap dengan field minimal.
- Non-admin dengan `?q=` minimal 2 karakter: pencarian `contains`
  case-insensitive pada nama atau email, **lintas lantai**, maksimal 20 baris,
  field minimal. `q` kosong (`?q=`) diperlakukan seperti tanpa `q`; `q` satu
  karakter ditolak `400 INVALID_QUERY`.
- `GET /api/users/:userId` tetap `selfOrAdmin`. Pemilik akun menerima `cards[]`
  miliknya sendiri (kredensial pintu/kiosk-nya), tetapi **bukan** `employee_id`;
  field itu hanya untuk admin.
- `employee_id` wajib saat membuat user. Format 1–40 karakter huruf, angka,
  titik, tanda hubung, atau garis bawah; spasi di awal/akhir dibuang. Unik tanpa
  memandang huruf besar/kecil: `emp-001` dan `EMP-001` dianggap sama →
  `409 EMPLOYEE_ID_EXISTS`.
  Saat edit, field ini opsional; bila dikirim tidak boleh kosong (ID tidak bisa
  dihapus) dan tetap tunduk pada aturan unik yang sama.
- Repository direktori hanya memilih `_id,name,email,type`; `publicEmployee`
  tetap dipakai sebagai lapisan kedua supaya `employee_id`, `card_number`,
  `cards`, `is_master_card`, dan `floor` tidak pernah lolos.
- `roleId` wajib UUID; nilai non-UUID ditolak `400` sebelum menyentuh DB.
- Role yang tersedia: `admin`, `user`, dan `receptionist` (case-insensitive;
  JWT membawa bentuk upper-case). `receptionist` adalah role global yang boleh
  membuat booking atas nama karyawan lain, tetapi hanya untuk ruangan di
  lantainya sendiri; tanpa `floor` ia hanya bisa mencari lewat `?q=` dan tidak
  bisa membuat booking (`403 FLOOR_REQUIRED`).
- Kartu karyawan disimpan di `tbl_user_cards`; satu user maksimal **2 kartu
  aktif**. Kartu ke-3 ditolak `409 CARD_LIMIT`, nomor yang sudah dipakai user
  lain ditolak `409 CARD_EXISTS`.
- `PATCH .../cards/:cardId` menerima `status: "lost"` atau `"active"`. Kartu
  tidak pernah dihapus:
  - `lost`: `lost_at` diisi dan nomornya dicabut dari `tbl_card_masters`
    supaya tidak lagi membuka pintu. Mengulang permintaan yang sama
    menghasilkan `409 CARD_ALREADY_LOST`.
  - `active` (kartu ditemukan lagi): `lost_at` dikosongkan dan nomor
    dikembalikan ke `tbl_card_masters`. Ditolak `409 CARD_ALREADY_ACTIVE` bila
    kartu sudah aktif, dan `409 CARD_LIMIT` bila user sudah punya 2 kartu aktif.
- Kartu `lost` tidak dihitung terhadap batas 2, jadi kartu pengganti bisa
  langsung ditambahkan; kartu `lost` juga tidak berlaku untuk check-in, instant
  booking, maupun buka pintu (`400 INVALID_CARD`).
- `card_number` pada `POST`/`PUT /api/users` adalah **jalur legacy** untuk CMS
  lama: nilainya didaftarkan sebagai kartu user (batas 2 tetap berlaku) dan
  tidak lagi menulis kolom `tbl_users.card_number`. Klien baru sebaiknya memakai
  endpoint `cards`.
- Admin mengganti/menandai kartu: status master mengikuti kartu aktif yang
  masih ada di `tbl_card_masters`.
- Menghapus user otomatis mencabut semua nomor kartunya dari `tbl_card_masters`.

## 4. Rooms

Ruangan adalah `tbl_users` dengan `type='room'` dan `role_id=NULL`.

| Method & path | Akses | Body / query | Sukses | Error penting |
|---|---|---|---|---|
| `GET /api/rooms` | JWT user | `building`, `capacity`, `floor` (opsional) | `200` daftar ruangan | `401` |
| `POST /api/rooms` | JWT admin | `{name, email, username?, password?, floor?, capacity?, building?, feature?}` | `201` akun ruangan | `400 INVALID_ROOM/INVALID_EMAIL/INVALID_USERNAME/INVALID_PASSWORD`, `409 IDENTITY_EXISTS` |
| `GET /api/rooms/available` | JWT user | `start_dates`, `end_dates` (ISO), `rooms` (email, opsional) | `200` ruangan bebas | `400 INVALID_RANGE/INVALID_TIME`, `401` |
| `GET /api/rooms/usage-report` | JWT admin | `start`, `end` (`YYYY-MM-DD`) | `200` laporan pemakaian | `400 INVALID_RANGE`, `403` |
| `GET /api/rooms/status` | JWT user | – | `200` status okupansi + tablet online | `401` |
| `GET /api/rooms/:roomId` | JWT user | – | `200` ruangan | `401`, `404` |
| `PUT /api/rooms/:roomId` | JWT admin | field ruangan parsial | `200` ruangan | `400`, `404`, `409` |
| `DELETE /api/rooms/:roomId` | JWT admin | – | `200` ruangan ter-soft-delete | `401`, `403`, `404` |

Menghapus ruangan juga mencabut semua perangkat kiosk aktif milik ruangan itu
(`server/features/rooms/room.controller.js:18-25`), sehingga tablet harus
pairing ulang bila ruangan diaktifkan kembali.

## 5. Events

| Method & path | Akses | Body / query | Sukses | Error penting |
|---|---|---|---|---|
| `GET /api/events` | JWT user | `start`,`end` (`YYYYMMDD`), `rooms` (UUID/email), `all=true` (admin) | `200` event terproyeksi (`organizer`, `booked_by`, `booked_by_name`) | `400 INVALID_RANGE/RANGE_TOO_LARGE`, `404` ruangan |
| `POST /api/events` | JWT user | single: array `{organizer,subject,description,start_date,end_date,timezone?,attendee_email}`; recurring: `{bookingKind:"recurring",subject,description,start,end,timezone,roomIds[],attendeeIds[],visitorEmails[],organizer_email?,recurrence{...}}` | `200 {series, occurrences}` atau array event legacy | `400 INVALID_EVENT/INVALID_RANGE/BOOKING_DURATION_LIMIT/INVALID_TIME/INVALID_TIMEZONE/INVALID_LOCAL_TIME/ROOM_REQUIRED/INVALID_ATTENDEE/INVALID_VISITOR/INVALID_BOOKING_KIND/INVALID_RECURRENCE/RECURRENCE_LIMIT/INVALID_ORGANIZER`, `403 FLOOR_REQUIRED/FLOOR_RESTRICTED/FORBIDDEN`, `409 ROOM_CONFLICT` |
| `POST /api/events/preview` | JWT user | body sama dengan create | `200 {occurrences, conflicts, conflictTotal, conflictsTruncated}` | `400` (semua validasi create), `401` |
| `PUT /api/events` | JWT user | `{id\|eventId, scope:"occurrence"\|"following"\|"series", subject?, start?, end?, timezone?, attendees?:[{attendee_email}]}` | `200` daftar event terbarui | `400 INVALID_SCOPE`, `403`, `404`, `409 ROOM_CONFLICT` |
| `PATCH /api/events/:eventId` | JWT user | sama dengan `PUT /api/events` | `200` | idem |
| `PUT /api/events/delete` | JWT user | query `event_id`, `scope`; body `scope` opsional | `200` event ter-cancel | `400 INVALID_SCOPE`, `403`, `404` |
| `DELETE /api/events/:eventId` | JWT user | query/body `scope` | `200` | `400`, `403`, `404` |
| `POST /api/events/attendee` | JWT user | `{event_id, attendee_email}` atau array (item pertama) | `200` baris peserta | `400`, `403`, `404` |
| `GET /api/events/details` | JWT user | `event_id` | `200` daftar peserta | `401`, `403`, `404` |
| `DELETE /api/events/details` | JWT user | `event_detail_id` | `200` baris terhapus | `401`, `403`, `404` |
| `PUT /api/events/check-in` | JWT user | `{event_id, card_number}` | `200` event checked-in | `400 INVALID_CHECK_IN`, `403`, `404`, `409 CHECK_IN_WINDOW/ALREADY_CHECKED_IN` |
| `PUT /api/events/early-finish` | JWT user | `{event_id}` | `200` event selesai | `403`, `404`, `409 EARLY_FINISH_WINDOW` |

Catatan penting:
- `POST /api/events` **selalu 200**, bukan 201.
- `POST /api/events/preview` **tidak** menegakkan aturan lantai; lantai baru
  diperiksa saat create/update/attendee.
- `PUT /api/events` dan `PATCH /api/events/:eventId` memakai handler yang sama;
  `PUT /api/events/:eventId` tidak ada.
- `scope` hanya berlaku untuk seri; memakai `following`/`series` pada event
  tunggal menghasilkan `400 INVALID_SCOPE`.
- Event yang dibatalkan tetap ada di DB (`is_cancel=true`) dan tidak muncul di
  kalender.
- Untuk single booking, `organizer` di body tidak menentukan pemilik; server
  memakai principal JWT.
- `organizer_email` (opsional, hanya dibaca saat **create**) memindahkan
  kepemilikan booking ke karyawan lain. Hanya principal dengan role `ADMIN`
  atau `RECEPTIONIST` yang boleh mengisinya; role lain ditolak
  `403 FORBIDDEN`. Email dinormalkan (trim + lower-case) dan harus milik akun
  `type='employee'` yang aktif; selain itu `400 INVALID_ORGANIZER`.
- Booking atas nama tetap milik karyawan (`organizer_id` dan `organizer`), dan
  akun pembuatnya dicatat di `booked_by`. `booked_by` hanya terisi bila
  organizer berbeda dari principal, jadi self booking selalu `booked_by=null`.
  Seri berulang menyimpan organizer target yang sama di `tbl_event_series`.
- `organizer_email` **tidak** berlaku untuk update: `PUT /api/events` dan
  `PATCH /api/events/:eventId` tidak pernah memindahkan organizer.
- Aturan lantai tidak berubah: receptionist hanya boleh memakai ruangan di
  lantainya sendiri (`403 FLOOR_RESTRICTED`), admin lintas lantai, dan lantai
  `"all"` tetap lintas lantai. `POST /api/events/preview` tetap tidak memeriksa
  lantai.
- Izin baca dan ubah: `ADMIN`, organizer, peserta (baca), dan akun `booked_by`
  (baca + ubah). Receptionist lain yang bukan `booked_by` tidak mendapat akses
  ke booking tersebut.
- Proyeksi kalender penuh memuat `booked_by` (UUID) dan `booked_by_name` (nama
  akun pembuat); keduanya `null` untuk self booking. Proyeksi `busy` (tanpa
  `can_view_details`) tidak memuat keduanya.

## 6. Settings dan kartu master

| Method & path | Akses | Body / query | Sukses | Error penting |
|---|---|---|---|---|
| `GET /api/settings/public` | Publik | – | `200 {self_signup_enabled}` | – |
| `GET /api/settings` | JWT user | – | `200` objek settings atau `{}` | `401` |
| `PUT /api/settings` | JWT admin | `{id, lock_timer, led_timer, table_input, not_checked_in_time_limit, time_of_event_start_soon, available_color, will_start_color, on_meeting_color, self_signup_enabled}` (semua wajib; boolean untuk `table_input`/`self_signup_enabled`) | `200 {status:"updated"}` | `400 INVALID_SETTINGS`, `404 NOT_FOUND` |
| `GET /api/settings/card-master` | JWT admin | `card_number` (opsional) | `200` daftar kartu | `403` |
| `POST /api/settings/card-master` | JWT admin | `{card_number}` | `201` kartu | `400 INVALID_CARD`, `409 CARD_EXISTS` |
| `PUT /api/settings/card-master/:idCardMaster` | JWT admin | `{card_number}` | `200` kartu | `400 INVALID_CARD`, `404`, `409 CARD_EXISTS` |
| `DELETE /api/settings/card-master/:idCardMaster` | JWT admin | – | `200 {status:"deleted"}` | `404` |

`GET /api/settings/public` sengaja tanpa login dan hanya mengembalikan
`self_signup_enabled`. `GET /api/settings` dapat diakses semua user yang login;
`PUT` hanya admin.
`id` pada body `PUT` adalah `_id` baris settings yang dikembalikan `GET`.

## 7. Kiosk

| Method & path | Akses | Body / query | Sukses | Error penting |
|---|---|---|---|---|
| `POST /api/kiosk/auth` | Publik | `{email\|username, password, deviceName?}` | `200 {token, refreshToken, room, device}` | `401 INVALID_KIOSK_CREDENTIALS`, `409 ROOM_ALREADY_PAIRED`, `429` |
| `POST /api/kiosk/refresh` | Publik (refresh token) | `{refreshToken}` | `200` sesi baru (token + refresh berotasi) | `401 INVALID_KIOSK_REFRESH`, `429` |
| `GET /api/kiosk/devices` | JWT admin | `roomId` (opsional) | `200` daftar perangkat | `401`, `403` |
| `PATCH /api/kiosk/devices/:deviceId/capabilities` | JWT admin | `{nfcEnabled?, ledEnabled?, showSubject?}` minimal satu boolean | `200` perangkat | `400 INVALID_KIOSK_CAPABILITIES`, `404` |
| `DELETE /api/kiosk/devices/:deviceId` | JWT admin | – | `200 {id,status:"revoked"}` | `401`, `403`, `404` |
| `GET /api/kiosk/context` | Token kiosk | – | `200 {room, device, timezone, serverTime, settings}` | `401 KIOSK_AUTH_REQUIRED/INVALID_KIOSK_TOKEN/INACTIVE_KIOSK_DEVICE` |
| `GET /api/kiosk/schedule` | Token kiosk | `start`,`end` (`YYYYMMDD`) | `200` jadwal terproyeksi | `400 INVALID_RANGE/INVALID_TIME`, `401` |
| `DELETE /api/kiosk/device` | Token kiosk | – | `200 {id,status:"revoked"}` | `401`, `404` |
| `POST /api/kiosk/door-open` | Token kiosk | `{card_number}` | `200 {message}` | `400 INVALID_CARD`, `401`, `429` |
| `PUT /api/kiosk/events/check-in` | Token kiosk | `{event_id, card_number}` | `200` event | `400 INVALID_KIOSK_ACTION`, `403`, `404`, `409 CHECK_IN_WINDOW/ALREADY_CHECKED_IN` |
| `POST /api/kiosk/events/extend` | Token kiosk | `{event_id, minutes?}` (5–60, default 15) | `200 {id,start,end,extendedMinutes}` | `400`, `404`, `409 NOT_CHECKED_IN/EXTEND_WINDOW/ROOM_CONFLICT`, `429` |
| `POST /api/kiosk/events/complete` | Token kiosk | `{event_id}` | `200 {id,finishedAt}` | `400`, `404`, `409 EARLY_FINISH_WINDOW` |
| `POST /api/kiosk/events/instant` | Token kiosk | `{card_number, minutes?, until_next?}` | `200 {id,start,end,checkedIn,untilNext}` | `400 INVALID_CARD`, `403 FLOOR_REQUIRED/FLOOR_RESTRICTED`, `409 NO_FREE_WINDOW/ROOM_CONFLICT`, `429` |
| `POST /api/kiosk/events/book` | Token kiosk | `{card_number, start, end}` (hari ini, ISO) | `200 {id,start,end,checkedIn,scheduled}` | `400 INVALID_TIME/INVALID_CARD`, `403 FLOOR_*`, `409 ROOM_CONFLICT`, `429` |
| `PUT /api/kiosk/events/early-finish` | Token kiosk | `{event_id, card_number}` | `200` event | `400`, `403`, `404`, `409 EARLY_FINISH_WINDOW` |

Batas rate kiosk per 15 menit: `door-open` 60, `extend`/`complete` 60,
`instant`/`book` 30, `refresh` 60 (hanya permintaan gagal yang dihitung).

Aturan tambahan:
- Satu ruangan hanya boleh punya satu perangkat aktif; pairing kedua →
  `409 ROOM_ALREADY_PAIRED`. Perangkat dianggap aktif bila `revoked_at IS NULL`
  dan refresh belum kedaluwarsa.
- `instant` dan `book` mensyaratkan kartu karyawan aktif dan lantai kartu sama
  dengan lantai ruangan (`all` = semua lantai).
- `instant`: durasi 5–240 menit, selalu berakhir hari ini, dipotong oleh
  meeting berikutnya bila `until_next=true`.
- `book`: hanya hari ini menurut `APP_TIMEZONE`, mulai tidak boleh lewat,
  5–240 menit, tidak melewati tengah malam; mulai ≤2 menit dari sekarang
  langsung checked-in.

## 8. Health

| Method & path | Akses | Sukses |
|---|---|---|
| `GET /api/health` | Publik | `200 {ok:true}` tanpa info internal |

Dipakai systemd/nginx/CI sebagai probe hidup listener.

## 9. Pemetaan kode error ke UI

Sumber: `client/domain/api-error.js`. Kode yang tidak ada di tabel ini akan
memakai fallback pemanggil atau `apiErrors.requestFailed`.

| Kode API | HTTP | Kunci UI (`common:apiErrors.*`) |
|---|---|---|
| `AUTH_REQUIRED`, `INVALID_TOKEN`, `INACTIVE_PRINCIPAL` | 401 | `authenticationRequired` |
| `INVALID_CREDENTIALS` | 401 | `invalidCredentials` |
| `FORBIDDEN`, `CORS_ORIGIN` | 403 | `forbidden` |
| `NOT_FOUND` | 404 | `notFound` |
| `RATE_LIMITED` | 429 | `rateLimited` |
| `IDENTITY_EXISTS` | 409 | `identityExists` |
| `CARD_EXISTS` | 409 | `cardExists` |
| `INVALID_EMAIL` | 400 | `invalidEmail` |
| `INVALID_USERNAME` | 400 | `invalidUsername` |
| `INVALID_PASSWORD` | 400 | `invalidPassword` |
| `INVALID_CARD` | 400 | `invalidCard` |
| `INVALID_ROOM` | 400 | `invalidRoom` |
| `INVALID_USER` | 400 | `invalidUser` |
| `INVALID_SIGNUP`, `INVALID_EVENT`, `INVALID_ATTENDEE`, `INVALID_BOOKING_KIND`, `INVALID_SCOPE`, `INVALID_SETTINGS` | 400 | `invalidRequest` |
| `INVALID_VISITOR` | 400 | `invalidVisitor` |
| `INVALID_TIME`, `INVALID_TIMEZONE`, `INVALID_LOCAL_TIME` | 400 | `invalidTime` |
| `INVALID_RECURRENCE` | 400 | `invalidRecurrence` |
| `ROOM_REQUIRED` | 400 | `roomRequired` |
| `INVALID_RANGE` | 400 | `invalidRange` |
| `ROOM_CONFLICT` | 409 | `roomConflict` |
| `BOOKING_DURATION_LIMIT` | 400 | `bookingDurationLimit` |
| `RECURRENCE_LIMIT` | 400 | `recurrenceLimit` |
| `ALREADY_CHECKED_IN` | 409 | `alreadyCheckedIn` |
| `CHECK_IN_WINDOW` | 409 | `checkInWindow` |
| `EARLY_FINISH_WINDOW` | 409 | `earlyFinishWindow` |
| `INVALID_CHECK_IN`, `INVALID_KIOSK_ACTION`, `INVALID_KIOSK_CAPABILITIES` | 400 | `invalidKioskAction` |
| `INVALID_KIOSK_CREDENTIALS` | 401 | `invalidKioskCredentials` |
| `INVALID_KIOSK_REFRESH` | 401 | `kioskProvisioningRequired` |
| `INVALID_KIOSK_TOKEN`, `KIOSK_AUTH_REQUIRED`, `INACTIVE_KIOSK_DEVICE` | 401 | `kioskAuthenticationRequired` |
| `INTERNAL_ERROR` | 500 | `requestFailed` |
| `REQUEST_ERROR` | 4xx tanpa kode khusus | `requestFailed` |

Kode yang **belum** punya kunci UI (akan tampil sebagai pesan generik):
`FLOOR_REQUIRED`, `FLOOR_RESTRICTED`, `ROOM_ALREADY_PAIRED`, `NO_FREE_WINDOW`,
`NOT_CHECKED_IN`, `EXTEND_WINDOW`, `RANGE_TOO_LARGE`. APK kiosk menampilkan
`payload.error` dari server, sedangkan CMS memakai fallback
`apiErrors.requestFailed`.

## 10. Kontrak fungsi database (legacy)

`database/migrations/004_functions.sql` memuat 28 fungsi legacy. Server
rekonstruksi **tidak memanggil satu pun** dari fungsi tersebut — verifikasi
`grep` pada `server/` tidak menemukan nama fungsi itu; semua akses data memakai
SQL langsung di `server/features/*/*.repository.js`. Fungsi dipertahankan untuk
paritas skema dan diuji oleh `database/tests/003_function_contracts.sql`.

| Kelompok | Fungsi |
|---|---|
| Kartu master | `card_master_delete_data`, `card_master_get_data`, `card_master_insert_data`, `card_master_update_data`, `card_master_validation` |
| Event | `events_insert_data`, `events_update_data`, `events_update_data_old`, `events_delete_events`, `events_checkin`, `event_early_finished`, `events_list_data_by_attendee`, `events_list_data_by_organizer` |
| Peserta event | `event_details_list_data`, `event_details_new_attendee`, `event_details_delete_data`, `events_delete_attendee` |
| Ruangan | `room_list`, `room_detail`, `room_available_list`, `report_rooms_usage` |
| Settings | `settings_get_data`, `settings_update` |
| User | `users_insert_data`, `users_list`, `users_list_data`, `users_detail`, `users_update_data` |

Cacat legacy yang sudah tercatat (bukan diperbaiki diam-diam):
`room_available_list` punya bug overlap, `users_list` dengan filter memakai
alias `i` yang tidak ada, dan tiga fungsi (`event_details_delete_data`,
`events_delete_attendee`, `events_update_data_old`) hanya dipertahankan untuk
inventaris. Detail: `docs/reconstruction/database-function-coverage.md`.

## 11. Selisih dengan dokumentasi lama

Ditemukan saat verifikasi; jangan dipakai sebagai kontrak:

| Klaim lama | Kenyataan di kode |
|---|---|
| `POST /api/auth/refresh` (README) | Tidak ada. Refresh hanya untuk kiosk: `POST /api/kiosk/refresh` |
| `DELETE /api/events` (client service `deleteEvents`, tidak dipakai UI) | Tidak ada route; akan `404` |
| `PUT /api/events/:eventId` | Yang ada `PATCH /api/events/:eventId` |
| `GET /api/users` mengembalikan `floor`/`card_number` untuk semua user | Non-admin tidak menerima field tersebut |
| `GET /api/rooms/usage-report` mengembalikan ringkasan saja | Mengembalikan `room_name`, `room_mail`, `total_pemakaian`, `list_meeting[]` |

## 12. Belum dapat diverifikasi

- Perilaku di balik reverse proxy dengan `TRUST_PROXY` belum diuji pada sesi
  ini (hanya dibaca dari konfigurasi).
- Respons `429` untuk setiap kombinasi akun/IP belum diuji ulang; angkanya
  berasal dari definisi limiter.
