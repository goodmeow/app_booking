# Defect produksi yang terverifikasi (2026-10-21)

Daftar ini berasal dari pengujian runtime terhadap **server dan APK asli**,
bukan dari rekonstruksi. Sumber lengkap:

- `nauchara/CORE-SERVICE.md §11` — backend, 54/54 uji lokal + verifikasi produksi
- `nauchara/KIOSK-APK-ANALYSIS.md §8` — state kiosk di tablet
- `nauchara/DATABASE.md` — inventaris DB live

## Status di rekonstruksi

| # | Defect produksi | Dampak | Status di repo ini |
|---|---|---|---|
| 1 | `GET /api/rooms/available` selalu 400 (`column "undefined"`) | fitur ketersediaan ruangan mati | **diperbaiki** — `room.service.js` memakai parameter eksplisit |
| 2 | Filter `GET /api/settings/card-master?card_number=` selalu 400 (`syntax error at or near "tcm"`) | pencarian kartu mati | **diperbaiki** — query langsung berparameter, bukan SP konkatenasi |
| 3 | `settings` & `card-master` tanpa `adminOnly` | user biasa bisa baca/ubah settings dan nomor kartu | **diperbaiki** — semua route settings `adminOnly` |
| 4 | Socket.io menerima koneksi tanpa token, `room:join` bebas | penyadapan/broadcast lintas ruangan | **diperbaiki** — `handshake.auth.token` diverifikasi |
| 5 | `GET /api/users` terbuka untuk role `USER` | seluruh data karyawan + kartu terbaca | **tidak diubah** — `GET /users` tetap hanya `requireSignin` (paritas) |
| 6 | `POST /api/events` tidak mencocokkan `organizer` dengan token | pembuatan event atas nama orang lain | **diperbaiki** — organizer diambil dari principal |
| 7 | `PUT /events/check-in` idempoten (200 berulang) | tidak ada bedanya dengan sukses pertama | **diperbaiki** — window + state check-in divalidasi |
| 8 | SQL injection lewat `where_clause` di banyak SP | eksekusi SQL sewenang-wenang | **diperbaiki** — tidak ada lagi konkatenasi `where_clause`; query berparameter |
| 9 | JWT tanpa `exp` | token tidak pernah kedaluwarsa | **diperbaiki** — `expiresIn` dikonfigurasi |
| 10 | `Access-Control-Allow-Origin: *` | situs mana pun bisa memanggil API dengan token | **diperbaiki** — origin allowlist |
| 11 | Cek-in/akses kartu memakai `parseInt` UID 4 byte dibalik | format kartu harus cocok persis | **tidak diubah** — kompatibilitas perangkat |
| 12 | Server mati → kiosk tetap hijau "Available" | ruangan terlihat kosong saat offline | **tidak berlaku** — perilaku APK, bukan server |

## Catatan

Repo ini adalah **reimplementasi yang diperkeras**, bukan salinan bug-for-bug.
Karena itu `server-parity-report.md` hanya menjamin kontrak bentuk
(request/response/status) dan efek database, bukan kesamaan cacat.

Keputusan yang disengaja:

- endpoint `/api/kiosk/*` adalah tambahan, tidak ada di server asli;
- validasi kartu memakai tabel langsung, bukan `card_master_validation`;
- kiosk pada repo ini adalah halaman web, sedangkan tablet asli adalah APK
  React Native (lihat `tablet-integration-notes.md`).
