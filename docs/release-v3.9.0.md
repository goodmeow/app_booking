# Catatan rilis v3.9.0 (Ver 3 Rev 9)

Dokumen ini menyiapkan tag rilis; **tag belum dibuat dan belum di-push**.
Jalankan hanya setelah semua butir checklist di bawah terbukti.

## Artefak versi

| Artefak | Nilai | Lokasi |
|---|---|---|
| CMS/API | `3.9.0` | `package.json` (`version`) |
| Riwayat versi | Ver 3 Rev 9 | `docs/VERSIONING.md` |
| APK kiosk | `versionName 1.3`, `versionCode 11` | `kioskapp/android/app/build.gradle` |

`package.json` dan `docs/VERSIONING.md` sudah menyebut `3.9.0` / Rev 9; tidak
ada bump tambahan pada rilis ini. Footer CMS membaca `package.json` saat build,
jadi build produksi harus dibuat ulang dari commit tag.

## Isi rilis

- `016_must_change_password.sql` + alur wajib ganti password di server dan CMS.
- Role `receptionist` dan booking atas nama karyawan (Rev 8).
- Employee ID (NIK) unik dan multi-kartu dengan status `lost` (Rev 7).
- Kit operasional: backup/restore, pre-flight impor, executor impor BJB.
- Kit fresh install: 238 karyawan + 198 kartu sebagai create, 11 ruangan,
  5 akun admin/resepsionis, dan 24 master card. Event historis BJB **tidak**
  dimigrasikan; database baru mulai kosong.

## Checklist sebelum tag

- [ ] `git status` bersih; tidak ada file `.local.*`, `.env.*`, atau dump
      database yang ikut ter-stage.
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
- [ ] Smoke test tablet: pairing, buka pintu, jadwal hari ini.
- [ ] Tidak ada kredensial, email asli, nomor kartu, atau IP LAN di diff.

## Perintah tag (jalankan manual, jangan dari agen)

```bash
git status
git diff --check
git log --oneline -5

# setelah checklist selesai
git tag -a v3.9.0 -m "Ver 3 Rev 9: must-change-password, receptionist, import kit 3.9.0"
git show v3.9.0 --stat
git push origin v3.9.0
```

Bila tag sudah terlanjur dibuat tetapi belum di-push:

```bash
git tag -d v3.9.0
```

## Catatan impor produksi

Tag boleh dibuat sebelum impor dijalankan. Server baru memakai alur **fresh
install** di `docs/operations-runbook.md` §5.3: seed role → backup → preflight
fresh → dry-run → apply rooms/special/master-cards → apply users+cards →
verifikasi. **Event historis tidak dimigrasikan.**

Jangan menjalankan `--apply` pada database `bjb`, `bjb_compare`,
`360booking_reconstruction_test`, atau `360booking_parity_test`; `--apply` juga
menolak bila `PGDATABASE` ≠ `IMPORT_TARGET_DB` atau tanpa bukti backup.
