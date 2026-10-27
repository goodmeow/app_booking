# Catatan rilis v3.12.0 (Ver 3 Rev 13)

Tanggal: **2026-10-27**. Versi ini menutup gelombang akses per peran dan
pengerasan security setelah UAT Docker.

| Artefak | Versi | Lokasi |
|---|---|---|
| CMS/API | `3.12.0` | `package.json` + `package-lock.json` |
| Riwayat versi | Ver 3 Rev 13 | `docs/VERSIONING.md` |
| APK kiosk | `1.3.9`, code `20` | `kioskapp/android/app/build.gradle` |
| APK distribusi | `1.3.9` | `public/apk/kiosk-release.apk` + `public/apk/README.md` |

## Fitur

- Super Admin dari akun `/setup`; akun dilindungi dari hapus/demote.
- Matrix menu CMS per role di **Settings → User Role Management**.
- Multi-lantai (`tbl_users.floors`), form user multi-select, kalender dan
  kiosk mengikuti daftar lantai.
- Resepsionis melihat/mengubah booking di semua lantai yang dipegang.
- Audit log untuk role, lantai, kartu, pengaturan, reset sandi, dan matrix.
- Kiosk 1.3.9: pill `TERSEDIA` 44 px, copy netral, context timer yang aman.

## Perbaikan security/operasional

- Rate limit tidak bisa diakali `X-Forwarded-For`; `TRUST_PROXY=1`.
- Compose wajib secret DB/JWT; default secret dihapus.
- Pairing kiosk diserialkan per room.
- Backup gagal dicoba ulang setiap 5 menit.
- Auto-release tidak melepas room yang sedang check-in.
- Status ruangan difilter per floor.
- Usage report dibatasi 366 hari.
- 18 dependency tidak terpakai dihapus.

## Bukti

```text
unit server    85/85
unit kiosk     21/21
client         98/98
regression     95/95
parity          8/8
build client   OK
build server   OK
```

UAT remote: health/CMS/APK page HTTP 200. APK SHA-256
`521a200ec31da71f69d4ed2528fef0340546f54cdafc55ef241aa10eca33275f`.

## Checklist rilis

- [ ] `package.json` + `package-lock.json` sama-sama `3.12.0`.
- [ ] APK `1.3.9` (20) terpasang/terdistribusi.
- [ ] Regression, parity, dan smoke UAT lulus.
- [ ] Backup + restore test sebelum go-live.
- [ ] DNS/TLS/nginx produksi aktif.
