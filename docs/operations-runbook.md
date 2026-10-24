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
# buka https://<host>/setup dan buat admin pertama (lihat §2.1)
# atau, bila halaman setup tidak dipakai: sudo ./deploy/05-create-admin.sh
```

`03-build.sh` boleh dijalankan di mesin lain; `04` membutuhkan
`build/client`, `build/server/server.bundle.cjs`, `package.json`, dan
`package-lock.json` di root repo host target.

### 2.1 Admin pertama lewat `/setup` (instalasi baru)

Database hasil `02-provision-database.sh` belum punya akun. Halaman `/setup`
CMS membuat admin pertama tanpa perlu JWT:

1. Pastikan service hidup dan `GET /api/setup/status` mengembalikan
   `{"required":true}`.
2. Buka `https://<host>/setup`, isi nama, email, password (8–72 byte), dan
   employee ID (opsional, default `ADMIN-001`).
3. `POST /api/setup` membuat akun role `admin` (`type=employee`, password
   bcrypt cost 12, tanpa paksa ganti password), mengisi baris
   `tbl_app_settings` default bila belum ada, lalu menulis
   `setup_completed=true`. Semuanya dalam satu transaksi.
4. Setelah sukses, `GET /api/setup/status` menjadi `{"required":false}` dan
   `POST /api/setup` selalu `409 SETUP_COMPLETED`. Login di CMS memakai akun
   tersebut, lalu lanjut impor user (§5.3).
5. Jika `POST /api/setup` menjawab `400 ADMIN_ROLE_MISSING`, isi role lebih
   dulu (§2.2) lalu ulangi.

Akun yang dibuat lewat `/setup` tidak memakai `must_change_password`, karena
password dipilih sendiri oleh operator. Jangan mengaktifkan `/setup` untuk
database yang sudah berisi user: status membaca `setup_completed` dan
keberadaan admin aktif, sehingga endpoint tetap menolak `409`.

`deploy/05-create-admin.sh` tetap tersedia sebagai jalur alternatif (mis. bila
halaman setup tidak dapat diakses). Jalankan salah satu, jangan keduanya.

### 2.2 Jebakan: `tbl_role` kosong pada database baru

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

### 2.3 Environment penting

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

### 2.4 HTTPS

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

## 5. Backup, restore, dan impor user

Tiga skrip di `database/scripts/` menutup operasi ini. Semuanya membaca
kredensial dari environment atau file env, tidak pernah menulis kredensial ke
log, dan menolak database legacy (`bjb`, `bjb_compare`,
`360booking_reconstruction_test`, `360booking_parity_test`).

| Skrip | Sifat | Keterangan |
|---|---|---|
| `backup-db.sh` | menulis file dump | `pg_dump -Fc`, cek arsip + sha256, retensi, rsync opsional |
| `restore-db.sh` | menimpa DB tujuan | default ke `<db>_restore_test`, `--force` untuk produksi |
| `preflight-import.mjs` | baca saja | cek skema, role, lantai, bentrok plan |
| `import-bjb-users.mjs` | dry-run default | `--apply` butuh `IMPORT_TARGET_DB` + bukti backup |

### 5.1 Backup harian

Buat file kredensial khusus backup (jangan pakai `app.env` untuk timer agar
`NODE_ENV` tidak ikut tersimpan):

```bash
sudo install -d -m 0700 /var/backups/360booking
sudo install -m 0600 /dev/null /etc/360booking/backup.env
sudo nano /etc/360booking/backup.env
```

Isi `backup.env` (ganti nilai `<...>`):

```bash
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=360booking
PGUSER=360booking
PGPASSWORD=<password-role-aplikasi>
BACKUP_DIR=/var/backups/360booking
BACKUP_RETENTION_DAYS=14
# Opsional, salinan off-host (butuh kunci SSH milik root):
BACKUP_RSYNC_TARGET=<user>@<nas>:/srv/360booking/
```

Pasang skrip dan timer:

```bash
sudo install -m 0755 database/scripts/backup-db.sh /usr/local/sbin/360booking-backup
sudo install -m 0644 deploy/systemd/360booking-backup.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/360booking-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now 360booking-backup.timer
sudo systemctl start 360booking-backup.service
journalctl -u 360booking-backup.service -n 30 --no-pager
```

Timer berjalan harian pukul 02:30 (dengan delay acak 15 menit, `Persistent=true`
sehingga ketinggalan jadwal saat host mati tetap dijalankan). Unit memakai
`ProtectSystem=strict` dan hanya boleh menulis ke `/var/backups/360booking`,
jadi direktori itu harus dibuat lebih dulu seperti perintah di atas.

Uji manual (juga cara membuat backup sebelum impor):

```bash
sudo ./database/scripts/backup-db.sh --env-file=/etc/360booking/backup.env
sudo ls -lh /var/backups/360booking/
(cd /var/backups/360booking && sudo sha256sum --check <file>.dump.sha256)
```

Perilaku retensi: file `360booking-*.dump` dan `.sha256` yang lebih tua dari
`BACKUP_RETENTION_DAYS` dihapus setelah dump baru lolos verifikasi. Salinan
off-host memakai `rsync --archive --partial`; bila rsync gagal, backup lokal
tetap ada dan unit keluar non-zero agar alarm monitoring menyala.

### 5.2 Uji restore (lakukan berkala)

Restore selalu ke database uji. Skrip men-drop/membuat ulang DB tujuan dan
menghentikan semua koneksi ke DB itu, jadi jangan arahkan ke produksi.

```bash
# PGUSER di backup.env adalah role aplikasi; untuk membuat DB uji butuh role
# yang punya CREATEDB. Jalankan sebagai postgres dengan env file kosong:
sudo -u postgres env -i PATH="$PATH" \
  PGHOST=/var/run/postgresql PGDATABASE=360booking PGUSER=postgres \
  ./database/scripts/restore-db.sh \
  /var/backups/360booking/<file>.dump \
  --env-file=/dev/null \
  --target-db=360booking_restore_test
```

Verifikasi lalu hapus:

```bash
sudo -u postgres psql -d 360booking_restore_test -c "SELECT count(*) FROM tbl_users;"
sudo -u postgres dropdb 360booking_restore_test
```

Untuk menguji aplikasi terhadap hasil restore, jalankan instance sementara
dengan `PGDATABASE=360booking_restore_test` dan `SERVER_PORT` berbeda; jangan
mengubah `app.env` produksi. Menimpa DB produksi hanya dengan `--force`, dan
hanya setelah `systemctl stop 360booking-server` serta backup terbaru ada.

### 5.3 Impor fresh install (clean slate)

Server baru mulai dari nol: **event historis tidak dimigrasikan**. Seluruh 238
karyawan diimpor sebagai akun **baru** (`action=create`), bukan update akun
lama. Database target harus kosong dari user plan; preflight akan menolak bila
ada email/employee_id yang sudah terpakai.

File rencana berisi PII dan **tidak** masuk repo:

```text
integration/plan-import-fresh.local.csv     238 create, 198 kartu add, 40 tanpa kartu
integration/plan-rooms-fresh.local.csv      11 ruangan aktif
integration/plan-special-users.local.csv     1 admin tablet + 4 resepsionis
integration/plan-master-cards.local.csv      24 nomor master card
integration/plan-password-reset.local.csv   243 baris (238 user + 5 special)
integration/.env.import.local               DEFAULT_PASSWORD
```

Semua file `.local.*`/`.env.*.local` di-ignore git. Jangan menyalin isinya ke
tiket, log, atau dokumen.

Urutan fresh yang benar:

| Urutan | Aset | Skrip | Jumlah |
|---|---|---|---|
| 0 | Role `admin`, `user`, `receptionist` | SQL manual (§5.3.0) | 3 |
| 1 | Backup database kosong | `backup-db.sh` | 1 dump |
| 2 | Preflight read-only | `preflight-import.mjs --fresh` | 0 error |
| 3 | Ruangan | `import-fresh-assets.mjs --phase=rooms` | 11 |
| 4 | Admin operator | halaman `/setup` (§2.1) atau `05-create-admin.sh` | 1 |
| 5 | Admin + resepsionis | `import-fresh-assets.mjs --phase=special` | 5 |
| 6 | Master card | `import-fresh-assets.mjs --phase=master-cards` | 24 |
| 7 | Karyawan + kartu | `import-bjb-users.mjs --fresh` | 238 + 198 |
| 8 | Password | fase `passwords` | no-op (create sudah set default) |

Langkah 4 wajib lebih dulu dari impor: setelah admin pertama ada,
`setup_completed` menjadi `true` sehingga halaman `/setup` tertutup, dan
akun admin yang dipakai mengimpor tidak perlu dibuat manual di SQL.

#### 5.3.0 Seed role

Migrasi hanya mengisi role `receptionist` (015). Database baru tetap butuh
`admin` dan `user`, dan `special` butuh `admin`:

```bash
sudo -u postgres psql -d 360booking <<'SQL'
INSERT INTO tbl_role (_id, role_name, is_deleted) VALUES
  ('471ba030-c950-41f9-90da-4e0fe10426a6', 'admin', false),
  ('67e9500b-908a-497d-9d3b-54bc020700cb', 'user',  false),
  ('3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73', 'receptionist', false)
ON CONFLICT (_id) DO NOTHING;
SQL
sudo -u postgres psql -d 360booking -c "SELECT role_name FROM tbl_role ORDER BY 1;"
```

#### 5.3.1 Backup

```bash
set -a; . /etc/360booking/app.env; set +a
export PLAN=/path/ke/integration/plan-import-fresh.local.csv
export PW=/path/ke/integration/plan-password-reset.local.csv
export ROOMS=/path/ke/integration/plan-rooms-fresh.local.csv
export SPECIAL=/path/ke/integration/plan-special-users.local.csv
export MASTER=/path/ke/integration/plan-master-cards.local.csv
export DEF=/path/ke/integration/.env.import.local

sudo ./database/scripts/backup-db.sh --env-file=/etc/360booking/backup.env
BACKUP=/var/backups/360booking/<file>.dump
```

#### 5.3.2 Preflight fresh (read-only)

```bash
node database/scripts/preflight-import.mjs --fresh   --plan="$PLAN" --passwords="$PW"   --rooms="$ROOMS" --special="$SPECIAL" --master-cards="$MASTER"   --defaults="$DEF"
```

Harus `Summary: errors=0`. Warning yang wajar: 18 email placeholder
`@prasada.id`, 40 akun tanpa kartu, dan (bila ruangan belum diimpor)
`missing-floor` yang akan hilang setelah fase `rooms`.

#### 5.3.3 Dry-run kedua skrip

```bash
node database/scripts/import-fresh-assets.mjs --phase=all   --rooms="$ROOMS" --special="$SPECIAL" --master-cards="$MASTER" --defaults="$DEF"

node database/scripts/import-bjb-users.mjs --fresh --phase=all   --plan="$PLAN" --passwords="$PW" --defaults="$DEF"
```

Dry-run user harus melaporkan `mode=fresh`, `[update] ok=0`, `[create] ok=238`,
`[cards] ok=198`, dan password seluruhnya `skipped` karena create sudah menulis
password default + flag wajib ganti.

#### 5.3.4 Apply aset

```bash
for phase in rooms special master-cards; do
  IMPORT_TARGET_DB=360booking node database/scripts/import-fresh-assets.mjs     --phase="$phase" --apply --backup-file="$BACKUP"     --rooms="$ROOMS" --special="$SPECIAL" --master-cards="$MASTER"     --defaults="$DEF" || break
done
```

#### 5.3.5 Apply karyawan + kartu

```bash
IMPORT_TARGET_DB=360booking node database/scripts/import-bjb-users.mjs   --fresh --phase=all --apply --backup-file="$BACKUP"   --plan="$PLAN" --passwords="$PW" --defaults="$DEF"
```

Fase berjalan `update` (0 baris) → `create` (238) → `cards` (198) →
`passwords` (semua skip). `--cards` tidak dipakai pada fresh karena kartu sudah
ada di plan utama. Semua penulisan per fase dalam transaksi.

#### 5.3.6 Verifikasi

```bash
sudo -u postgres psql -d 360booking -c   "SELECT type, count(*) FROM tbl_users GROUP BY type ORDER BY type;"
sudo -u postgres psql -d 360booking -c   "SELECT count(*) AS aktif FROM tbl_user_cards WHERE status='active';"
sudo -u postgres psql -d 360booking -c   "SELECT count(*) AS master FROM tbl_card_masters;"
sudo -u postgres psql -d 360booking -c   "SELECT count(*) AS wajib_ganti FROM tbl_users WHERE must_change_password;"
```

Target: `employee=243` (238 + 5 special), `room=11`, kartu aktif `198`,
master `24`, wajib ganti `243` (ruangan `false`).

Apply ulang kedua skrip harus `ok=0` dan semua `skipped` (idempoten).
Setelah verifikasi, login CMS sebagai admin tablet, cek daftar ruangan, lalu
pairing tablet.

### 5.4 Mode update lama (kompatibilitas)

Plan lama `integration/plan-import.local.csv` (197 update + 41 create) dan
`plan-card-changes.local.csv` tetap didukung untuk database yang **sudah berisi
user BJB**. Jangan memakai plan ini untuk server clean slate: user lama tidak
ada, sehingga fase update akan melaporkan 197 `user-not-found`.

```bash
node database/scripts/preflight-import.mjs   --plan=integration/plan-import.local.csv   --passwords=integration/plan-password-reset.local.csv   --cards=integration/plan-card-changes.local.csv   --defaults=integration/.env.import.local

node database/scripts/import-bjb-users.mjs --phase=all   --plan=integration/plan-import.local.csv   --passwords=integration/plan-password-reset.local.csv   --cards=integration/plan-card-changes.local.csv   --defaults=integration/.env.import.local
```

Tanpa `--fresh` dan tanpa plan khusus, deteksi otomatis hanya mengaktifkan mode
fresh bila **semua** baris `action=create`; plan campuran tetap berjalan di mode
lama.

### 5.5 Rollback impor

Impor fresh tidak membawa event historis; setelah go-live, satu-satunya rollback
yang bersih adalah restore backup sebelum impor (event baru yang sudah dibuat
setelah go-live akan hilang). Impor hanya menambah user/kartu/ruangan dan
mengubah password serta status kartu.

```bash
sudo systemctl stop 360booking-server
sudo -u postgres env -i PATH="$PATH" PGHOST=/var/run/postgresql PGUSER=postgres \
  ./database/scripts/restore-db.sh "$BACKUP" --env-file=/dev/null \
  --target-db=360booking --force
sudo systemctl start 360booking-server
```

Tanpa downtime, rollback selektif hanya aman untuk user yang dibuat fase
`create` (belum punya event/kartu): hapus berdasarkan `employee_id` dari
report, lalu jalankan ulang fase lain. Jangan menghapus user yang sudah
memiliki event.

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
