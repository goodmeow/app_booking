# Runbook Operasional

Panduan menjalankan, merawat, dan memulihkan RoomBooking. Sumber utama
deploy tetap [`../deploy/README.md`](../deploy/README.md); dokumen ini
melengkapi bagian operasional yang belum tercakup di sana. Versi acuan:
CMS/API `3.11.0`, APK kiosk `1.3.8` (code 19).

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

Alternatif yang juga didukung: stack **Docker Alpine** (§2.5) dengan
`postgres:16-alpine`; nama database/service teknis tetap `360booking`,
branding UI tetap RoomBooking.

## 2. Deploy pertama

Ikuti urutan di `deploy/README.md`:

```bash
sudo ./deploy/01-install-prerequisites.sh
sudo install -d -m 0750 /etc/360booking
sudo cp deploy/app.env.example /etc/360booking/app.env
sudo cp deploy/provision.env.example /etc/360booking/provision.env
sudo chown root:root /etc/360booking/app.env /etc/360booking/provision.env
sudo chmod 600 /etc/360booking/app.env /etc/360booking/provision.env
sudo nano /etc/360booking/app.env          # runtime only
sudo nano /etc/360booking/provision.env    # superuser/admin only
sudo ./deploy/02-provision-database.sh     # role + DB + migrasi
./deploy/03-build.sh                       # npm ci && npm run build
sudo ./deploy/04-install-app.sh            # /opt/360booking + systemd + nginx
# buka https://<host>/setup dan buat akun Super Admin pertama (lihat §2.1)
# atau, bila halaman setup tidak dipakai: sudo ./deploy/05-create-admin.sh
```

`03-build.sh` boleh dijalankan di mesin lain; `04` membutuhkan
`build/client`, `build/server/server.bundle.cjs`, `package.json`, dan
`package-lock.json` di root repo host target.

### 2.1 Akun Super Admin pertama lewat `/setup` (instalasi baru)

Database hasil `02-provision-database.sh` belum punya akun. Halaman `/setup`
CMS membuat akun pertama tanpa perlu JWT:

1. Pastikan service hidup dan `GET /api/setup/status` mengembalikan
   `{"required":true}`.
2. Buka `https://<host>/setup`, isi nama, email, password (8–72 byte), dan
   employee ID (opsional, default `ADMIN-001`).
3. `POST /api/setup` membuat akun role **`super_admin`** (`type=employee`,
   password bcrypt cost 12, tanpa paksa ganti password, `is_protected=true`),
   mengisi baris `tbl_app_settings` default bila belum ada, lalu menulis
   `setup_completed=true`. Semuanya dalam satu transaksi.
4. Setelah sukses, `GET /api/setup/status` menjadi `{"required":false}` dan
   `POST /api/setup` selalu `409 SETUP_COMPLETED`. Login di CMS memakai akun
   tersebut, lalu buat akun Admin/Resepsionis untuk operasional harian.
5. Jika `POST /api/setup` menjawab `400 SUPER_ADMIN_ROLE_MISSING`, jalankan
   migrasi (role `super_admin` diisi migrasi 022) lalu ulangi.

Akun yang dibuat lewat `/setup` tidak memakai `must_change_password`, karena
password dipilih sendiri oleh operator. Akun ini **dilindungi**: tombol Hapus
tidak ada, `DELETE /api/users/:id` menjawab `403 PROTECTED_ACCOUNT`, dan
role-nya tidak bisa diturunkan — termasuk oleh Admin lain. Jangan mengaktifkan
`/setup` untuk database yang sudah berisi user: status membaca
`setup_completed` dan keberadaan akun admin/super admin, sehingga endpoint tetap menolak
`409`.

`deploy/05-create-admin.sh` tetap tersedia sebagai jalur alternatif (mis. bila
halaman setup tidak dapat diakses). Jalankan salah satu, jangan keduanya.
Skrip itu memasang role `admin` hardcoded, sehingga **tidak** menghasilkan
Super Admin; setelah login, promosikan akun tersebut lewat database bila
matrix menu dan log audit perlu dipakai.

### 2.2 Jebakan: `tbl_role` kosong pada database baru

`02-provision-database.sh` hanya menjalankan migrasi. Migrasi 022 mengisi role
`super_admin`, dan seed demo mengisi `admin`/`user`/`receptionist`, tetapi
`05-create-admin.sh` memakai `role_id` admin hardcoded dengan FK ke
`tbl_role`. Pada database yang benar-benar baru, langkah 05 dapat gagal bila
role admin belum ada. Verifikasi:

```sql
SELECT role_name FROM tbl_role ORDER BY role_name;
```

Bila role belum lengkap, isi lebih dulu (id sama dengan seed demo):

```sql
INSERT INTO tbl_role (_id, role_name, is_deleted) VALUES
  ('a1e5d7c9-2b64-4f38-9a10-7c3d5e8f6b21', 'super_admin', false),
  ('471ba030-c950-41f9-90da-4e0fe10426a6', 'admin', false),
  ('3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73', 'receptionist', false),
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

### 2.5 Docker Alpine (alternatif deploy)

Stack uji/produksi kecil: `deploy/docker/compose.alpine.yaml` menjalankan
`postgres:16-alpine` (db), `node:20-alpine` (app API), dan `nginx:alpine`
(web SPA + proxy `/api` + `/socket.io`). Build context harus root repo.

```bash
# Sekali saja: buat env lokal, lalu isi origin CMS/tablet.
cp deploy/docker/.env.example deploy/docker/.env

docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine \
  up -d --build
docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine ps
```

Simpan `ALPINE_CORS_ORIGINS` dan `ALPINE_DB_PATH` di `deploy/docker/.env`
supaya tetap terbaca setiap `up`/rebuild.

| Service | Host | Container |
|---|---|---|
| web | `http://localhost:8082` | `80` |
| app (API) | `http://127.0.0.1:9191` | `9091` |
| db | tidak dipublikasikan | `5432` |

- `entrypoint.sh` menunggu `pg_isready`, membuat `schema_migrations`, lalu
  menerapkan migrasi yang belum tercatat (urut nama file) dan men-seed role
  `admin`/`user`/`receptionist`. Restart container aman (idempoten).
- Instalasi baru: `GET /api/setup/status` → `{"required":true}`, buka
  `http://localhost:8082/setup`, buat akun Super Admin pertama; panggilan berikutnya
  `409 SETUP_COMPLETED` (§2.1).
- Backup DB Docker: lihat `deploy/docker/README.md`. Gunakan `pg_dump`/CMS
  Backup untuk named volume maupun `database/pgdata`; jangan menyalin folder
  PostgreSQL yang sedang hidup. Jangan pakai default password/secret contoh di
  produksi.
- Setelah go-live, impor fresh install tetap memakai §5.3 (event historis
  tidak dimigrasikan).

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
2. Pastikan stack Docker aktif; Nginx mempublikasikan **8082** langsung
   (tanpa forwarder Python).
3. Bila CMS/tablet tidak bisa diakses:
   - cek `docker-compose ... ps` dan listener `8082`;
   - cek firewall Windows untuk TCP 8082;
   - portproxy hanya diperlukan bila WSL memakai NAT, bukan mirrored network.
4. Verifikasi tablet benar-benar lewat LAN: lihat koneksi masuk ke port 8082
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

Langkah 4 wajib lebih dulu dari impor: setelah akun pertama ada,
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
`@<company-domain>`, 40 akun tanpa kartu, dan (bila ruangan belum diimpor)
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
- Backup diatur dari **CMS → Pengaturan → Backup database**: enable, path,
  jam, retensi, dan tombol **Backup sekarang**. Scheduler berjalan di proses
  API; Docker memakai volume `/backups`.

### 6.2 Yang belum ada (rekomendasi)

| Kebutuhan | Rekomendasi |
|---|---|
| Uptime | Probe `/api/health` tiap 1 menit dari host lain; alarm bila 3 gagal berturut |
| Backup | Aktifkan dari CMS → Pengaturan → Backup database; verifikasi file/retensi |
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

Verifikasi versi setelah pairing: footer kiosk menampilkan
`v<versi APK> (<versionCode>) · CMS <versi server>` (contoh
`v1.3.8 (19) · CMS 3.11.0`), bukan lagi “perangkat …”. Bila bagian `CMS`
kosong/`unknown`, tablet belum berhasil memuat `/api/kiosk/context` versi
terbaru — cek koneksi dan pastikan server sudah di-restart dengan build baru.
Tombol **Finish** sengaja tersembunyi; muncul setelah **5 tap** pada pill
**IN USE** (easter egg operator), dan **+15 menit** meminta kartu
organizer/peserta/master yang diverifikasi server.

Catatan: `npm run demo:accounts` **tidak** memulihkan perangkat kiosk; pairing
harus dilakukan ulang setelah reset DB.

### 7.1 Update APK tablet dari halaman `/apk`

Halaman unduh statis ada di `public/apk/index.html` → URL
`https://<domain>/apk/index.html` (file APK: `/apk/kiosk-release.apk`).
Tombol **Unduh APK Tablet** di CMS → Manajemen → Perangkat Tablet menunjuk ke
file yang sama.

1. Pastikan versi file sesuai rilis yang diumumkan: footer tablet harus
   menampilkan `v1.3.8 (19) · CMS 3.11.0` setelah update. Versi saat ini
   adalah rebuild `1.3.8` build tag `1.3.8-19-85ca335`.
2. Unduh APK dari server sendiri (jangan dari chat/email), lalu pasang di
   tablet (buka file, izinkan instalasi sekali).
3. Buka aplikasi kiosk, cek footer versi dan status **Online** di tab
   Perangkat Tablet.
4. Bila perangkat tidak lagi aktif (dicabut/kedaluwarsa >30 hari), pairing
   ulang lewat §7.

Untuk mengganti paket distribusi:

1. Build release di repo `kioskapp`, salin `app-release.apk` menjadi
   `public/apk/kiosk-release.apk`.
2. Perbarui teks versi di `public/apk/index.html` dan tambahkan satu baris
   riwayat (tanggal, `versionName`/`versionCode`, build tag, ukuran, SHA-256)
   di `public/apk/README.md`.
3. `npm run build` agar salinan di `build/client/apk/` ikut, lalu deploy.
4. Verifikasi: `curl -sI https://<domain>/apk/kiosk-release.apk` → `200` dan
   `Content-Length` sama dengan ukuran file; cocokkan SHA-256 dengan catatan
   rilis.

```bash
sha256sum public/apk/kiosk-release.apk
curl -sI https://<domain>/apk/kiosk-release.apk | head -5
```

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
| Booking 403 `FLOOR_REQUIRED` | `tbl_users.floors` (dan `floor` lama) akun | isi lantai di Manajemen → Users (bisa lebih dari satu) |
| Booking 403 `FLOOR_RESTRICTED` | lantai akun vs lantai ruangan | tambahkan lantai akun atau pilih ruangan yang benar |
| Menu hilang / 403 `Menu access required` | matrix peran di Manajemen → Pengaturan | Super Admin membuka menu yang dicabut (cache ±30 detik) |
| Matrix atau Log audit 403 | role akun | hanya `super_admin`; akun setup dilindungi, jangan diturunkan |
| `DELETE` user 403 `PROTECTED_ACCOUNT` | akun setup | akun Super Admin memang tidak bisa dihapus |
| Kiosk `409 ROOM_ALREADY_PAIRED` | daftar perangkat | cabut perangkat lama, pairing ulang |
| Kiosk offline | `last_seen_at`, jaringan, URL server | cek portproxy/forwarder, DNS/TLS; tablet mencoba 3× sebelum `OFFLINE` |
| Kiosk menolak +15 menit | kartu yang di-tap | gunakan kartu organizer/peserta/master; server menolak kartu lain (`403`) |
| Tombol Selesai tidak ada | desain 1.3.7+ | tap pill **IN USE** 5× untuk membuka **Finish**; sebelum jam mulai muncul “Tombol Selesai aktif pukul HH:MM”, di 1.3.8 tombol langsung terbuka saat jam mulai |
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

## 11. Pengembangan lokal, demo, dan LAN tablet

### 11.1 Demo deterministic

```bash
npm install
npm run demo
```

Perintah ini menyalakan container PostgreSQL compose (`127.0.0.1:54320`,
project `360booking`, container `360booking-postgres-test`), mereset database
`360booking_reconstruction_test`, menerapkan migrasi + seed sanitized, lalu
menjalankan CMS/Vite `:8081` dan API/Socket.io `:9091`. Status `Demo ready`
baru tampil setelah login database dan proxy client terverifikasi.
`Ctrl+C` menghentikan aplikasi (database tetap hidup); `npm run demo:stop`
menghentikan container.

Akun demo (khusus database disposable):

| Akun | Email | Sandi | Keterangan |
|---|---|---|---|
| Admin | `admin@example.test` | `ParityTest123!` | akses penuh CMS |
| Ruangan (kiosk) | `room-one@room.com` | `RoomTablet123!` | pairing tablet |
| Karyawan uji | `karyawan@uji.prasada.test` | `1234` | kartu uji NFC dummy |
| Karyawan uji 2 | `emp@uji.local` | `1234` | kartu `DEMO-UJI-CARD` |

### 11.2 Dua database di satu container

| Database | Dipakai oleh | Di-reset oleh |
|---|---|---|
| `360booking_reconstruction_test` | `npm run demo`, CMS, tablet kiosk | `npm run demo` (`rebuild-test-db.sh`) |
| `360booking_parity_test` | `test:server:parity`, `test:server:regression` | `database/scripts/reset-parity-db.sh` |

Suite parity/regression hanya me-reset `360booking_parity_test`, sehingga akun
demo, kartu NFC, dan pairing tablet tidak ikut terhapus. `npm run demo:resume`
menyalakan ulang aplikasi tanpa reset.

### 11.3 Memulihkan akun demo

`npm run demo` membangun ulang DB demo, jadi akun uji tambahan hilang dan
pairing tablet perlu diulang:

1. `npm run demo` — bangun ulang database + nyalakan server.
2. `npm run demo:accounts` — kembalikan akun demo (termasuk `role_id`, syarat
   login server).
3. Pasangkan ulang tablet bila sesi kiosk hilang (`pm clear` + provisioning).

`demo:accounts` harus dijalankan **setelah** demo; bila dijalankan lebih dulu,
rebuild akan menghapusnya lagi.

### 11.4 Pengembangan kustom

```bash
cp .env.example .env      # isi koneksi PostgreSQL lokal yang aman
npm run development       # atau: npm run dev:client / npm run dev:server
```

Build produksi memakai `npm run build` dan menghasilkan folder **`build/`**
(bukan `dist/`): `build/client/` hasil Vite dan `build/server/` hasil webpack.
Bagian terpisah tersedia lewat `npm run build:client`, `npm run build:server`,
dan `npm run create:server:package`.

### 11.5 Tablet kiosk satu segment LAN (tanpa USB reverse)

Tablet dan laptop dijadikan satu subnet (contoh `192.168.1.0/24`):

| Sisi | Konfigurasi |
|---|---|
| Tablet (`eth0`) | statis `<ip-tablet>/24` via Settings → Ethernet (persisten) |
| Windows host | statis `<ip-server>/24` via `netsh` |
| Akses LAN | Docker web mem-publish **8082** langsung (tanpa forwarder Python) |
| Firewall | rule inbound TCP 8082 (`360booking-kiosk-8082`) |
| APK | URL server diketik saat provisioning; HTTP polos diizinkan lewat `network_security_config.xml` |

Origin LAN untuk CMS (mis. `http://<ip-server>:8082`) jangan di-commit; salin
ke `.env.local` (di-ignore) yang ditimpa di atas `.env.demo` saat
`npm run demo`. `adb` hanya diperlukan untuk instalasi APK dan screenshot.

Tablet tahan putus sambung: saat kabel dicabut layar menampilkan `OFFLINE`, dan
begitu kabel kembali tablet pulih otomatis tanpa dibuka ulang.

### 11.6 Struktur proyek

```text
app_booking/
├── client/            # CMS: auth/, core/, calendar/, domain/, locales/,
│                      # redux/, user/, reports/, tests/
├── server/            # features/, routes/, runtime/, socket/, db/,
│                      # observability/, tests/{unit,parity,regression}
├── config/config.js   # baca env + validasi runtime
├── scripts/           # demo.js, demo-accounts.js, dev-*, start-*
├── database/          # migrations/, seeds/, scripts/, tests/
├── deploy/            # 01..05 (Ubuntu), docker/, nginx/, systemd/
├── public/apk/        # kiosk-release.apk + riwayat
├── docs/              # dokumentasi (lihat docs/README.md)
├── build/             # hasil build (generated)
└── TODO.md            # peta pengerjaan & sisa item
```

### 11.7 Lint dan format

```bash
npm run lint          # ESLint 9 flat config (client, server, scripts, config)
npm run format:check  # Prettier --check sesuai .prettierrc
```

Lint belum menjadi gate: `npm run verify` dan CI sengaja tidak menjalankannya
sampai baseline bersih. Pembersihan dilakukan bertahap per folder
(`npm run lint -- <folder>`, `npx prettier --write <folder>`), bukan sekali
tulis massal, supaya diff review tetap kecil dan `git blame` tidak hilang.

## 12. Belum dapat diverifikasi

- Seluruh langkah deploy/HTTPS/backup di atas belum dijalankan pada sesi ini;
  dokumen disusun dari skrip dan konfigurasi yang ada.
- Belum ada bukti backup/restore nyata, monitoring uptime, atau rotasi JWT
  yang dieksekusi di produksi.
- Perilaku nginx saat upgrade WebSocket dalam waktu lama belum diuji beban.
