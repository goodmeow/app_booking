# Katalog Skenario Eksekusi

Skenario manual dengan `curl` dan UI untuk membuktikan perilaku yang
didokumentasikan. Semua akun adalah akun demo tersanitasi dari
`database/seeds/development.sql` / `scripts/demo-accounts.js`; kartu nyata
tidak boleh dipakai.

## 0. Prasyarat

```bash
cd app_booking
npm run demo            # DB disposable + CMS :8081 + API :9091
# hanya bila baru menjalankan regression (DB ter-reset):
# npm run demo:accounts
```

| Variabel | Nilai |
|---|---|
| `API` | `http://localhost:9091/api` |
| `ROOM_ONE` | `30000000-0000-4000-8000-000000000001` (room-one, lantai 1) |
| `ROOM_TWO` | `30000000-0000-4000-8000-000000000002` (room-two, lantai 2) |
| `USER_ID` | `20000000-0000-4000-8000-000000000002` (user@example.test) |
| `VIEWER_ID` | `20000000-0000-4000-8000-000000000003` |
| `ROLE_USER` | `67e9500b-908a-497d-9d3b-54bc020700cb` |
| `CARD` | `<kartu-uji>` — ganti dengan kartu dummy demo `TEST-USER-CARD` |

Akun demo:

| Peran | Email | Sandi | Catatan |
|---|---|---|---|
| Admin | `admin@example.test` | `ParityTest123!` | akses penuh |
| Karyawan | `user@example.test` | `ParityTest123!` | lantai 1, kartu dummy |
| Viewer | `viewer@example.test` | `ParityTest123!` | bukan peserta meeting admin |
| Ruangan | `room-one@room.com` | `RoomTablet123!` | untuk pairing tablet |

Sandi seed diverifikasi dengan `bcrypt.checkpw` terhadap hash di
`database/seeds/development.sql` (bukan ditebak dari README).

Skenario kiosk yang memakai "hari ini" sebaiknya dijalankan pada jam kerja
(08:00–21:00 `Asia/Jakarta`); menjelang tengah malam slot dapat terpotong atau
ditolak karena aturan akhir hari.

```bash
API=http://localhost:9091/api
ROOM_ONE=30000000-0000-4000-8000-000000000001
ROOM_TWO=30000000-0000-4000-8000-000000000002
USER_ID=20000000-0000-4000-8000-000000000002
ROLE_USER=67e9500b-908a-497d-9d3b-54bc020700cb
CARD='<kartu-uji>'   # demo dummy: TEST-USER-CARD
```

Parser token (butuh `python3`):

```bash
token() { python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])'; }
```

## 1. Login dan otorisasi

```bash
ADMIN_TOKEN=$(curl -s -X POST "$API/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.test","password":"ParityTest123!"}' | token)

USER_TOKEN=$(curl -s -X POST "$API/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.test","password":"ParityTest123!"}' | token)

VIEWER_TOKEN=$(curl -s -X POST "$API/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@example.test","password":"ParityTest123!"}' | token)
```

| Cek | Perintah | Hasil yang diharapkan |
|---|---|---|
| Login salah | `curl -s -o /dev/null -w '%{http_code}' -X POST "$API/auth/signin" -H 'Content-Type: application/json' -d '{"email":"admin@example.test","password":"salah"}'` | `401`, body `code=INVALID_CREDENTIALS` |
| Tanpa token | `curl -s -o /dev/null -w '%{http_code}' "$API/users"` | `401` |
| User biasa buka admin | `curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $USER_TOKEN" "$API/settings/card-master"` | `403` |
| Akun ruangan login CMS | login `room-one@room.com` / `RoomTablet123!` | `401 INVALID_CREDENTIALS` (room bukan employee) |
| Health | `curl -s "$API/health"` | `{"ok":true}` |

## 2. Membuat meeting tunggal (bentuk CMS)

CMS mengirim array per peserta. Slot 2031-06-02 02:00Z = 09:00 WIB.

```bash
EVENT_ID=$(curl -s -X POST "$API/events" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "[{
    \"organizer\":\"user@example.test\",
    \"subject\":\"Rapat uji tunggal\",
    \"description\":\"skenario docs\",
    \"start_date\":\"2031-06-02T02:00:00.000Z\",
    \"end_date\":\"2031-06-02T03:00:00.000Z\",
    \"timezone\":\"Asia/Jakarta\",
    \"attendee_email\":\"room-one@room.com\"
  }]" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
echo "$EVENT_ID"
```

Harapan: `200`, array dengan `id`, `start`, `end`, `event_detail_id`.
`EVENT_ID` menyimpan id event. Ulangi perintah yang sama tanpa menimpa
variabel → `409 ROOM_CONFLICT` (constraint exclusion).

## 3. Membuat meeting modern + tamu

```bash
curl -s -X POST "$API/events" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"bookingKind\":\"single\",
    \"subject\":\"Rapat dengan tamu\",
    \"description\":\"skenario docs\",
    \"start\":\"2031-06-03T02:00:00.000Z\",
    \"end\":\"2031-06-03T03:00:00.000Z\",
    \"timezone\":\"Asia/Jakarta\",
    \"roomIds\":[\"$ROOM_ONE\"],
    \"attendeeIds\":[\"$USER_ID\"],
    \"visitorEmails\":[\"tamu@contoh.id\"]
  }"
```

Harapan: `200 {series:null, occurrences:[{id,start,end,occurrenceIndex}]}`.
Gunakan `YYYY-MM-DD` yang belum terpakai agar tidak bentrok.

## 4. Rekurensi mingguan

2031-07-07 adalah hari Senin (`weekday` 1).

```bash
curl -s -X POST "$API/events" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"bookingKind\":\"recurring\",
    \"subject\":\"Rapat mingguan\",
    \"description\":\"skenario docs\",
    \"start\":\"2031-07-07T02:00:00.000Z\",
    \"end\":\"2031-07-07T03:00:00.000Z\",
    \"timezone\":\"Asia/Jakarta\",
    \"roomIds\":[\"$ROOM_ONE\"],
    \"attendeeIds\":[],
    \"visitorEmails\":[],
    \"recurrence\":{\"cadence\":\"weekly\",\"interval\":1,\"weekdays\":[1],\"endDate\":\"2031-07-28\"}
  }"
```

Harapan: `200`, `series` terisi, `occurrences` berisi 4 Senin
(7, 14, 21, 28 Juli 2031), masing-masing `occurrenceIndex` 0–3.

| Kasus gagal | Body | Harapan |
|---|---|---|
| Cadence salah | `cadence:"yearly"` | `400 INVALID_RECURRENCE` |
| Akhir sebelum mulai | `endDate:"2031-05-01"` | `400 RECURRENCE_LIMIT` atau `INVALID_RECURRENCE` |
| Weekly tanpa hari | `weekdays:[]` | `400 INVALID_RECURRENCE` |
| Pola bulanan salah | `monthlyPattern:"nth"` | `400 INVALID_RECURRENCE` |
| Terlalu banyak | harian interval 1 sampai 2032-06-01 | `400 RECURRENCE_LIMIT` |

## 5. Preview konflik

```bash
curl -s -X POST "$API/events/preview" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "[{
    \"organizer\":\"user@example.test\",
    \"subject\":\"Cek konflik\",
    \"description\":\"-\",
    \"start_date\":\"2031-06-02T02:30:00.000Z\",
    \"end_date\":\"2031-06-02T03:30:00.000Z\",
    \"attendee_email\":\"room-one@room.com\"
  }]"
```

Harapan: `200 {occurrences, conflicts:[{roomId,start,end}], conflictTotal≥1,
conflictsTruncated:false}` — tanpa error, karena preview tidak menulis.

## 6. Aturan lantai

```bash
# User lantai 1 memesan room-two (lantai 2): harus 403
curl -s -o /tmp/floor.json -w '%{http_code}\n' -X POST "$API/events" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "[{\"organizer\":\"user@example.test\",\"subject\":\"Lintas lantai\",\"description\":\"-\",
       \"start_date\":\"2031-06-04T02:00:00.000Z\",\"end_date\":\"2031-06-04T03:00:00.000Z\",
       \"attendee_email\":\"room-two@room.com\"}]"
python3 -m json.tool /tmp/floor.json   # code FLOOR_RESTRICTED
```

Admin memakai body yang sama dengan `$ADMIN_TOKEN` → `200`:

```bash
curl -s -X POST "$API/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "[{\"organizer\":\"admin@example.test\",\"subject\":\"Lintas lantai admin\",\"description\":\"-\",
       \"start_date\":\"2031-06-04T02:00:00.000Z\",\"end_date\":\"2031-06-04T03:00:00.000Z\",
       \"timezone\":\"Asia/Jakarta\",\"attendee_email\":\"room-two@room.com\"}]"
```

Karyawan tanpa `floor`/`floors` → `403 FLOOR_REQUIRED`; atur lewat
`PUT /api/users/$USER_ID` dengan body `{"floors":["1"]}` (admin).

### 6.1 Multi-lantai dan resepsionis

`floors` adalah daftar; `floor` lama tetap diterima sebagai satu nilai.

```bash
# Akun memegang dua lantai: boleh ruangan lantai 1 dan 2, ditolak lantai 3
curl -s -X PUT "$API/users/$USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"floors":["1","2"]}'
```

| Kasus | Harapan |
|---|---|
| `{"floors":["1","2"]}` lalu booking room-two | `200` |
| `{"floors":["1"]}` lalu booking room-two | `403 FLOOR_RESTRICTED` |
| `{"floors":["all"]}` | semua ruangan boleh |
| `{"floors":[]}` | `403 FLOOR_REQUIRED` saat booking |
| `{"floors":["a","b", ... 21 nilai]}` | `400 INVALID_FLOOR` (maks. 20) |

Resepsionis: booking milik karyawan di lantainya bisa diubah walau ia bukan
pembuatnya (`booked_by` lain). Buka detail event dengan token resepsionis →
`200`; dengan token karyawan lain di lantai berbeda → `403`.

### 6.2 Matrix menu dan log audit

Kedua endpoint hanya untuk Super Admin. **Akun demo `admin@example.test`
adalah ADMIN biasa**, jadi promosikan dulu di database disposable (cara yang
sama dipakai `server/tests/regression/access.test.js`), lalu login ulang:

```sql
UPDATE tbl_users
SET role_id = (SELECT _id FROM tbl_role WHERE lower(role_name) = 'super_admin')
WHERE email = 'admin@example.test';
```

Instalasi baru yang dibuat lewat `/setup` sudah otomatis Super Admin, jadi
langkah di atas hanya untuk database demo.

```bash
SUPER_TOKEN=$(curl -s -X POST "$API/auth/signin" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.test","password":"ParityTest123!"}' | token)

curl -s -H "Authorization: Bearer $SUPER_TOKEN" "$API/access/menus"
curl -s -H "Authorization: Bearer $SUPER_TOKEN" "$API/access/matrix"
curl -s -H "Authorization: Bearer $SUPER_TOKEN" "$API/audit?limit=5"
```

| Kasus | Harapan |
|---|---|
| `GET /api/access/matrix` dengan token ADMIN (bukan Super Admin) | `403` |
| `GET /api/audit` dengan token ADMIN | `403` |
| `PUT /api/access/matrix` dengan baris `super_admin` | `400 INVALID_MENU_ACCESS` |
| `PUT` matikan `calendar` untuk role `user`, lalu login user itu | menu kalender hilang; `GET /api/events` → `403` |
| `PUT` matikan `users` untuk role `receptionist` | `POST /api/users` dengan token resepsionis → `403` |
| Setelah ubah matrix | `GET /api/audit` memuat aksi `access.update` |
| `PUT /api/users/$USER_ID` ubah `roleId`/`floors` | `GET /api/audit` memuat `user.update` dengan nilai lama/baru |
| Reset sandi user lain oleh admin | entri `user.password.reset` |

`PUT /api/access/matrix` menerima kiriman sebagian (hanya sel yang diubah),
tetapi CMS selalu mengirim seluruh matriks. Kembalikan matrix ke nilai semula
setelah uji (`calendar` untuk `user` tercentang) agar akun demo tetap bisa
dipakai.

## 7. Kiosk: pairing

```bash
KIOSK_JSON=$(curl -s -X POST "$API/kiosk/auth" \
  -H 'Content-Type: application/json' \
  -d '{"email":"room-one@room.com","password":"RoomTablet123!","deviceName":"Tablet docs"}')
echo "$KIOSK_JSON" | python3 -m json.tool
KIOSK_TOKEN=$(echo "$KIOSK_JSON" | token)
REFRESH=$(echo "$KIOSK_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["refreshToken"])')
DEVICE_ID=$(echo "$KIOSK_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["device"]["id"])')
```

Harapan: `200 {token, refreshToken, room, device}`; `device.online` mungkin
`false` sampai request berikutnya.

| Kasus | Perintah | Harapan |
|---|---|---|
| Pairing kedua | jalankan pairing lagi | `409 ROOM_ALREADY_PAIRED` |
| Refresh | `POST /kiosk/refresh {"refreshToken":"$REFRESH"}` | `200`, token & refresh baru |
| Refresh salah | `POST /kiosk/refresh {"refreshToken":"salah"}` | `401 INVALID_KIOSK_REFRESH` |
| Token kiosk ke CMS | `GET /api/users` dengan `$KIOSK_TOKEN` | `401` (audience salah) |

Bila `409`, cabut perangkat lama dulu:

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/kiosk/devices?roomId=$ROOM_ONE"
curl -s -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$API/kiosk/devices/<device-id>"
```

## 8. Kiosk: konteks dan jadwal

```bash
TODAY=$(TZ=Asia/Jakarta date +%Y%m%d)
curl -s -H "Authorization: Bearer $KIOSK_TOKEN" "$API/kiosk/context" | python3 -m json.tool
curl -s -H "Authorization: Bearer $KIOSK_TOKEN" "$API/kiosk/schedule?start=$TODAY&end=$TODAY" | python3 -m json.tool
```

Harapan `context`: `room`, `device`, `timezone`, `serverTime` (ISO), `settings`.
Harapan `schedule`: setiap item punya `title` format `[NamaDepan, HH:mm - HH:mm]`,
`checkedIn`, `canCheckIn`, `canFinish`.

## 9. Privasi proyeksi

### 9.1 Kiosk menyembunyikan subjek

Buat satu meeting hari ini yang diselenggarakan admin, agar ada subjek yang
bisa disembunyikan:

```bash
P_START=$(date -u -d '+60 minutes' +%Y-%m-%dT%H:%M:%S.000Z)
P_END=$(date -u -d '+90 minutes' +%Y-%m-%dT%H:%M:%S.000Z)

PRIV_EVENT=$(curl -s -X POST "$API/events" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "[{\"organizer\":\"admin@example.test\",\"subject\":\"Rapat privat admin\",\"description\":\"rahasia\",
       \"start_date\":\"$P_START\",\"end_date\":\"$P_END\",\"timezone\":\"Asia/Jakarta\",
       \"attendee_email\":\"room-one@room.com\"}]" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')

# Matikan tampilan subjek untuk perangkat ini
curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"showSubject":false}' \
  "$API/kiosk/devices/$DEVICE_ID/capabilities"

curl -s -H "Authorization: Bearer $KIOSK_TOKEN" \
  "$API/kiosk/schedule?start=$TODAY&end=$TODAY" | python3 -m json.tool
```

Harapan: `subject` dan `organizerName` bernilai `null`, `title` tetap
`[NamaDepan, ...]`. Nyalakan kembali dengan `{"showSubject":true}`; `subject`
muncul, `title` tidak berubah.

### 9.2 Kalender CMS untuk bukan peserta

```bash
curl -s -H "Authorization: Bearer $VIEWER_TOKEN" \
  "$API/events?start=20310602&end=20310602&rooms=room-one@room.com" | python3 -m json.tool
```

Harapan untuk meeting milik user/admin: `visibility:"busy"`,
`can_view_details:false`, judul `[NamaDepan, HH:mm - HH:mm]`, tanpa
`subject`/`description`/`organizer`.

## 10. Kiosk: check-in

Buat meeting yang sedang berjalan (mulai 1 menit lalu) agar bisa langsung
di-check-in dan diakhiri:

```bash
START=$(date -u -d '-1 minute' +%Y-%m-%dT%H:%M:%S.000Z)
END=$(date -u -d '+29 minutes' +%Y-%m-%dT%H:%M:%S.000Z)

CHECKIN_EVENT=$(curl -s -X POST "$API/events" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "[{\"organizer\":\"user@example.test\",\"subject\":\"Check-in kiosk\",\"description\":\"-\",
       \"start_date\":\"$START\",\"end_date\":\"$END\",\"timezone\":\"Asia/Jakarta\",
       \"attendee_email\":\"room-one@room.com\"}]" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')

curl -s -X PUT "$API/kiosk/events/check-in" \
  -H "Authorization: Bearer $KIOSK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"event_id\":\"$CHECKIN_EVENT\",\"card_number\":\"$CARD\"}" | python3 -m json.tool
```

| Kasus | Harapan |
|---|---|
| Kartu peserta/organizer | `200`, `checked_in` terisi |
| Ulangi | `409 ALREADY_CHECKED_IN` |
| Kartu tidak dikenal | `403` (card not authorized) atau `400 INVALID_CARD` untuk door-open |
| Meeting bukan ruangan ini | `404` |

## 11. Kiosk: perpanjang dan selesai

```bash
# Perpanjang 15 menit (meeting harus checked-in dan sedang berjalan)
curl -s -X POST "$API/kiosk/events/extend" \
  -H "Authorization: Bearer $KIOSK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"event_id\":\"$CHECKIN_EVENT\",\"minutes\":15}" | python3 -m json.tool

# Selesai lebih awal (tombol Selesai tablet, tanpa kartu)
curl -s -X POST "$API/kiosk/events/complete" \
  -H "Authorization: Bearer $KIOSK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"event_id\":\"$CHECKIN_EVENT\"}" | python3 -m json.tool
```

Harapan `extend`: `200 {extendedMinutes:15,end:...}`; bila slot berikutnya
terpakai → `409 ROOM_CONFLICT`.
Harapan `complete`: `200 {id,finishedAt}`; ulangi → `409 EARLY_FINISH_WINDOW`.
Endpoint alternatif `PUT /kiosk/events/early-finish` membutuhkan
`card_number`.

Meeting check-in sudah selesai, jadi ruangan bebas untuk dua skenario
berikut.

## 12. Kiosk: instant booking

```bash
INSTANT_JSON=$(curl -s -X POST "$API/kiosk/events/instant" \
  -H "Authorization: Bearer $KIOSK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"card_number\":\"$CARD\",\"minutes\":30}")
echo "$INSTANT_JSON" | python3 -m json.tool
INSTANT_ID=$(echo "$INSTANT_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
```

Harapan: `200 {id,start,end,checkedIn:true,untilNext}`; subjek
`Room usage - Test User`. Ulangi saat masih berjalan → `409 ROOM_CONFLICT`.
`until_next:true` memotong di meeting berikutnya.

Selesai lebih awal bila ingin membebaskan ruangan sebelum skenario 13:

```bash
curl -s -X POST "$API/kiosk/events/complete" \
  -H "Authorization: Bearer $KIOSK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"event_id\":\"$INSTANT_ID\"}"
```

| Kasus | Body | Harapan |
|---|---|---|
| Kartu kosong | `{"minutes":30}` | `400 INVALID_CARD` |
| Kartu lantai 2 di room-one | kartu `floor.two@example.test` | `403 FLOOR_RESTRICTED` |
| Menjelang tengah malam | `minutes:240` | durasi dipotong sampai 23:59:59 lokal; bila <1 menit → `409 NO_FREE_WINDOW` |

Untuk kasus lantai, buat dulu karyawan lantai 2 lewat admin:

```bash
curl -s -X POST "$API/users" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Floor Two\",\"email\":\"floor.two@example.test\",
       \"password\":\"Password123!\",\"roleId\":\"$ROLE_USER\",
       \"floor\":\"2\",\"card_number\":\"<kartu-uji-2>\"}"
```

Lalu panggil `instant` dengan kartu tersebut di `room-one` (lantai 1) →
`403 FLOOR_RESTRICTED`.

## 13. Kiosk: booking terjadwal hari ini

```bash
B_START=$(date -u -d '+35 minutes' +%Y-%m-%dT%H:%M:%S.000Z)
B_END=$(date -u -d '+55 minutes' +%Y-%m-%dT%H:%M:%S.000Z)

curl -s -X POST "$API/kiosk/events/book" \
  -H "Authorization: Bearer $KIOSK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"card_number\":\"$CARD\",\"start\":\"$B_START\",\"end\":\"$B_END\"}" \
  | python3 -m json.tool
```

Harapan: `200 {id,start,end,checkedIn:false,scheduled:true}`. Bila mulai ≤2
menit dari sekarang, `checkedIn:true` dan `scheduled:false`. Slot +35 menit
dipilih agar tidak bentrok dengan instant booking yang baru diakhiri dan
meeting privasi pada +60 menit.

| Kasus | Body | Harapan |
|---|---|---|
| Mulai lewat | `start` 10 menit lalu | `400 INVALID_TIME` |
| Beda hari | `end` besok | `400 INVALID_TIME` |
| 4 menit | durasi 4 menit | `400 INVALID_TIME` |
| 4 jam 1 menit | durasi 241 menit | `400 INVALID_TIME` |
| Bentrok | slot yang sama dua kali | `409 ROOM_CONFLICT` |

## 14. Kiosk: buka pintu

```bash
curl -s -X POST "$API/kiosk/door-open" \
  -H "Authorization: Bearer $KIOSK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"card_number\":\"$CARD\"}"
```

Harapan `200 {message:"Door opened"}`. Kartu tidak terdaftar
`400 INVALID_CARD`. Di tablet, relay fisik yang menulis frame; server tidak
mengakses serial.

## 15. Laporan pemakaian dan XLSX

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/rooms/usage-report?start=2031-06-01&end=2031-06-30" | python3 -m json.tool
```

Harapan: array per ruangan (termasuk room-two walau kosong) dengan
`room_name`, `room_mail`, `total_pemakaian` (`HH:MM:SS`), `list_meeting[]`.
User biasa → `403`.

Ekspor XLSX (bukan endpoint):

1. Login CMS sebagai admin → menu **Laporan**.
2. Pilih rentang tanggal yang sama.
3. Klik **Unduh**; browser mengunduh
   `Laporan Riwayat Meeting (01-06-2031 - 30-06-2031).xlsx` (nama mengikuti
   bahasa UI).
4. Buka file; sheet berisi total per ruangan dan riwayat meeting.

## 16. Ganti sandi dan pencabutan sesi

```bash
curl -s -X PUT "$API/users/change-password" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"oldPassword":"ParityTest123!","newPassword":"SandiBaru123!","newPasswordConfirmation":"SandiBaru123!"}'
```

Harapan `200`. Sandi lama tidak berlaku lagi; JWT lama tetap valid sampai
kedaluwarsa (tidak ada revoke token CMS). Ganti sandi akun **ruangan**
sebagai admin akan mencabut semua perangkat kiosk ruangan itu.

## 17. Bersih-bersih

```bash
# Batalkan meeting tunggal
curl -s -X PUT "$API/events/delete?event_id=$EVENT_ID&scope=occurrence" \
  -H "Authorization: Bearer $USER_TOKEN"

# Batalkan seluruh seri (pakai id salah satu occurrence)
curl -s -X PUT "$API/events/delete?event_id=<occurrence-id>&scope=series" \
  -H "Authorization: Bearer $USER_TOKEN"

# Batalkan meeting privasi milik admin
curl -s -X PUT "$API/events/delete?event_id=$PRIV_EVENT&scope=occurrence" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Cabut perangkat kiosk
curl -s -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$API/kiosk/devices/$DEVICE_ID"
```

Alternatif paling bersih: `npm run demo` (reset DB) lalu pairing ulang.

## 18. Belum dapat diverifikasi

- Skenario matrix di §6.2 memerlukan akun Super Admin. Database demo tidak
  punya satu pun (admin demo berperan ADMIN), jadi promosi SQL di awal §6.2
  wajib; `/setup` pada instalasi baru menghasilkan Super Admin otomatis.
- Perintah `date -d` mengasumsikan GNU date (Linux/WSL), bukan macOS.
- Skenario relay/NFC/LED memerlukan tablet dan kartu fisik; katalog ini hanya
  membuktikan sisi server.
- Ekspor XLSX belum diuji ulang pada sesi ini; kontrak nama file diverifikasi
  lewat unit test client (`client/tests/dates.test.js`,
  `client/tests/report-contract.test.js`).
