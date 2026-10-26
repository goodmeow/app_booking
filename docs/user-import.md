# Import Pengguna dari CSV

Fitur ini untuk membuat/memperbarui banyak akun sekaligus dari CMS:
**Manajemen → Users → Import CSV**.

## Kunci utama

**Master key = `employee_id`**, bukan email.

- `employee_id` wajib, unik, dan dibandingkan case-insensitive.
- Email tetap wajib dan unik, tetapi email **bukan** kunci merge.
- Jika `employee_id` baru tetapi email sudah dipakai akun lain, baris gagal.
- Jika `employee_id` sama muncul dua kali dalam satu file, baris kedua gagal.

## Format CSV

Header minimal:

```csv
employee_id,name,email,role,floor,card_number
EMP-001,Budi Santoso,budi@example.test,user,3,1234567890
EMP-002,Siti Aminah,siti@example.test,receptionist,5,
```

Kolom:

| Kolom | Wajib | Keterangan |
|---|---|---|
| `employee_id` | ya | kunci utama; huruf/angka/titik/dash/underscore, maks 40 |
| `name` | ya | nama tampilan |
| `email` | ya | harus unik |
| `role` | tidak | `user` (default), `receptionist`, `admin` |
| `floor` | tidak | lantai kerja; sel kosong = tanpa lantai; kolom tidak ada = floor lama dipertahankan |
| `card_number` | tidak | satu kartu per baris; ditambahkan ke akun |

CSV mendukung tanda kutip, koma di dalam field, dan CRLF.

## Mode import

### Skip
Jika `employee_id` sudah ada, baris dilewati. Akun lama tidak berubah.

### Overwrite
Jika `employee_id` sudah ada:
- nama, email, role, dan floor diperbarui;
- `card_number` ditambahkan bila diisi;
- **password lama tidak diubah**;
- kartu lama tidak dihapus.

Setiap baris overwrite berjalan dalam satu transaksi. Bila `card_number`
bentrok dengan akun lain, seluruh perubahan profil baris itu dibatalkan
(rollback), sehingga tidak ada nama/email/role yang terlanjur berubah.
Admin aktif terakhir tidak boleh diturunkan rolenya lewat import: baris
ditolak `LAST_ADMIN`.

Jika `employee_id` belum ada, akun baru dibuat.

## Password dan kartu

- Akun baru memakai password awal **`123456Ab`** dan wajib ganti saat login
  pertama.
- Akun lama tidak di-reset password-nya oleh import.
- Kartu mengikuti aturan maksimal **2 kartu aktif** per akun.
- Kartu yang sudah dimiliki akun yang sama tidak diduplikasi.

## Hasil import

Ringkasan berisi:

```text
created, updated, skipped, failed
```

Kesalahan per baris ditampilkan di dialog (maksimal 5 pertama), termasuk:
- `INVALID_EMPLOYEE_ID`
- `DUPLICATE_EMPLOYEE_ID`
- `IDENTITY_EXISTS`
- `EMPLOYEE_ID_EXISTS`
- `CARD_EXISTS`
- `CARD_LIMIT`
- `LAST_ADMIN`
- role tidak dikenal

Baris yang gagal tidak membatalkan baris lain.

## API

Admin only:

```http
POST /api/users/import
Content-Type: application/json

{
  "mode": "skip",
  "rows": [
    {
      "employee_id": "EMP-001",
      "name": "Budi Santoso",
      "email": "budi@example.test",
      "role": "user",
      "floor": "3",
      "card_number": "1234567890"
    }
  ]
}
```

Batas 500 baris per request. Jangan mengirim password melalui CSV/API ini;
password baru selalu default dan wajib diganti.

## Catatan keamanan

- Hanya admin yang dapat memakai endpoint/UI ini.
- File CSV dan dump user berisi data pribadi; jangan commit.
- Setelah import, audit akun baru dan kartu di tab Users.
