# Audit kesiapan hardware (NFC, akses pintu, LED)

Tanggal: **2026-10-21**. Lingkup: repo `app_booking` (reimplementasi), bukan
server produksi. Tujuan audit: memetakan bagian yang harus berubah sebelum
kiosk web di repo ini bisa mengendalikan NFC, relay pintu, dan LED tablet
RK3288 seperti 360Booking asli.

Bukti perilaku asli: `nauchara/hardware/KIOSK-APK-ANALYSIS.md` (APK),
`LED-CODES.md`, `DOOR-RELAY.md`, `LIVE-UI-TEST.md`, dan
`nauchara/CORE-SERVICE.md §11`.

## 1. Ringkasan

Software kiosk di repo ini **sudah matang di sisi sesi, otorisasi, dan
realtime**, tetapi **belum memiliki satu pun jalur ke hardware**:

| Lapisan | Status |
|---|---|
| Identitas kiosk (provisioning, token 15 mnt, refresh rotasi, revoke) | siap, lebih kuat dari asli |
| Sinkronisasi jadwal + socket | siap |
| Tampilan state | ada, tetapi **semantiknya berbeda** dari perangkat |
| Check-in | endpoint ada, **tidak dipakai UI** |
| Buka pintu | **tidak ada endpoint untuk kiosk** |
| NFC / relay / LED | **tidak ada layer native** |

Perkiraan: **±40%** jalur menuju fitur hardware sudah ada (auth, room
binding, schedule, kapabilitas per device); **±60%** masih harus dibangun.

## 2. Peta komponen saat ini

| Komponen | Berkas | Catatan |
|---|---|---|
| UI kiosk | `client/kiosk/KioskApp.js` | state, jam, daftar meeting, socket, ganti ruangan |
| State | `client/kiosk/kiosk-state.js` | `available / upcoming / occupied / unknown` |
| API kiosk | `client/kiosk/kiosk-api.js` | auth, refresh, context, schedule, check-in, early-finish |
| Sesi | `client/kiosk/kiosk-session.js` | `localStorage["kiosk_jwt"]` |
| Server kiosk | `server/features/kiosk/*` | binding room/device, rotasi token, kapabilitas |
| Auth pintu | `server/features/auth/auth.routes.js:12` | `POST /api/door-open` hanya `requireSignin` (JWT user) |
| DB perangkat | `database/migrations/007,008` | `tbl_kiosk_devices`, `nfc_enabled`, `led_enabled` (default **false**) |
| Socket | `server/socket/webSocket.js` | menerima token kiosk, join `room:` + `device:` |
| Admin | `client/management/KioskDeviceManagementSection.js` | toggle NFC/LED per device |

## 3. Gap matrix

Prioritas: **P0** = wajib sebelum bridge, **P1** = wajib sebelum uji
perangkat, **P2** = penyempurnaan.

| # | Area | Kondisi sekarang | Yang diperlukan | P | Usaha |
|---|---|---|---|---|---|
| G1 | State kiosk | `occupied` selalu merah; `upcoming` jika mulai ≤60 mnt; palet oranye | Kuning (`#cccc00`) untuk meeting **aktif tapi belum check-in**, merah hanya jika `checkedIn`; jendela warna 15 mnt dari `start`; hijau untuk sisanya | P0 | S |
| G2 | Check-in | `checkInKioskMeeting()` ada tapi **tidak dipanggil** UI | Tombol/otomatis saat kartu ditempel; pilih event aktif; tampilkan hasil & error | P0 | M |
| G3 | Format kartu | Server membandingkan `lower(card_number)` string | Normalisasi angka desimal hasil `parseInt` UID 4 byte dibalik; uji kartu master + kartu karyawan | P0 | S |
| G4 | Buka pintu | `POST /api/door-open` butuh JWT user; kiosk token ditolak | Endpoint kiosk ber-token kiosk, terikat `room_id`, rate-limit, kembalikan keputusan saja (relay ditulis tablet) | P0 | M |
| G5 | Pemetaan LED | Hanya chip label; tidak ada kode | `available→0x05`, `upcoming/aktif belum check-in→0x14`, `occupied/check-in→0x04`, awal `0x03`; hanya jika `ledEnabled` | P1 | S |
| G6 | Bridge native | Tidak ada | WebView wrapper + modul NFC, serial CH340, root sysfs; protokol terbatas (bukan shell bebas) | P1 | L |
| G7 | Relay | Tidak ada konsep | Tablet menulis `A00101A2` lalu `A00100A1` setelah 15 s **setelah** server 200 | P1 | M |
| G8 | Konfigurasi perangkat | `localStorage`, URL relatif | Simpan `@ipServer`, room, token di native/AsyncStorage; layar first-run seperti dialog “Change Room or Server” | P1 | M |
| G9 | Kompatibilitas WebView | Build Vite 8 tanpa target legacy | Pastikan WebView Android 8.1 mampu, atau tambahkan `@vitejs/plugin-legacy` / pertimbangkan RN | P1 | M |
| G10 | Offline | `unknown` + chip offline (lebih baik dari asli) | LED fail-safe (mis. `0x02`/`0x05`) + larangan check-in saat `unknown` | P1 | S |
| G11 | Kapabilitas default | `nfc_enabled`/`led_enabled` **false** | Default menyesuaikan jenis perangkat, atau langkah aktivasi saat provisioning | P1 | S |
| G12 | Observability | Tidak ada log hardware | Log frame terkirim, kode LED, hasil NFC (lokal, tanpa UID mentah) | P2 | S |
| G13 | Keamanan bridge | Belum ada | Allowlist origin, whitelist kode LED, tanpa `runCommand`, validasi pesan | P1 | S |
| G14 | Autostart/kiosk lock | Tidak ada (sama seperti asli) | Kebijakan perangkat: launcher kiosk / `startLockTask` | P2 | M |
| G15 | Uji perangkat | Belum ada | Matriks state, check-in, door, LED di RK3288 | P1 | M |

## 4. Perbedaan semantik yang harus diputuskan

### 4.1 Kapan kuning?

Asli: event aktif (`start ≤ now < end`) **dan** `checked_in` kosong → kuning;
sudah check-in → merah. Repo ini: semua event aktif → merah.

Rekomendasi: ikuti asli, karena LED dan layar harus berbicara hal yang sama.

### 4.2 Jendela “akan mulai”

Asli: warna/state dihitung dari `start + 15 menit`; layar menampilkan `end`.
Repo ini: `upcoming` bila ≤60 menit dan berwarna oranye.

Rekomendasi: parameterkan (`time_of_event_start_soon`) dan samakan dengan
device; jangan hardcode 60.

### 4.3 Siapa yang membuka pintu?

Asli: server hanya memvalidasi kartu, **tablet** menulis frame relay.
Rekomendasi sama, agar server tidak pernah memegang kendali fisik dan tetap
bisa dipakai tanpa serial.

### 4.4 Validasi kartu

Asli (door): hanya `tbl_card_masters`.
Repo ini (`/door-open`): hanya master card. Untuk check-in kiosk: master **atau**
kartu karyawan yang terkait organizer/attendee.

Perlu keputusan: apakah kartu karyawan boleh membuka pintu, atau hanya
check-in? Jangan diam-diam memperluas akses.

## 5. Protokol bridge yang diusulkan

Wrapper WebView memuat `https://<server>/kiosk`, lalu:

**JS → native** (satu entry point, tanpa shell):

| Pesan | Efek |
|---|---|
| `{type:"led", code:5}` | tulis `w 0x05` ke sysfs |
| `{type:"relay", action:"open", seconds:15}` | `A00101A2`, timer, `A00100A1` |
| `{type:"nfc", action:"start"}` / `stop` | mulai/hentikan pembacaan |
| `{type:"ready"}` | minta status hardware |

**Native → JS**:

| Event | Payload |
|---|---|
| `hardware:ready` | `{nfc:true, relay:true, led:true}` |
| `hardware:card` | `{card_number:<int>}` — sudah dikonversi, bukan UID mentah |
| `hardware:error` | `{component, code}` |

Aturan: hanya origin kiosk yang boleh inject; `code` LED divalidasi 0–23;
tidak ada eksekusi perintah arbitrer; UID mentah tidak pernah dikirim ke web.

## 6. Urutan kerja yang disarankan

| Fase | Isi | Keluaran |
|---|---|---|
| **A. Paritas state + check-in** (G1–G3) | kuning/merah sesuai `checkedIn`, jendela 15 mnt, tombol/trigger check-in, normalisasi kartu, test | kiosk web bisa check-in manual |
| **B. Jalur akses** (G4) | endpoint kiosk door-open + rate-limit + test otorisasi | keputusan buka/tolak tanpa hardware |
| **C. Bridge APK** (G6–G8, G13) | wrapper WebView + 3 modul native + protokol | APK bisa NFC/relay/LED |
| **D. Uji perangkat** (G15) | matriks state, check-in, door, LED, offline | bukti di RK3288 |
| **E. Pengerasan** (G10–G12, G14) | fail-safe, logging, kiosk lock | siap operasional |

Perkiraan kasar: A–B 2–3 hari, C 3–5 hari, D 1–2 hari, E 1–2 hari.

## 7. Risiko utama

1. **WebView Android 8.1.** Build Vite 8 menargetkan browser modern; WebView
   stok bisa jauh lebih tua. Cek versi WebView di tablet lebih dulu. Jika
   rendah, tambah build legacy atau pilih React Native.
2. **Root untuk LED.** Tablet harus root; kebijakan update/keamanan perlu
   disepakati.
3. **Izin USB CH340.** Setelah reboot, izin serial bisa hilang; perlu
   `UsbManager` + dialog atau device filter.
4. **Kartu fisik.** UID 4 byte dibalik → integer; kartu yang formatnya tidak
   cocok akan gagal senyap (perilaku asli). Perlu uji dengan kartu nyata.
5. **Token di localStorage.** Wrapper harus menonaktifkan debugging WebView
   dan membatasi navigasi.

## 8. Yang tidak perlu diubah

- Model sesi kiosk (device-bound, refresh rotasi, revoke) — sudah lebih baik
  dari asli.
- Socket terautentikasi dan scoped `room:`/`device:`.
- Guard admin pada settings/card-master.
- Endpoint schedule dan bentuk datanya (`canCheckIn`, `checkedIn` sudah ada).

## 9. Keputusan yang menunggu pemilik produk

1. Kiosk web di WebView atau ditulis ulang React Native?
2. Kartu karyawan boleh membuka pintu, atau hanya check-in?
3. LED default aktif atau tetap opt-in per perangkat?
4. Perilaku saat offline: tampilkan `UNKNOWN` (sekarang) atau tetap state
   terakhir dengan peringatan?

## 10. Keputusan & progres (2026-10-21)

Keputusan pemilik produk:

1. **Runtime kiosk: React Native.** WebView tablet hanya Chrome 64
   (`64.0.3282.137`); build Vite 8 + MUI 5 tidak kompatibel. Web `/kiosk`
   dipertahankan sebagai referensi desktop.
2. **Kartu karyawan boleh membuka pintu**, bukan hanya check-in. Perubahan
   validasi ada di Fase B.
3. **LED aktif secara default** untuk perangkat kiosk.
4. **Offline ditampilkan sebagai `OFFLINE`**, bukan “Available”.

Sudah dikerjakan di Fase A:

- `deriveKioskState` memakai `checkedIn`: aktif belum check-in → kuning,
  sudah → merah, tidak ada meeting aktif → hijau.
- Mode `upcoming` (60 menit) dihapus; state hanya dari meeting aktif, sesuai
  perangkat.
- Palet disamakan dengan perangkat: `#44865a`, `#c70039`, `#8a6d00`
  (kuning dengan kontras teks), offline `#455a64`.
- `deriveKioskState(..., { fresh:false })` → `offline`; UI menampilkan layar
  OFFLINE dan tidak lagi menampilkan “Available” saat fetch gagal.
- Dialog check-in memakai `checkInKioskMeeting` (nomor kartu manual untuk
  sementara; pemicu NFC menyusul).
- Kode LED tersedia sebagai `kioskLedCodeFor()` (`5/20/4/2`) untuk bridge.
- Migrasi `010_kiosk_led_default.sql`: `led_enabled` default `true` dan
  backfill perangkat aktif.

Fase B (jalur akses):

- Endpoint baru `POST /api/kiosk/door-open` — wajib token kiosk, terikat
  device/room, rate-limit 60 per 15 menit. Server hanya memutuskan; relay
  tetap ditulis tablet.
- Validasi kartu sekarang menerima **kartu master atau kartu karyawan aktif**
  (`tbl_card_masters` atau `tbl_users.card_number`). Berlaku juga untuk
  `POST /api/door-open` versi web, sesuai keputusan produk.
- Catatan skema: repo ini **tidak memiliki `tbl_user_cards`** seperti server
  produksi; satu kartu per user disimpan di `tbl_users.card_number`.
- Helper klien `openKioskDoor()` tersedia untuk bridge.
- Test regresi: master 200, kartu karyawan 200, kartu tak dikenal 400,
  body kosong 400, token non-kiosk 401.

Fase B lanjutan (desain tablet ruang meeting):

- `POST /api/kiosk/events/extend` — perpanjang meeting aktif +15 menit; tolak
  dengan 409 `ROOM_CONFLICT` kalau bentrok jadwal berikutnya.
- `POST /api/kiosk/events/complete` — selesaikan meeting aktif dengan token
  kiosk (pasangan endpoint kartu `early-finish` tetap ada).
- `POST /api/kiosk/events/instant` — pesan ruangan sekarang atas nama karyawan
  pemilik kartu; opsi 30 menit atau sampai meeting berikutnya.
- Kapasitas ruangan memakai kolom `tbl_users.capacity` yang sudah ada.
- Uji regresi server 39/39 lolos; UI kioskapp mengikuti mockup di
  `kioskapp/docs/design/tablet-ruang-meeting.html`.

## Sisa pending (2026-10-21)

- Verifikasi relay fisik CH340 (modul belum tersedia).
- Uji tipe kartu NFC (UID 4 vs 7 byte).
- Reset kata sandi CMS (kini baru pesan info).
- Keputusan tampilkan tautan "Buat akun" di halaman masuk.
- Kapasitas ruangan dapat diisi dari layar manajemen CMS.
- Web kiosk `/kiosk` disamakan fontnya dengan tablet.
- Dedupe/limit perangkat kiosk per pairing.
- Ganti forwarder dev dengan bind IPv4/portproxy untuk uji panjang.
- Autostart boot + kiosk lock.
- Batasi `GET /api/users` untuk semua user login (keputusan produk).
