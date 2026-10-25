> **Superseded oleh [`release-v3.11.0.md`](release-v3.11.0.md).** Dokumen ini disimpan sebagai riwayat.

# Catatan rilis v3.10.4 (Ver 3 Rev 11)

Patch perbaikan hasil UAT. **Tidak ada tag dan tidak ada push**; dokumen ini
hanya menyiapkan tag setelah checklist di bawah terbukti.

## Artefak versi

| Artefak | Nilai | Lokasi |
|---|---|---|
| CMS/API | `3.10.4` | `package.json` (`version`) + `package-lock.json` |
| Riwayat versi | Ver 3 Rev 11 | `docs/VERSIONING.md` |
| APK kiosk | `versionName 1.3.6`, `versionCode 17` | `kioskapp/android/app/build.gradle` dan `kioskapp/src/config.ts` |
| APK distribusi | `public/apk/kiosk-release.apk` | riwayat di `public/apk/README.md` |

Footer CMS membaca `package.json` saat build. Build copy yang masih menyimpan
`package.json` lama akan menampilkan versi usang (`v0.0.0`/`3.10.3`), jadi
sinkronkan dulu sebelum build produksi.

## Isi rilis

### CMS

- **Kalender: rentang minggu Senin–Minggu.** `startOfWeek` sebelumnya memakai
  `getDay()` (Minggu = 0) sehingga query mengambil Minggu–Sabtu sementara grid
  FullCalendar (`id`/`en-gb`) menampilkan Senin–Minggu. Akibatnya minggu bisa
  kosong dan seleksi drag berhenti di hari Minggu. Sekarang
  `calendarWeekRange`/`calendarRangeForView` menerima `weekStartsOn` (default
  `DEFAULT_WEEK_START_DAY = 1`) dan `MeetingWeek` mengoper nilai yang sama ke
  `firstDay`.
- **Daily recurrence hari Minggu** ikut tampil karena perbaikan rentang yang
  sama; generator recurrence tidak diubah.
- **Floor schedule jadi tampilan awal resepsionis.** `defaultScheduleModeForRole`
  membuka admin pada `all`, resepsionis pada `floor` (jadwal semua ruangan
  lantainya, digabung tanpa duplikat lewat `uniqueCalendarEvents`), karyawan
  pada `mine`. Mode floor punya tombol refresh sendiri.
- **Filter/dropdown ruangan mengikuti role dan lantai.** `roomsForRole`
  membatasi karyawan dan resepsionis ke lantai sendiri (kosong bila lantai
  tidak diketahui); admin dan grup lantai `all` tetap melihat semua. Placeholder
  filter berubah dari “All rooms” menjadi “tanpa filter ruangan”.
- **Booking atas nama tersimpan.** `OnBehalfPicker` mempertahankan karyawan
  terpilih saat hasil pencarian berubah, dan payload create memakai bentuk
  objek (bukan array per-attendee) ketika `organizer_email` diisi — server
  hanya membaca field itu dari objek tunggal, jadi sebelumnya organizer
  tercatat sebagai resepsionis dan `booked_by` kosong.
- **Fokus judul meeting tidak terlepas.** Preview ketersediaan di latar
  belakang tidak lagi men-disable seluruh form; hanya proses simpan/hapus
  yang mengunci (`editor-lock.js`).

### Kiosk 1.3.6 (17)

- 5 tap pill **IN USE** sebelum jam mulai kini menampilkan **“Tombol Selesai
  aktif pukul HH:MM”**; server tetap menolak Finish sebelum `start_at`.
- Judul meeting tampil di bawah pill saat **STARTING SOON** (tetap kosong bila
  `show_subject` dimatikan).
- Copy popup kartu dipisah per aksi: check-in meminta **kartu pemesan
  ruangan**, +15 menerima **kartu peserta atau kartu master**, pintu tetap
  copy sendiri.

## Bukti pengujian

Dijalankan 2026-10-25 pada build copy (`/home/goodmeow/build/app_booking`):

| Suite | Hasil |
|---|---|
| `npm run test:server:unit` | 79/79 |
| `npm run test:unit` (kioskapp) | 21/21 |
| `npm run test:client` | 96/96 |

QA hanya menjalankan suite non-destruktif. **Regresi, parity, dan uji
perangkat tidak dijalankan untuk gelombang ini**; angka regresi/parity lama
(83/83, 8/8) milik Rev 10 dan tidak boleh dikutip sebagai bukti 3.10.4.

## Risiko yang belum diuji

- APK 1.3.6 belum dipasang di tablet: hint Finish early, judul STARTING SOON,
  copy popup kartu, dan layout panel belum dilihat di layar asli.
- Mode floor memakai satu query per ruangan; dedupe baru diuji unit, belum
  dengan booking multi-ruangan sungguhan di DB.
- Booking atas nama baru diuji di level payload; belum diverifikasi di DB
  (`organizer_id` karyawan, `booked_by` resepsionis).
- Regresi dan parity belum diulang, jadi efek samping perubahan filter
  ruangan/role belum tersapu penuh.
- `firstDay` masih hardcode Senin; pengaturan global hari pertama minggu
  belum ada (lihat TODO).

## Checklist sebelum tag

- [ ] `git status` bersih; tidak ada `.env.*`, dump database, atau
      `eslint.config.js` sisa percobaan yang ikut ter-stage.
- [ ] `package.json` dan `package-lock.json` sama-sama `3.10.4`.
- [ ] `npm run verify` lulus.
- [ ] `npm run test:server:regression` dan parity dijalankan pada DB
      disposable, hasil dilampirkan di tiket rilis.
- [ ] Uji tablet: hint Finish early, judul STARTING SOON, popup kartu
      check-in vs +15, footer `v1.3.6 (17) · CMS 3.10.4`.
- [ ] Smoke test CMS: kalender resepsionis terbuka pada jadwal lantai,
      booking atas nama tersimpan dengan organizer karyawan.
- [ ] Tidak ada kredensial, email asli, nomor kartu, atau IP LAN di diff.

## Perintah tag (jalankan manual, jangan dari agen)

```bash
git status
git diff --check
git log --oneline -5

# setelah checklist selesai
git tag -a v3.10.4 -m "Ver 3 Rev 11: perbaikan UAT kalender, on-behalf, kiosk 1.3.6"
git show v3.10.4 --stat
git push origin v3.10.4
```

Catatan rilis sebelumnya tetap ada di
[`release-v3.10.3.md`](release-v3.10.3.md).
