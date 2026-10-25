# Backup dan Restore Database

Dokumen ini menjelaskan backup rutin, verifikasi restore, dan prosedur restore
produksi untuk RoomBooking. **Restore tidak tersedia sebagai tombol di CMS**
karena sifatnya destruktif: database di-drop, koneksi diputus, dan API harus
dihentikan sementara.

## 1. Di mana backup disimpan

### Docker (stack Alpine)

Backup diatur dari:

**CMS → Pengaturan → Backup database**

- toggle enable
- path (default `/backups`)
- jam harian (`HH:MM`, zona waktu aplikasi)
- retensi hari
- tombol **Backup sekarang**

File berada di volume Docker `backup-data`, bukan di filesystem host secara
langsung. Lihat isi volume:

```bash
docker compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine \
  exec -T app ls -lh /backups
```

### Native/systemd

Path diatur di CMS. Service berjalan sebagai user `360booking`, jadi path harus
writable oleh user tersebut, misalnya:

```text
/var/backups/360booking
```

Contoh membuat direktori:

```bash
sudo install -d -m 0700 -o 360booking -g 360booking /var/backups/360booking
```

## 2. Membuat backup manual

### Dari CMS

Tekan **Backup sekarang**. Respons berisi nama file, path, dan ukuran.

### Docker via CLI

```bash
docker compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine \
  exec -T app sh -lc 'pg_dump -U "$PGUSER" -d "$PGDATABASE" -Fc' \
  > /tmp/roombooking-manual.dump
```

### Native

```bash
sudo ./database/scripts/backup-db.sh \
  --env-file=/etc/360booking/backup.env \
  --output-dir=/var/backups/360booking
```

## 3. Verifikasi backup (wajib)

Jangan anggap backup valid hanya karena file ada. Restore ke database
**disposable**, jangan ke produksi.

### Docker

```bash
COMPOSE="docker compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine"
TMPDB="restore_test_$(date +%s)"

$COMPOSE exec -T db createdb -U booking "$TMPDB"
$COMPOSE exec -T app cat /backups/<nama-file>.dump \
  | $COMPOSE exec -T db pg_restore -U booking -d "$TMPDB" \
      --no-owner --no-privileges

$COMPOSE exec -T db psql -U booking -d "$TMPDB" -c "
  SELECT 'users' AS tabel, count(*) FROM tbl_users
  UNION ALL SELECT 'events', count(*) FROM tbl_events
  UNION ALL SELECT 'cards', count(*) FROM tbl_user_cards
  UNION ALL SELECT 'migrations', count(*) FROM schema_migrations;
"

$COMPOSE exec -T db dropdb -U booking "$TMPDB"
```

### Native

```bash
sudo ./database/scripts/restore-db.sh /var/backups/360booking/<file>.dump \
  --env-file=/etc/360booking/backup.env \
  --target-db=360booking_restore_test
```

Setelah verifikasi, drop database uji:

```bash
sudo -u postgres dropdb 360booking_restore_test
```

## 4. Restore produksi — Docker

> **Berhenti dulu.** Restore menghapus data sejak backup dibuat.
> Ambil backup kondisi sekarang sebelum mulai.

```bash
cd /path/ke/app_booking
COMPOSE="docker compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine"

# 1. Backup kondisi sekarang
$COMPOSE exec -T db pg_dump -U booking -d 360booking -Fc \
  > /tmp/sebelum-restore.dump

# 2. Ambil file backup dari volume app
docker cp "$($COMPOSE ps -q app):/backups/<nama-file>.dump" /tmp/restore.dump

# 3. Hentikan API agar tidak ada write
$COMPOSE stop app

# 4. Drop + create database
$COMPOSE exec -T db dropdb --force -U booking 360booking
$COMPOSE exec -T db createdb -U booking -O booking 360booking

# 5. Restore
cat /tmp/restore.dump | $COMPOSE exec -T db pg_restore \
  -U booking -d 360booking --no-owner --no-privileges

# 6. Nyalakan lagi
$COMPOSE start app web

# 7. Verifikasi
curl -fsS http://127.0.0.1:8082/api/health
```

Saat `app` start, entrypoint menjalankan migrasi yang belum ada. Jadi dump
lama tetap bisa dinaikkan ke skema terbaru.

## 5. Restore produksi — native

```bash
# Backup kondisi sekarang
sudo ./database/scripts/backup-db.sh \
  --env-file=/etc/360booking/backup.env \
  --output-dir=/var/backups/360booking

# Restore paksa ke database produksi
sudo ./database/scripts/restore-db.sh /var/backups/360booking/<file>.dump \
  --env-file=/etc/360booking/backup.env \
  --target-db=360booking --force

# Script tidak me-restart API
sudo systemctl restart 360booking-server
curl -fsS http://127.0.0.1:9091/api/health
```

## 6. Setelah restore

1. Cek login admin.
2. Cek jumlah user/event/kartu terhadap backup.
3. Cek tablet:
   - jika token/pairing masih valid, tablet kembali online;
   - jika tidak, lakukan re-pair dari CMS → Tablet Devices.
4. Cek `/api/health` dan log API.
5. Simpan dump yang dipakai restore beserta checksum.

## 7. Rollback bila restore gagal

Gunakan dump `sebelum-restore.dump` yang dibuat pada langkah 1:

```bash
$COMPOSE stop app
cat /tmp/sebelum-restore.dump | $COMPOSE exec -T db pg_restore \
  -U booking -d 360booking --no-owner --no-privileges
$COMPOSE start app web
```

Untuk native, ulangi `restore-db.sh --force` dengan dump sebelum restore.

## 8. Checklist keamanan

- Jangan commit dump, kredensial, atau path berisi data pribadi.
- Batasi akses filesystem backup ke admin.
- Simpan salinan off-host bila tersedia.
- Uji restore minimal sekali sebelum go-live.
- Jangan restore ke database demo/parity.

## 9. Batasan saat ini

- Belum ada tombol restore di CMS.
- Belum ada point-in-time recovery.
- Backup adalah logical dump, bukan streaming/WAL.
- Monitoring alert tidak termasuk scope; gunakan `/api/health` untuk cek.
