# Audit `floor` produksi (dari snapshot vault)

Sumber: `nauchara/DATABASE.md` (snapshot **2026-10-21**, diambil read-only dari
produksi `<ip-server>`), `nauchara/CORE-SERVICE.md`, dan
`nauchara/360Booking-ARCHITECTURE.md`. Tidak ada query baru ke produksi pada
audit ini.

## Ringkasan

**Data lantai karyawan belum ada di produksi.** Kolom `tbl_users.floor`
menurut skema hanya diisi untuk `type='room'`; karyawan tidak punya nilai
lantai. Karena itu aturan "karyawan hanya memesan ruangan di lantainya"
**tidak bisa langsung diaktifkan** tanpa pemetaan data.

## Fakta dari snapshot

| Item | Nilai | Sumber |
|---|---|---|
| Total baris `tbl_users` (karyawan + ruangan) | **271** | `DATABASE.md` §2 |
| Ruangan aktif (`type='room'`, `is_deleted=false`) | **11** | `DATABASE.md` §3 |
| `tbl_role` | 3 baris (`Admin`, `User`, `employee`) | §2 |
| `floor` | hanya diisi untuk `type='room'` | §4 (tabel `tbl_users`) |
| `card_number` di `tbl_users` | **legacy** — tidak dipakai lagi | §4 |
| Kartu karyawan sebenarnya | `tbl_user_cards` **265** baris | §2 |
| Kartu master pintu | `tbl_card_masters` **24** baris | §2 |
| `tbl_rooms` | 0 baris (legacy, jangan dipakai) | §2–3 |

Lantai ruangan (dari data ruangan) sudah terisi; jumlah pasti per lantai tidak
tercatat di snapshot, tetapi ruangan aktif berjumlah 11.

## Dampak bila aturan lantai dinyalakan sekarang

Kode server (hardened) menegakkan:

- `FLOOR_RESTRICTION=true` (default) → non-admin **tanpa** `floor`:
  `403 FLOOR_REQUIRED` saat membuat booking.
- Kiosk `POST /api/kiosk/events/instant|book` juga memerlukan `floor` karyawan
  pemilik kartu; tanpa itu `403 FLOOR_REQUIRED`.

Konsekuensi: **seluruh karyawan non-admin (≈260 akun) tidak bisa memesan**
sampai lantainya diisi. Admin (dikecualikan) tetap bisa.

## Celah model kartu

Snapshot menunjukkan kartu produksi disimpan di `tbl_user_cards` (265 baris),
sedangkan rekonstruksi membaca `tbl_users.card_number` (legacy). Sebelum fitur
kartu kiosk dipakai di produksi, perlu diputuskan:

1. Migrasi data `tbl_user_cards` → `tbl_users.card_number`, atau
2. Mengubah repository agar membaca `tbl_user_cards` (dan menyesuaikan
   check-in/instant/door + test).

Tanpa salah satu, kartu karyawan produksi akan ditolak sebagai
`INVALID_CARD` meskipun kartunya sah.

## Rekomendasi rollout

1. **Sebelum pemetaan selesai:** deploy dengan `FLOOR_RESTRICTION=false`
   (env, tanpa ubah kode) agar tidak mengunci karyawan.
2. **Pemetaan lantai:** ambil daftar karyawan + lantai dari HR/ops, lalu isi
   lewat CMS (Manajemen → Pengguna) atau SQL satu-off dengan persetujuan.
   Gunakan `all` hanya untuk resepsionis/security/manajemen yang memang
   lintas lantai.
3. **Setelah lantai terisi dan diverifikasi**, nyalakan
   `FLOOR_RESTRICTION=true` dan uji: booking lantai sendiri (200), lantai lain
   (403), kiosk instant dengan kartu lantai sendiri (200).
4. **Kartu:** putuskan jalur migrasi `tbl_user_cards` sebelum mengaktifkan
   fitur kartu di kiosk produksi.
5. **Verifikasi berkala:** bandingkan jumlah karyawan tanpa lantai = 0 sebelum
   menutup item ini.

## Yang belum bisa disimpulkan dari snapshot

- Daftar email karyawan per lantai (tidak ada di vault; butuh HR atau query
  read-only baru).
- Berapa karyawan yang benar-benar aktif login (tidak ada kolom last-login di
  skema).
- Nilai `floor` tepat per ruangan (hanya jumlah ruangan aktif yang tercatat).

## Status item TODO

Audit **selesai pada tingkat data snapshot**; **pemetaan lantai karyawan**
masih menunggu data HR dan tetap menjadi prasyarat sebelum
`FLOOR_RESTRICTION=true` di produksi.
