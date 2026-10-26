# Alpine Docker stack (app_booking)

Stack uji/demo di atas Alpine: `db` PostgreSQL, `app` Node API, `web` nginx
yang menyajikan SPA dan mem-proxy `/api` + `/socket.io`.

## Perintah

Jalankan dari root repo (build context harus root agar `package-lock.json`,
`client/`, `server/`, dan `database/migrations/` ikut):

```bash
# Sekali saja: buat env lokal, lalu isi origin CMS/tablet.
cp deploy/docker/.env.example deploy/docker/.env

# validasi compose
docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine config

# build + jalankan
docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine up -d --build

# status + log
docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine ps
docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine logs -f app

# hentikan (volume DB tetap)
docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine down

# hapus stack + SEMUA named volume (DB + backup); bind mount database/pgdata tetap
docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine down -v
```

Di laptop ini `docker compose` tidak tersedia; gunakan `docker-compose` dengan
argumen yang sama.

Nilai `ALPINE_CORS_ORIGINS` dan `ALPINE_DB_PATH` disimpan di
`deploy/docker/.env` supaya tetap terbaca setiap `up`/rebuild. Jangan hanya
mengekspor di satu terminal.

## Port dan endpoint

| Service | Host | Container |
| --- | --- | --- |
| web (SPA + proxy) | `http://localhost:8082` | `80` |
| app (API langsung) | `http://127.0.0.1:9191` | `9091` |
| db | tidak dipublikasikan | `5432` |

- Health API: `GET http://127.0.0.1:8082/api/health` -> `{"ok":true}`
- Status setup: `GET /api/setup/status`
- Halaman setup: `http://localhost:8082/setup`

## Environment

Semua nilai punya default lokal di `compose.alpine.yaml`; jangan pakai nilai
ini di produksi. Override lewat shell env:

| Variabel | Default |
| --- | --- |
| `ALPINE_PGDATABASE` | `360booking` |
| `ALPINE_PGUSER` | `booking` |
| `ALPINE_PGPASSWORD` | `booking_alpine_local_only` |
| `ALPINE_JWT_SECRET` | secret uji >= 32 karakter |
| `ALPINE_CORS_ORIGINS` | `http://localhost:8082` |
| `ALPINE_DB_PATH` | `alpine-db-data` (named volume) |

`validateRuntimeConfig()` membaca `JWT_SECRET` (bukan `JWT_SECRET_KEY`) dan
menolak secret < 32 karakter atau placeholder `change-me`.

## Alur initial setup

1. `app` menunggu `db` healthy lewat `pg_isready`.
2. `deploy/docker/entrypoint.sh` membuat tabel `schema_migrations`, lalu
   menerapkan `database/migrations/*.sql` yang belum tercatat (urut nama file).
   Migrasi yang sudah tercatat dilewati, jadi restart container aman.
   `021_protect_setup_admin.sql` menandai admin pertama sebagai
   `is_protected`; akun itu tidak bisa dihapus (`403 PROTECTED_ACCOUNT`).
3. Role tetap di-seed dengan UUID kontrak client:
   - admin `471ba030-c950-41f9-90da-4e0fe10426a6`
   - user `67e9500b-908a-497d-9d3b-54bc020700cb`
   - receptionist `3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73`
4. API start. Pada DB kosong `GET /api/setup/status` mengembalikan
   `{"required":true}`; `POST /api/setup` membuat admin pertama. Setelah itu
   status menjadi `false` dan `POST` kedua menghasilkan `409`.

## Volume dan backup

- Default: volume bernama `roombooking-alpine_alpine-db-data`.
- Kalau ingin data di dalam repo, set:
  ```bash
  mkdir -p database/pgdata
  chmod 700 database/pgdata
  # lalu set di deploy/docker/.env:
  # ALPINE_DB_PATH=../../database/pgdata
  ```
  Folder `database/pgdata/` sudah gitignored. Ini hanya untuk Linux/ext4;
  jangan pakai di `/mnt/e` (drvfs) karena ownership PostgreSQL bisa gagal.
  Pindah dari named volume lama: backup dulu, lalu restore dump ke bind mount;
  mengganti path tanpa restore akan membuat database kosong.
- Backup dengan `pg_dump` (aman saat database berjalan):
  ```bash
  docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine \
    exec -T db pg_dump -U booking -d 360booking -Fc > roombooking-db.dump
  ```
- Restore ke database kosong:
  ```bash
  docker-compose -f deploy/docker/compose.alpine.yaml -p roombooking-alpine \
    exec -T db pg_restore -U booking -d 360booking --clean --if-exists < roombooking-db.dump
  ```
- `database/pgdata` dan named volume sama-sama memakai `pg_dump`; jangan
  menyalin folder PostgreSQL yang sedang hidup.
- `down` tanpa `-v` mempertahankan data dan pairing tablet. `down -v` menghapus
  **named volume DB dan volume backup**; bind mount `database/pgdata` tidak
  terhapus.

## Catatan

- `public/apk/kiosk-release.apk` ikut ke image web karena `.dockerignore`
  memakai allowlist `public/**`. Jangan menambahkan `public/` ke exclude.
- Folder `integration/`, `.env*`, test, `docs/`, `dist/`, dan `build/` lokal tidak
  masuk build context.
- bcrypt 6 dikompilasi di stage build (Alpine/musl). Jika npm tidak menemukan
  prebuild, stage build sudah menyiapkan `python3 make g++`.

## Backup dan monitoring Docker

Backup diatur dari **CMS → Pengaturan → Backup database**:
- toggle enable
- path (Docker: `/backups` di volume `backup-data`)
- jam harian (HH:MM, `APP_TIMEZONE`)
- retensi hari
- tombol **Backup sekarang**

Scheduler berjalan di proses API (`backup.service.js`). Healthcheck host lama tetap tersedia untuk manual; backup host cron tidak dipakai lagi.
