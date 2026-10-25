# Catatan rilis v3.10.3 (Ver 3 Rev 10)

Dokumen ini menyiapkan tag rilis; **tag belum dibuat dan belum di-push**.
Jalankan hanya setelah semua butir checklist di bawah terbukti.

## Artefak versi

| Artefak | Nilai | Lokasi |
|---|---|---|
| CMS/API | `3.10.3` | `package.json` (`version`) + `package-lock.json` |
| Riwayat versi | Ver 3 Rev 10 | `docs/VERSIONING.md` |
| APK kiosk | `versionName 1.3.5`, `versionCode 16` | `kioskapp/android/app/build.gradle` dan `kioskapp/src/config.ts` |
| APK distribusi | `public/apk/kiosk-release.apk` | riwayat di `public/apk/README.md` |

Footer CMS membaca `package.json` saat build, jadi build produksi harus dibuat
ulang dari commit tag. Build copy yang menyimpan `package.json` lama akan
menampilkan versi usang (`v0.0.0`/`3.5.0`); sinkronkan dulu sebelum build.

## Isi rilis

### CMS

- **Manajemen → Pengguna**: pencarian nama/email/employee ID, kolom Role
  (chip) + filter role yang bisa digabung dengan filter lantai, tabel setinggi
  viewport dengan pagination 25/50/100. `GET /api/users` (admin) kini
  menyertakan `role_id`.
- **Manajemen → Pengaturan**: panel Floor groups dihapus (berkas
  `FloorGroupsSection.js` dan `floor-groups.js` ikut dihapus) dan diganti
  form **Global settings** untuk `not_checked_in_time_limit`,
  `time_of_event_start_soon`, `lock_timer`, `led_timer`, `table_input`, dan
  `self_signup_enabled`. `PUT /api/settings` mengirim seluruh baris.
- **Kalender**: filter **Building** di sidebar dihapus; daftar ruangan kembali
  semua. Field `building` tetap tersimpan di master ruangan.

### Kiosk 1.3.5

- Tombol **Finish** disembunyikan; muncul setelah **5 tap** pill **IN USE**
  (easter egg operator).
- **+15 menit** wajib kartu organizer/attendee/master. Server memverifikasi
  kartu pada `POST /api/kiosk/events/extend`; ini bukan pembatasan UI.
- Saat `AVAILABLE` tanpa jadwal berikutnya: hanya **30 minutes** +
  **Pick a time**; tombol until-next tidak tampil.
- Siklus `/context` + `/schedule` dicoba **3×** (backoff) sebelum status
  `OFFLINE`.
- Footer kecil menampilkan versi APK + **versi CMS** (`v1.3.5 (16) · CMS
  3.10.3`), bukan “perangkat …”.
- Status **Started early** memakai `checkedInAt` (jam check-in aktual); bila
  null, label tampil tanpa jam.

### Server kiosk

- `POST /api/kiosk/events/extend` wajib `card_number`; hanya
  organizer/attendee/master.
- `/api/kiosk/schedule` mengirim `checkedInAt`.
- `/api/kiosk/context` mengirim `cmsVersion`.

### Deploy dan operasional (sudah ada di wave ini)

- Docker Alpine: `node:20-alpine` + `postgres:16-alpine` + `nginx:alpine`;
  entrypoint migrasi + seed role; initial setup lewat `/setup`.
- Kit fresh install: 238 user, 198 kartu, 11 ruangan, 5 akun khusus,
  24 master card. **Event historis tidak dimigrasikan.**
- `backup-db.sh` / `restore-db.sh` + systemd timer harian, `preflight-import.mjs`,
  `import-fresh-assets.mjs`, `import-bjb-users.mjs --fresh`.
- Nama teknis DB/service tetap `360booking`; brand UI **RoomBooking**.

## Checklist sebelum tag

- [ ] `git status` bersih; tidak ada file `.local.*`, `.env.*`, atau dump
      database yang ikut ter-stage.
- [ ] `package.json` dan `package-lock.json` sama-sama `3.10.3`.
- [ ] `npm run verify` lulus (build client, build server check, test client,
      unit server).
- [ ] `npm run test:server:regression` dan parity dijalankan pada DB
      disposable (bukan impor produksi), hasil dilampirkan di tiket rilis.
- [ ] `bash -n database/scripts/backup-db.sh database/scripts/restore-db.sh`
      dan `node --check` untuk ketiga skrip `.mjs` lulus.
- [ ] Backup produksi terbaru ada dan checksum-nya valid.
- [ ] Pre-flight fresh pada database target kosong lulus tanpa error blocker.
- [ ] Dry-run fresh melaporkan 238 create, 198 kartu, 11 ruangan, 5 special,
      dan 24 master card tanpa error tak terduga.
- [ ] Apply fresh + apply ulang: putaran kedua seluruhnya `skipped`.
- [ ] Smoke test CMS: login admin, buat user, tambah/ganti kartu, booking,
      health `GET /api/health` → `{ok:true}`.
- [ ] Smoke test tablet: pairing, buka pintu, jadwal hari ini, +15 menit
      dengan kartu, Finish setelah 5 tap pill IN USE, footer menampilkan
      `CMS 3.10.3`.
- [ ] Tidak ada kredensial, email asli, nomor kartu, atau IP LAN di diff.

## Perintah tag (jalankan manual, jangan dari agen)

```bash
git status
git diff --check
git log --oneline -5

# setelah checklist selesai
git tag -a v3.10.3 -m "Ver 3 Rev 10: users/settings/kiosk hardening, RoomBooking 1.3.5"
git show v3.10.3 --stat
git push origin v3.10.3
```

Bila tag sudah terlanjur dibuat tetapi belum di-push:

```bash
git tag -d v3.10.3
```

## Catatan impor produksi

Tag boleh dibuat sebelum impor dijalankan. Server baru memakai alur **fresh
install** di `docs/operations-runbook.md` §5.3: seed role → backup → preflight
fresh → dry-run → apply rooms/special/master-cards → apply users+cards →
verifikasi. **Event historis tidak dimigrasikan.**

Jangan menjalankan `--apply` pada database `bjb`, `bjb_compare`,
`360booking_reconstruction_test`, atau `360booking_parity_test`; `--apply` juga
menolak bila `PGDATABASE` ≠ `IMPORT_TARGET_DB` atau tanpa bukti backup.

## Riwayat rilis sebelumnya

Catatan rilis v3.9.0 tidak lagi dipertahankan sebagai file terpisah; isi
gelombang Rev 7–Rev 9 sudah tercatat di `docs/VERSIONING.md`.
