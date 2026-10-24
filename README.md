# 360 Scheduler

Meeting & Room Scheduler dengan pembaruan real-time untuk CMS (web admin)
dan kiosk tablet (aplikasi khusus, repo [`kioskapp`](../kioskapp)) menggunakan
React, Node.js, PostgreSQL, dan Socket.io.

Antarmuka memakai English sebagai bahasa sumber/default dan Bahasa Indonesia
sebagai bahasa kedua. Katalog JSON dan alur Crowdin ada di
[`docs/localization.md`](docs/localization.md). Peta halaman CMS ada di
[`docs/CMS.md`](docs/CMS.md). Status pengerjaan keseluruhan ada di
[`TODO.md`](TODO.md).

## 🚀 Tech Stack

### Frontend (CMS)

- **React 17** - Library UI
- **Vite 8** - Build tool dan dev server
- **Material-UI 5** - Component library (termasuk `@mui/x-date-pickers`)
- **Redux Toolkit** - State management
- **React Router 5** - Client-side routing
- **Socket.io Client 4** - Real-time communication
- **FullCalendar** - Calendar component
- **dayjs** - Manipulasi tanggal/waktu

### Backend

- **Node.js** (v20.19+ / v22.12+) - Runtime environment
- **Express 4** - Web framework
- **Socket.io 4** - Real-time WebSocket server
- **PostgreSQL 14** - Database
- **JWT** - Authentication
- **Webpack 5** - Server bundling untuk production
- **node:test** - Unit, paritas, dan regression tests

## 📋 Prerequisites

- **Node.js** v20.19+ atau v22.12+
- **Docker** (untuk demo database PostgreSQL; tidak perlu install PostgreSQL di host)
- **npm**

## 🛠️ Installation

1. **Clone repository**

   ```bash
   git clone https://github.com/goodmeow/app_booking.git
   cd app_booking
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Pilih environment**

   - `.env.demo` dilacak Git dan hanya berisi konfigurasi publik untuk database disposable.
   - `.env.example` adalah template (termasuk HTTPS/`TLS_CERT_PATH`/`TLS_KEY_PATH` dan
     `TRUST_PROXY`). Salin menjadi `.env.production` atau `.env`, lalu isi secret.
   - `.env` tetap di-ignore untuk development kustom; demo standar tidak memerlukannya.

   Jangan arahkan `.env.demo` ke database production, staging, atau shared.

## 🔧 Development

### Demo deterministic

```bash
npm run demo
```

Perintah ini menjalankan container PostgreSQL compose (`127.0.0.1:54320`,
project `360booking`, container `360booking-postgres-test`), mereset database
`360booking_reconstruction_test`, menerapkan migration + seed sanitized, lalu
menyalakan:

- **CMS/Vite dev**: http://localhost:8081
- **API/Socket.io**: http://localhost:9091

Status `Demo ready` baru tampil setelah login database dan proxy client
terverifikasi. Container database sengaja dipakai ulang agar restart cepat;
`Ctrl+C` menghentikan aplikasi (database tetap hidup), `npm run demo:stop`
menghentikan container.

Credential demo:

| Akun | Email | Sandi | Keterangan |
|---|---|---|---|
| Admin | `admin@example.test` | `ParityTest123!` | akses penuh CMS |
| Ruangan (kiosk) | `room-one@room.com` | `RoomTablet123!` | untuk pairing tablet |
| Karyawan uji | `karyawan@uji.prasada.test` | `1234` | kartu uji NFC dummy |
| Karyawan uji 2 | `emp@uji.local` | `1234` | kartu `DEMO-UJI-CARD` |

### Restore akun demo setelah regression suite

Regression suite (`test:server:regression`) me-reset database dengan
`dropdb --force`, dan `npm run demo` juga membangun ulang database setiap
kali dijalankan. Karena itu urutan yang benar:

1. `npm run demo` - bangun ulang database + nyalakan server.
2. `npm run demo:accounts` - kembalikan akun demo (termasuk `role_id`,
   syarat login server).
3. Pasangkan ulang tablet bila sesi kiosk hilang (`pm clear` + provisioning).

Langkah `demo:accounts` diletakkan setelah demo karena seed build tidak
memasukkan akun uji; menjalankannya sebelum demo akan terhapus lagi oleh
rebuild.

### Custom development

```bash
cp .env.example .env
# Isi koneksi PostgreSQL lokal yang aman.
npm run development
```

Serves terpisah juga tersedia: `npm run dev:client` dan `npm run dev:server`.

### Tablet kiosk: satu segment LAN (tanpa USB reverse)

Tablet dan laptop dijadikan satu subnet (contoh `192.168.1.0/24`):

| Sisi | Konfigurasi |
|---|---|
| Tablet (`eth0`) | statis `<ip-tablet>/24` via Settings → Ethernet (persisten) |
| Windows host | statis `<ip-server>/24` via `netsh` |
| Portproxy | `<ip-server>:5100 → 127.0.0.1:5100` (`netsh interface portproxy`) |
| Forwarder | `python3 ~/bin/forward9091.py` (WSL) meneruskan `0.0.0.0:5100 → 127.0.0.1:9091` |
| Firewall | rule inbound TCP 5100 (`360booking-kiosk-5100`) |
| APK | URL server diketik saat provisioning; HTTP polos diizinkan lewat `network_security_config.xml` |

Origin LAN untuk CMS (mis. `http://<ip-server>:8081`) jangan di-commit: salin
ke `.env.local` (di-ignore) yang ditimpa di atas `.env.demo` saat `npm run demo`.

Verifikasi tablet benar-benar lewat LAN (bukan USB/adb reverse):

```bash
# 1. Koneksi TCP TCP masuk ke portproxy di laptop (harus dari IP tablet)
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 5100 -State Established |
  Group-Object RemoteAddress | Select-Object Count,Name"

# 2. Log server tetap menerima polling tablet (tiap ~20 detik) walau adb mati
python3 - <<'PY'
import json
for line in open("/tmp/opencode/demo.log"):
    try: event = json.loads(line)
    except: continue
    if event.get("event") == "http_request" and event.get("path") in ("/context", "/schedule"):
        print(event["timestamp"][11:19], event["path"], event["status"])
PY
```

Bila baris pertama menampilkan IP tablet dan baris kedua terus bertambah,
koneksi tablet ↔ server murni LAN; `adb` hanya diperlukan untuk instalasi APK
dan pengambilan screenshot.

Tablet tahan putus sambung: saat kabel LAN dicabut layar menampilkan state
`OFFLINE` (bukan "tersedia"), dan begitu kabel kembali tablet pulih otomatis
ke Online tanpa perlu dibuka ulang — log akan menunjukkan celah polling lalu
lanjut `/context 200`.

Jalur USB `adb reverse` tidak lagi dibutuhkan untuk kerja tablet, Yang perlu
diproses ulang hanya bila laptop restart: jalankan forwarder lagi
(`python3 ~/bin/forward9091.py`). Detail perubahan tablet ada di repo
`kioskapp` dan `TODO.md` (item LAN).

Riwayat perubahan kiosk terpih di repo terpisah `kioskapp` (React Native):

```bash
cd ../kioskapp && npm install
```

## 🏗️ Build untuk Production

```bash
npm run build
```

Output **`build/`** (bukan `dist/`):

```
build/
├── client/          # Hasil vite build (statis)
└── server/          # Hasil webpack bundle + package.json
```

Bagian-bagian individu: `npm run build:client`, `npm run build:server`,
`npm run create:server:package`.

## 🚀 Production Deployment

1. Buat `.env.production` dari `.env.example` (secret, koneksi DB).
2. `npm run build` lalu deploy folder `build/` bersama `node_modules`.
3. Jalankan:

   ```bash
   npm run start:client   # serves build/client di PORT (default 8081)
   npm run start:server   # API/Socket.io di SERVER_PORT (default 9091)
   ```

Kedua script membaca `.env` pada root proyek.

### HTTPS

Server mendukung TLS langsung tanpa reverse proxy:

```bash
HTTPS=true TLS_CERT_PATH=/path/server.crt TLS_KEY_PATH=/path/server.key \
  npm run start:server
```

- Sertifikat dari CA publik dipercaya oleh tablet tanpa perubahan apa pun.
- Sertifikat self-signed/CA internal: install CA pada tablet lewat Settings
  (anchor `user` di `network_security_config.xml` menampungnya).

### Di balik reverse proxy (nginx/Caddy)

Bila TLS ditangani reverse proxy, set `TRUST_PROXY=true` (atau jumlah hop
untuk `req.app.get("trust proxy")`) supaya parsing `X-Forwarded-For` benar.
Semua port diatur lewat env (`PORT`, `SERVER_PORT`, `HOST`).

## 📁 Project Structure

```
app_booking/
├── client/                   # Frontend CMS (Vite)
│   ├── auth/                 # Halaman masuk
│   ├── core/                 # Layout, dashboard, navigasi
│   ├── calendar/             # Kalender + EventEditor
│   ├── domain/               # Kontrak data & helper (event-contract, dll.)
│   ├── locales/              # en/id JSON + workflow Crowdin
│   ├── redux/                # Store, api layer, services, middleware
│   ├── user/                 # Pengelolaan users/cards/rooms (CMS)
│   ├── reports/              # Laporan pemakaian ruangan + XLSX
│   └── tests/                # node:test client
├── server/                   # Backend (Express)
│   ├── features/             # events/, kiosk/, rooms/, users/, auth/, ...
│   ├── routes/               # index.js pemasangan rute fitur
│   ├── runtime/              # create-http-server (http/https), dll.
│   ├── socket/               # Socket.io handlers
│   ├── db/                   # Pool & SQL helpers
│   ├── observability/        # Logger terstruktur
│   └── tests/                # unit/, parity/, regression/
├── config/config.js          # Baca env + validasi runtime
├── scripts/                  # demo.js, demo-accounts.js, dev-*, start-*, dll.
├── database/migrations/      # Migrasi SQL berurutan (incl. kiosk)
├── compose.yaml              # PostgreSQL util demo
├── build/                    # Hasil build (generated)
├── docs/                     # CMS.md, localization.md, reconstruction/
└── TODO.md                   # Peta pengerjaan & sisa item
```

## 🔌 API Endpoints (ringkas)

Semua berada di bawah `/api`, autentikasi JWT bearer. Referensi lengkap ada
di modul `server/features/*/routes.js`.

### Health

- `GET /api/health` - Probe hidup tanpa kredensial (untuk systemd/nginx)

### Auth

- `POST /api/auth/signin` - Login (akun dibuat lewat CMS, bukan signup)
- `POST /api/auth/refresh` - Memperbarui token
- `PUT /api/users/change-password` - Ganti sandi mandiri

### Users & Rooms (admin)

- `GET /api/users`, `GET|PUT|DELETE /api/users/:userId`
- `GET /api/rooms`, `GET /api/rooms/:roomId`, `POST|PUT|DELETE`
- `GET /api/rooms/available`, `GET /api/rooms/status`, `GET /api/rooms/usage-report`

### Events

- `GET|POST /api/events`, `GET|PUT|DELETE /api/events/:eventId`
- `POST /api/events/preview`, `POST /api/events/attendee`
- `PUT /api/events/check-in`, `PUT /api/events/early-finish`, `PUT /api/events/delete` (batal)

### Kiosk (token kiosk khusus)

- `POST /api/kiosk/auth`, `POST /api/kiosk/refresh` - Login kartu ruangan
- `GET /api/kiosk/context`, `GET /api/kiosk/schedule` - Data tablet (incl. `serverTime`)
- `PUT /api/kiosk/events/check-in`, `POST /api/kiosk/events/extend|complete|instant|early-finish|book`
  (`book` = pilih jam mulai & selesai hari ini dari tablet)
- `POST /api/kiosk/door-open` - Pemicu relay di tablet
- `GET /api/kiosk/devices` (admin), `DELETE /api/kiosk/devices/:deviceId` (revulkanisasi)

## 🔄 Real-time Features

Socket.io dipakai untuk invalidation scoping, bukan broadcast payload besar:

- Channel per user dan per ruangan; event dibuat/diubah/dibatal langsung
  merangkai kalender CMS dan kiosk milik pihak yang terdampak.
- Payload Socket.io mematuhi proyeksi privasi yang sama seperti HTTP (tidak
  membocorkan subjek/aturan meeting orang lain).

## 🧪 Testing

```bash
npm run test:client              # Test helper & kontrak client
npm run test:server:unit         # Test unit server
npm run test:server:parity:prepare  # persiapan database paritas
npm run test:server:parity       # Pembandingan bundle lama vs rekonstruksi
npm run test:server:regression   # Routen geseran: reset DB + uji akhir-ke-akhir
```

Catatan:

- Suite paritas/regression menaklukkan DB via Docker demo (port 54320).
- Setelah regression, jalankan `npm run demo:accounts` untuk memulihkan akun
  demo (role_id terjamin), lalu pasangkan ulang tablet bila sesi kiosk ikut
  hilang.
- Regresi terakhir yang terekam (2026-10-23): unit 42/42, regression 52/52,
  client 62/62.

### Lint & format

```bash
npm run lint          # ESLint 9 flat config (client, server, scripts, config)
npm run format:check  # Prettier --check sesuai .prettierrc
```

Belum jadi gate: `npm run verify` dan CI sengaja **tidak** menjalankan lint
sampai baseline bersih. Angka baseline tercatat di laporan code review;
pembersihannya dilakukan bertahap per folder dengan `npm run lint -- <folder>`
dan `npx prettier --write <folder>`, bukan sekali tulis massal untuk seluruh
repo (supaya diff review tetap kecil dan `git blame` tidak hilang).

Aturan yang aktif hanya yang disepakati: `no-unused-vars` (warning),
`react/jsx-uses-vars`, `react-hooks/rules-of-hooks`, plus rekomendasi inti
`@eslint/js`. `no-undef` dimatikan karena global tiap folder berbeda.

## 🐛 Troubleshooting

### Port dipakai

`PORT=8081 SERVER_PORT=9091` diatur env — ubah satu-duanya lewat `.env`
atau override sebelum menjalankan script.

### Database connection error

- Demo: pastikan container `360booking-postgres-test` hidup
  (`docker ps`, lalu `npm run demo` untuk menghidupkannya lagi).
- Host DB non-default: isi `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.

### Setelah restart mesin (Windows/WSL)

Urutan pemulihan yang terbukti:

1. `npm run demo:resume` — menyalakan container PostgreSQL yang sudah ada lalu
   CMS + API **tanpa reset database**, sehingga pairing tablet tidak hilang.
2. Jalankan forwarder LAN: `python3 ~/bin/forward9091.py` (port 5100).
3. Bila CMS tidak bisa diakses dari perangkat LAN setelah reboot:
   - pastikan portproxy ter-*bind*: `netsh interface portproxy show all` lalu
     delete+add ulang entri 5100/port CMS (butuh admin),
   - pastikan profil jaringan Ethernet bukan **Public**:
     `Set-NetConnectionProfile -InterfaceAlias Ethernet -NetworkCategory Private`
     atau tambahkan rule inbound TCP untuk subnet LAN.
4. Bila port 8081 dipakai proses lain (mis. layanan indeks kode), set
   `PORT=8082` di `.env.local`, tambahkan portproxy 8082, dan buka
   `http://<ip-server>:8082`. `.env.local` tidak ikut ter-commit.

### Tablet gagal `Network request failed`

Alamat LAN server yang baru diketik perlu diizinkan HTTP polos: konfigurasi
app memakai `network_security_config.xml` dengan `cleartextTrafficPermitted`
(global). Bila pakai HTTPS, pastikan sertifikat valid atau install CA di
Settings tablet.

### Akses 403 `FLOOR_RESTRICTED`

Karyawan hanya dapat memesan ruangan pada grup lantai kerjanya
(`tbl_users.floor`). Admin bebas. Isi lantai karyawan dari tab Users.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**360 Scheduler** — rekonstruksi hardened dari 360 Booking (nauchara).
Model perilaku tersimpan sebagai artefak referensi; detail status ada di
`TODO.md` dan `docs/reconstruction/`.
