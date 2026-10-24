# Runbook Operasional

Panduan menjalankan, merawat, dan memulihkan 360 Scheduler. Sumber utama
deploy tetap [`../deploy/README.md`](../deploy/README.md); dokumen ini
melengkapi bagian operasional yang belum tercakup di sana.

Semua contoh memakai placeholder `<ip-server>` / `<domain>`; jangan menulis
IP atau kredensial nyata ke repo.

## 1. Topologi produksi

| Komponen | Dijalankan oleh | Alamat |
|---|---|---|
| CMS statik | nginx (`root /opt/360booking/client`) | `http://<host>/` atau `https://<domain>/` |
| API + Socket.io | systemd `360booking-server.service` | `127.0.0.1:9091` |
| PostgreSQL 14 | paket distro | `127.0.0.1:5432` |
| Tablet kiosk | APK, koneksi keluar | `https://<domain>/api/kiosk/...` |

Hanya port 22/80/443 yang perlu dibuka untuk CMS dan tablet. API tidak
diekspos langsung.

## 2. Deploy pertama

Ikuti urutan di `deploy/README.md`:

```bash
sudo ./deploy/01-install-prerequisites.sh
sudo cp deploy/app.env.example /etc/360booking/app.env
sudo nano /etc/360booking/app.env          # ganti semua change-me
sudo ./deploy/02-provision-database.sh     # role + DB + migrasi
./deploy/03-build.sh                       # npm ci && npm run build
sudo ./deploy/04-install-app.sh            # /opt/360booking + systemd + nginx
sudo ./deploy/05-create-admin.sh           # akun admin pertama
```

`03-build.sh` boleh dijalankan di mesin lain; `04` membutuhkan
`build/client`, `build/server/server.bundle.cjs`, `package.json`, dan
`package-lock.json` di root repo host target.

### 2.1 Jebakan: `tbl_role` kosong pada database baru

`02-provision-database.sh` hanya menjalankan migrasi. Migrasi **tidak**
mengisi `tbl_role`, sedangkan `05-create-admin.sh` memakai `role_id` admin
hardcoded dan `tbl_users.role_id` punya FK ke `tbl_role`. Pada database yang
benar-benar baru, langkah 05 dapat gagal karena role belum ada. Verifikasi:

```sql
SELECT count(*) FROM tbl_role;  -- harus 2 sebelum 05
```

Bila kosong, isi lebih dulu (id sama dengan seed demo):

```sql
INSERT INTO tbl_role (_id, role_name, is_deleted) VALUES
  ('471ba030-c950-41f9-90da-4e0fe10426a6', 'admin', false),
  ('67e9500b-908a-497d-9d3b-54bc020700cb', 'user',  false)
ON CONFLICT (_id) DO NOTHING;
```

Ini rekomendasi berdasarkan pembacaan skrip; belum dijalankan pada mesin
produksi.

### 2.2 Environment penting

| Variabel | Nilai produksi | Catatan |
|---|---|---|
| `NODE_ENV` | `production` | Memilih `.env.production` bila ada |
| `HOST` | `127.0.0.1` | API hanya loopback di belakang nginx |
| `PORT` / `SERVER_PORT` | `8081` / `9091` | `PORT` hanya dipakai mode SSR/client |
| `TRUST_PROXY` | `true` | Wajib di belakang nginx agar `req.ip` benar |
| `CORS_ORIGINS` | `https://<domain>` | Tanpa wildcard; origin lain → `403 CORS_ORIGIN` |
| `HTTPS` | `false` bila TLS di nginx | `true` hanya bila Node memegang TLS |
| `TLS_CERT_PATH` / `TLS_KEY_PATH` | – | Wajib bila `HTTPS=true` |
| `JWT_SECRET` | acak ≥32 karakter | Boot gagal bila placeholder/pendek |
| `APP_TIMEZONE` | `Asia/Jakarta` | Harus IANA valid |
| `FLOOR_RESTRICTION` | `true` (default) | Tidak ada di `deploy/app.env.example`; default tetap aktif |
| `PG*` | kredensial role aplikasi | Jangan pakai superuser untuk runtime |

### 2.3 HTTPS

Dua pilihan, jangan dicampur:

1. **TLS di nginx (disarankan)** — pasang sertifikat di blok `listen 443`
   (`deploy/nginx/360booking.conf` masih dikomentari), set
   `TRUST_PROXY=true` dan `CORS_ORIGINS=https://<domain>`.
2. **TLS di Node** — `HTTPS=true`, `TLS_CERT_PATH`, `TLS_KEY_PATH`, buka
   port 9091 di firewall, dan tablet diarahkan langsung ke port itu.

Sertifikat self-signed/CA internal: CA harus dipasang di tablet (anchor
`user`) sebelum pairing.

## 3. Restart

| Situasi | Perintah | Efek |
|---|---|---|
| Demo, ingin data & pairing tetap | `npm run demo:resume` | Container DB dijalankan ulang tanpa reset, lalu CMS `:8081` + API `:9091` |
| Demo, ingin database bersih | `npm run demo` | **Menghapus** DB demo `360booking_reconstruction_test`, migrasi + seed ulang; akun uji dan pairing hilang |
| Test parity/regression | `npm run test:server:parity` / `test:server:regression` | Hanya me-reset `360booking_parity_test`; DB demo tidak disentuh |
| Demo, mematikan DB | `npm run demo:stop` | Container `360booking-postgres-test` berhenti |
| Produksi, hanya API | `sudo systemctl restart 360booking-server` | Koneksi socket terputus, klien reconnect |
| Produksi, ubah nginx | `sudo nginx -t && sudo systemctl reload nginx` | Tanpa memutus API |
| Produksi, ubah env | edit `/etc/360booking/app.env` lalu restart service | Semua sesi JWT lama bisa tetap valid bila `JWT_SECRET` tidak berubah |

Dua database berbagi satu container: `360booking_reconstruction_test` untuk
demo dan `360booking_parity_test` untuk suite parity/regression. Reset parity
dijalankan oleh `database/scripts/reset-parity-db.sh` (membuat DB bila belum
ada), dan skrip itu menolak nama database demo.

Urutan aman saat menutup demo: `Ctrl+C` pada `npm run demo` (server menutup
socket dan pool DB), lalu `npm run demo:stop` bila container ingin dimatikan.

Setelah restart, cek:

```bash
curl -fsS http://127.0.0.1:9091/api/health
sudo systemctl status 360booking-server --no-pager
sudo journalctl -u 360booking-server -n 50 --no-pager
```

## 4. Pemulihan setelah reboot (mesin demo Windows/WSL)

Urutan yang sudah terbukti (README “Setelah restart mesin”):

1. `npm run demo:resume` — **jangan** `npm run demo` bila pairing tablet
   ingin dipertahankan.
2. Jalankan forwarder LAN: `python3 ~/bin/forward9091.py` (port 5100).
3. Bila CMS/tablet tidak bisa diakses:
   - cek portproxy: `netsh interface portproxy show all`;
   - bila entri hilang, hapus lalu tambah ulang:
     `netsh interface portproxy delete v4tov4 listenport=5100 listenaddress=0.0.0.0`
     lalu `add v4tov4 listenport=5100 listenaddress=0.0.0.0 connectport=5100 connectaddress=127.0.0.1`
     (butuh PowerShell admin);
   - pastikan profil Ethernet **Private**, bukan Public:
     `Set-NetConnectionProfile -InterfaceAlias Ethernet -NetworkCategory Private`;
   - bila port CMS 8081 dipakai proses lain, set `PORT=8082` di `.env.local`,
     tambahkan portproxy 8082, dan buka `http://<ip-server>:8082`.
4. Verifikasi tablet benar-benar lewat LAN: lihat koneksi masuk ke port 5100
   dari IP tablet dan log server terus menerima `/context` + `/schedule`.

## 5. Backup dan restore

### 5.1 Kondisi saat ini

**Belum ada backup otomatis, retensi, atau uji restore di repo.** Yang ada
hanya skrip demo yang menghapus database demo dan skrip parity yang menghapus
`360booking_parity_test`. Anggap belum ada jaminan backup sampai langkah
berikut dipasang.

### 5.2 Rekomendasi backup harian

```bash
# /etc/360booking/backup.env (0600): PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
sudo install -d -m 700 /var/backups/360booking
sudo -u postgres pg_dump -Fc -d 360booking \
  -f "/var/backups/360booking/360booking-$(date +%F-%H%M).dump"
```

- Simpan 14 salinan harian + 1 bulanan; hapus yang lebih lama dengan `find`.
- Jalankan lewat systemd timer harian, bukan cron, agar log terpusat.
- Simpan salinan di mesin lain (rsync/NAS); backup di host yang sama tidak
  melindungi dari kegagalan disk.

### 5.3 Uji restore (lakukan berkala)

```bash
sudo systemctl stop 360booking-server
sudo -u postgres createdb 360booking_restore_test
sudo -u postgres pg_restore --clean --if-exists -d 360booking_restore_test <dump>
# arahkan sementara PG_DATABASE ke DB uji, cek login + kalender, lalu hapus DB uji
sudo systemctl start 360booking-server
```

Jangan pernah menguji restore di database produksi.

## 6. Monitoring

### 6.1 Yang sudah ada

- `GET /api/health` → `200 {"ok":true}` tanpa kredensial.
- Log JSON terstruktur (`server/observability/logger.js`) dengan
  `request_id`, status, dan `error_code`.
- Status tablet di CMS: `online`, `last_seen_at`, `refresh_expires_at`.
- `systemd` me-restart API otomatis (`Restart=on-failure`).

### 6.2 Yang belum ada (rekomendasi)

| Kebutuhan | Rekomendasi |
|---|---|
| Uptime | Probe `/api/health` tiap 1 menit dari host lain; alarm bila 3 gagal berturut |
| Backup | systemd timer harian + verifikasi ukuran file |
| Disk | Alarm bila `/var` atau `/var/lib/postgresql` >80% |
| Database | Pantau `pg_stat_activity` (koneksi menumpuk) dan ukuran DB |
| Tablet | Alarm bila `last_seen_at` >5 menit untuk perangkat aktif saat jam kerja |
| Log | Rotasi journal (`SystemMaxUse=`) dan kirim ke penyimpanan terpusat |
| Metrik | Belum ada Prometheus/OpenTelemetry; mulai dari health + log dulu |

## 7. Prosedur re-pair tablet

Dipakai setelah database demo direset (`npm run demo`), ruangan dihapus,
sandi ruangan diganti, atau perangkat dicabut. Suite parity/regression tidak
lagi memicu langkah ini karena memakai database `360booking_parity_test`.

1. **Cabut perangkat lama** — CMS → Manajemen → Perangkat Tablet → pilih
   ruangan → Cabut. Alternatif API:
   ```bash
   curl -X DELETE "https://<domain>/api/kiosk/devices/<device-id>" \
     -H "Authorization: Bearer <token-admin>"
   ```
2. Pastikan tidak ada perangkat aktif tersisa untuk ruangan itu (daftar
   `GET /api/kiosk/devices?roomId=<uuid>`).
3. Di tablet, buka layar provisioning; isi URL server (`https://<domain>`),
   email ruangan, dan sandi. Bila sesi lama masih tersimpan, aplikasi akan
   mencoba refresh dan gagal `401`; pairing baru tetap diperlukan.
4. Simpan; server membuat `device_id` baru dan mengembalikan token.
5. Verifikasi:
   - CMS menampilkan `online: true`;
   - tablet menampilkan jadwal hari ini;
   - log server menerima `/context` dan `/schedule` tiap ~20 detik.
6. Bila pairing ditolak `409 ROOM_ALREADY_PAIRED`, ulangi langkah 1 — masih
   ada perangkat aktif (termasuk yang refresh-nya belum kedaluwarsa).

Catatan: `npm run demo:accounts` **tidak** memulihkan perangkat kiosk; pairing
harus dilakukan ulang setelah reset DB.

## 8. Rotasi JWT

`JWT_SECRET` menandatangani token CMS dan kiosk. Rotasi dilakukan bila secret
dicurigai bocor atau saat pergantian tim.

1. Buat secret baru: `openssl rand -base64 48`.
2. Ganti `JWT_SECRET` di `/etc/360booking/app.env` (jangan commit).
3. `sudo systemctl restart 360booking-server`.
4. `curl -fsS http://127.0.0.1:9091/api/health`.
5. Dampak:
   - Semua sesi CMS lama → `401 AUTH_REQUIRED`; pengguna login ulang.
   - Access token kiosk lama → `401`; tablet otomatis memanggil
     `/api/kiosk/refresh`, mendapat token baru, dan `token_version` naik.
     Refresh token tersimpan sebagai hash di DB, jadi tidak perlu pairing ulang
     selama refresh belum kedaluwarsa (`KIOSK_REFRESH_DAYS`, default 30 hari).
   - Socket lama terputus dan harus reconnect dengan token baru.
6. Bila ingin **memaksa** semua tablet pairing ulang, cabut perangkat di CMS
   atau ganti sandi akun ruangan (keduanya menaikkan `token_version` dan
   memutus socket).

Jangan mengganti `JWT_ISSUER`/`JWT_AUDIENCE` bersamaan tanpa mengubah
konfigurasi kiosk; token lama akan ditolak.

## 9. Insiden umum

| Gejala | Cek | Tindakan |
|---|---|---|
| CMS 502 | `systemctl status 360booking-server`, `journalctl` | restart service; cek DB |
| Login 401 semua user | `JWT_SECRET` berubah? akun `is_deleted`? role kosong? | perbaiki env/akun, login ulang |
| Booking 403 `FLOOR_REQUIRED` | `tbl_users.floor` akun | isi lantai di Manajemen → Users |
| Booking 403 `FLOOR_RESTRICTED` | lantai akun vs ruangan | pilih ruangan yang benar atau ubah lantai (admin) |
| Kiosk `409 ROOM_ALREADY_PAIRED` | daftar perangkat | cabut perangkat lama, pairing ulang |
| Kiosk offline | `last_seen_at`, jaringan, URL server | cek portproxy/forwarder, DNS/TLS |
| “No time left today” | jam server dan `APP_TIMEZONE` | periksa zona waktu dan meeting berikutnya |
| Laporan kosong | rentang tanggal dan `checked_in` | laporan hanya menghitung booking aktif |

## 10. Kontribusi dan kepemilikan kode

### 10.1 Aturan kontribusi

- Cari kode dengan **XERJ** (`xerj def`, `xerj search`) sebelum menulis;
  `grep` hanya untuk file non-kode atau repo yang belum di-index.
- Kode harus dapat dibaca manusia: nama jelas, SQL multi-baris, tanpa trik
  termampatkan.
- Bahasa: identifier/kode/komentar **Inggris**; isi dokumen dan UI Indonesia.
- Jangan menaruh rahasia, kartu nyata, email pribadi, atau IP mesin di repo.
- Gerbang sebelum push: `npm run verify` (build client+server, test client,
  unit server). Suite paritas/regresi menyentuh DB dan harus disetujui.
- Tidak ada force-push kecuali prosedur sanitasi rahasia yang disetujui.
- Perubahan versi mengikuti [`VERSIONING.md`](VERSIONING.md): `Ver.Rev`
  user-facing, `package.json` `Ver.Rev.0`, APK `versionName`/`versionCode`
  naik monoton.

### 10.2 Kepemilikan area

| Area | Pemilik utama | File kunci |
|---|---|---|
| Backend API/DB | `server-dev` | `server/features/`, `database/migrations/` |
| CMS React/MUI | `cms-dev` | `client/` |
| Tablet kiosk & native | `kiosk-dev` | repo `kioskapp` |
| Deploy/CI/LAN | `devops-deployer` | `deploy/`, `.github/workflows/` |
| Verifikasi & bukti uji | `qa-verifier` | `server/tests/`, `client/tests/` |
| Keamanan & sanitasi | `security-sanitizer` | audit staged work, riwayat git |
| Hardware NFC/relay/LED | `hardware-tech` | modul native kiosk |
| Versi & dokumen | `docs-versioner` | `docs/VERSIONING.md`, `TODO.md`, README |

Perubahan lintas area dikoordinasikan oleh `team-lead`; jangan mengubah
kontrak API tanpa memperbarui `docs/api-reference.md` dan test terkait.

## 11. Belum dapat diverifikasi

- Seluruh langkah deploy/HTTPS/backup di atas belum dijalankan pada sesi ini;
  dokumen disusun dari skrip dan konfigurasi yang ada.
- Belum ada bukti backup/restore nyata, monitoring uptime, atau rotasi JWT
  yang dieksekusi di produksi.
- Perilaku nginx saat upgrade WebSocket dalam waktu lama belum diuji beban.
