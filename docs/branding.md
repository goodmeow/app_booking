# Branding

Panduan operasional identitas visual CMS RoomBooking. Isi dokumen ini mengikuti
implementasi yang ada di repo: `client/management/BrandingSection.js`,
`server/features/branding/`, `database/migrations/019_branding.sql`, dan
`client/theme.js`.

## 1. Tujuan dan prinsip

- Branding mengikuti identitas tablet kiosk (The Prasada), supaya layar CMS,
  halaman login, dan kiosk terlihat satu keluarga.
- Perubahan brand tidak boleh butuh build ulang: nama, judul tab, ikon,
  wordmark, dan favicon diatur dari CMS dan disimpan di database.
- Aset disimpan sebagai `bytea` di database (bukan di disk container) supaya
  tidak hilang saat container dibangun ulang. Ukurannya dibatasi kecil.
- Nama teknis (database, service, environment, path API) **tidak** ikut
  berubah saat branding diganti.

## 2. Nama brand

| Konteks | Nilai | Sumber |
| --- | --- | --- |
| Nama produk di CMS (navbar, drawer, login, signup) | `RoomBooking` | `brand_name` di DB, fallback `client/locales/*/common.json` → `brand.name` |
| Judul tab browser | `RoomBooking — The Prasada` | `document_title` di DB, fallback `brand.documentTitle` |
| Wordmark perusahaan | `The Prasada` | gambar `wordmark` (aset statis bawaan) |
| Label panel login | `Panel admin ruang meeting` / `Room meeting admin panel` | i18n `brand.adminPanel` (tidak bisa diubah dari CMS) |
| Footer versi CMS | `RoomBooking CMS v<Ver.Rev>` | i18n `brand.footer` + `package.json` |
| Nama teknis (kode, DB, container, service) | `app_booking`, `360booking` | **jangan diubah** |

`brand_name` adalah teks bebas (maks 80 karakter) yang tampil di bawah wordmark
pada navbar, dan sebagai judul di halaman signup. `document_title` (maks 120
karakter) menjadi `<title>` tab.

## 3. Aset

Tiga jenis aset, semuanya diunggah dari CMS:

| Kind | Fungsi | Fallback statis | Tinggi preview di CMS |
| --- | --- | --- | --- |
| `mark` | ikon/logo kotak (navbar, login, signup, force-password) | `/the-prasada-mark.png` | 64 px |
| `wordmark` | tulisan "The Prasada" (navbar, login, signup) | `/the-prasada-wordmark.png` | 28 px |
| `favicon` | ikon tab browser | `/the-prasada-mark.png` | 32 px |

Batas unggah (ditegakkan di client **dan** server):

- Format: PNG, JPEG, WebP, ICO (`image/png`, `image/jpeg`, `image/webp`,
  `image/x-icon`, `image/vnd.microsoft.icon`).
- Ukuran maksimum **512 KB** (524 288 byte). File kosong ditolak.
- Pengiriman: data URL base64 pada body `{ "data_url": "data:image/png;base64,..." }`.
- Lokasi simpan: tabel `tbl_brand_assets` (kolom `kind`, `mime`, `bytes`),
  satu baris per kind; unggah ulang menimpa baris yang sama (`ON CONFLICT`).
- Reset: tombol "Reset to default" menghapus baris aset, sehingga fallback
  statis di `public/` dipakai lagi.
- Aset statis bawaan di `public/`: `the-prasada-mark.png` (523×487, ±23 KB),
  `the-prasada-wordmark.png` (1733×189, ±20 KB), `the-prasada-logo.png`
  (1754×855, ±54 KB, dipakai kiosk native, bukan CMS).

Catatan: gambar raster disarankan berlatar transparan dan beresolusi cukup
untuk tinggi tampil di atas (mark ±150 px di halaman login). Rasio asli
dipertahankan (`object-fit: contain`).

## 4. Warna state ruangan

Warna state ruangan didefinisikan di kiosk (`kioskapp/src/theme/palette.ts`) dan
dipakai juga sebagai acuan token CMS di `client/theme.js`.

| State | Arti | Panel | Aksen | LED | Label i18n |
| --- | --- | --- | --- | --- | --- |
| `available` | ruangan kosong | `#0B6B3A` | `#3DDC84` | 5 | `state_available` |
| `upcoming` / `waiting` | rapat akan mulai / menunggu check-in | `#3A2A00` | `#FFB800` | 20 | `state_upcoming` / `state_waiting` |
| `occupied` | rapat berjalan | `#7A1A15` | `#B3261E` | 4 | `state_occupied` |
| `offline` | tablet tidak mengirim data | `#2A323C` | `#A9B3BF` | 6 | `state_offline` |

Turunan token CMS (`client/theme.js`, mode gelap): primary `#2FB46A`
(dark `#0B6B3A`, light `#3DDC84`), secondary/warning `#FFB800`, error `#FF8A80`,
background `#11151B` / paper `#171E26`, teks `#EDF2F6` / `#9FB0BF`, radius 10,
AppBar `#0C1014`.

Catatan verifikasi: halaman kiosk versi web di CMS (`client/kiosk/kiosk-state.js`)
masih memakai tabel warna lama (`available #44865a`, `awaitingCheckIn #8a6d00`,
`occupied #c70039`). Yang menjadi acuan identitas adalah `palette.ts` tablet;
menyamakan tabel web itu belum dilakukan.

## 5. Tipografi dan tone visual

- Font utama: **Public Sans** (self-hosted, `public/fonts/PublicSans-latin.woff2`,
  weight 500–800), fallback Inter → system UI.
- Inter (self-hosted) dan Source Serif 4 tersedia di `client/fonts.css`; Source
  Serif 4 dipakai halaman kiosk web untuk judul.
- Tone: gelap, tenang, kontras tinggi untuk layar ruangan; aksen hijau untuk
  "boleh dipakai", kuning untuk "segera mulai", merah untuk "sedang dipakai".
- Huruf kapital berjarak lebar hanya untuk label kecil (mis. `RoomBooking` di
  bawah wordmark), bukan untuk paragraf.

## 6. Mengganti branding

1. Masuk sebagai admin.
2. Buka **Management → Settings**, scroll ke bagian **Branding** (tab yang sama
   dengan pengaturan umum, di bawah tombol Save).
3. Ubah **Brand name** dan **Browser tab title**, lalu klik **Save branding**.
4. Untuk tiap aset (Icon, The Prasada logo, Favicon): klik **Upload image**,
   pilih file (PNG/JPEG/WebP/ICO, ≤ 512 KB). Pratinjau langsung berubah.
5. Untuk kembali ke aset bawaan, klik **Reset to default** pada aset terkait.
6. Muat ulang tab lain (dan halaman kiosk web) untuk melihat perubahan; tab yang
   sedang dipakai mengambil ulang data lewat RTK Query setelah simpan/unggah.

API di balik layar (untuk rujukan, bukan untuk dipakai manual tanpa izin):

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/api/branding` | publik (dipakai halaman login) |
| GET | `/api/branding/:kind` | publik, cache `immutable` + `?v=<epoch ms updated_at>` |
| PUT | `/api/branding` | admin |
| PUT | `/api/branding/:kind` | admin (body `data_url`) |
| DELETE | `/api/branding/:kind` | admin |

## 7. Di mana branding dipakai

| Lokasi | Yang dipakai | Batasan |
| --- | --- | --- |
| Navbar & drawer (`client/core/Menu.js`) | `mark`, `wordmark`, `brand_name` | wordmark harus terbaca di tinggi ±15 px |
| Halaman login (`client/auth/SigninBrandPanel.js`) | `mark` (150 px), `wordmark` (46 px), label i18n | label panel tidak bisa diubah dari CMS |
| Signup & force-password | `mark`, `wordmark`, `brand_name` | — |
| Judul tab & favicon (`client/i18n/DocumentLocale.js`) | `document_title`, `favicon` | berlaku saat app dimuat |
| Footer (`client/core/VersionFooter.js`) | teks i18n + versi `package.json` | bukan bagian branding dinamis |
| Kiosk tablet native (`kioskapp`) | aset build: `assets/the-prasada-logo.png` + teks `RoomBooking` | **statis**, tidak membaca branding CMS; ganti aset berarti build APK baru |
| Kiosk web di CMS (`client/kiosk/`) | warna dari `kiosk-state.js`, font Public Sans/Source Serif | belum mengikuti `mark`/`wordmark` dinamis |

## 8. Aturan penting

- **Jangan commit gambar/logo baru tanpa izin.** Aset resmi diunggah lewat CMS;
  menaruh file di `public/` berarti ikut ke build dan ke repo.
- Jangan menaruh IP internal, kredensial, UID kartu, atau data pribadi di
  dokumen maupun di nama/berkas aset.
- Jangan mengubah nama teknis: database, service Docker, path API, nama tabel,
  dan variabel environment tetap seperti sekarang. Branding hanya teks dan
  gambar.
- Jangan mengubah fallback `public/the-prasada-*.png` atau `BRAND_FALLBACKS`
  tanpa persetujuan, karena itu yang tampil saat database kosong.
- Ukuran besar tidak akan terpakai: file > 512 KB ditolak server dengan
  `INVALID_BRANDING`.

## 9. Checklist ganti branding

- [ ] Nama brand dan judul tab sudah disepakati (ejaan, tanda hubung, kapital).
- [ ] `mark` transparan, terbaca di latar `#0C1014`, tinggi ≥ 300 px.
- [ ] `wordmark` transparan, terbaca di tinggi 15–46 px.
- [ ] `favicon` berbentuk persegi, masih jelas di 16–32 px.
- [ ] Semua file ≤ 512 KB dan berformat PNG/JPEG/WebP/ICO.
- [ ] Cek tampilan: navbar, login, signup, force-password, judul tab, favicon.
- [ ] Cek di layar gelap; tidak ada teks putih di atas latar terang.
- [ ] Catat perubahan di `TODO.md` (tanggal + siapa) bila branding resmi berubah.
- [ ] Jangan commit aset baru ke `public/` tanpa izin; unggah lewat CMS.
