# Face Unlock — Arsitektur

Verifikasi identitas karyawan dengan wajah untuk booking ruang meeting. Metode
yang ada sekarang hanya kartu; wajah menjadi metode utama dan kartu menjadi
cadangan.

- Status: **slice 1 selesai** (engine + tabel + enrollment), kiosk belum.
- Kode: repo `app_faceunlock-service` (terpisah), migrasi: `database/migrations/027_face_templates.sql`.

## 1. Bentuk sistem

```
┌──────────────┐  3–6 frame   ┌─────────────────┐   HTTP    ┌────────────────┐
│ Kiosk (RN)   │ ───────────▶ │ app_booking API │ ────────▶ │ face service   │
│ kamera tablet│ ◀─────────── │ (Express)       │ ◀──────── │ (FastAPI)      │
└──────────────┘   keputusan  └─────────────────┘   skor    └────────────────┘
        │                            │    ▲                        │
        │ tap kartu (cadangan)       ▼    │                        ▼
        └──────────────────▶  PostgreSQL  │                 models/*.onnx
                              embedding    │            YuNet · SFace · MiniFASNet
                              terenkripsi  │                   (liveness: nanti)
```

Tiga proses, satu database. **ZKFaceCapOnline tidak dipakai** di jalur ini —
kiosk memakai kameranya sendiri.

## 2. Tanggung jawab

| Komponen | Tugas | Tidak boleh |
|---|---|---|
| Kiosk (RN) | ambil frame, kirim, tampilkan hasil | menyimpan embedding, memutuskan sendiri |
| app_booking API | auth device, cek booking, putuskan, audit, fallback kartu | menjalankan model ML |
| face service | deteksi, liveness, embedding, pencocokan | membaca tabel booking |
| PostgreSQL | template embedding, log verifikasi | menyimpan foto mentah |

Pemisahan ini membuat aturan bisnis ("boleh masuk ruangan ini atau tidak")
tetap di app_booking, dan model bisa diganti tanpa men-deploy ulang aplikasi.
Service ML yang mati tidak menjatuhkan kiosk: kiosk jatuh ke kartu.

## 3. Alur

**A. Wajah dulu (tanpa kartu)**

1. Kiosk ambil 3–6 frame 640×480 (~300 ms).
2. `POST /api/kiosk/face-unlock` ke app_booking.
3. app_booking validasi `device_id` ada di `tbl_kiosk_devices`, lalu panggil
   `POST /identify` di face service.
4. Face service: deteksi → pilih frame paling frontal → embedding → cosine ke
   seluruh template → ambang + margin.
5. app_booking cocokkan hasil dengan booking aktif di ruangan kiosk itu.
6. Cocok → izinkan. Tidak cocok → minta tap kartu.

**B. Kartu (cadangan)**

1. Kiosk tap kartu → `tbl_user_cards` → identitas diketahui.
2. Opsional `POST /verify` (1:1) untuk konfirmasi wajah.
3. Jalur kartu yang sekarang tidak diubah.

**C. Ambiguitas (satu orang, dua akun)**

Kalau `candidates` berisi lebih dari satu `employee_id` (mis. Robert di Lt 5 dan
Lt 7), face service **tidak** memilih. app_booking memilih akun yang punya
booking aktif di ruangan kiosk tersebut — **keputusan (b)**: yang menentukan
adalah booking, bukan lantai akun.

## 4. API face service

Internal, tidak dipublikasikan ke luar jaringan Docker.

```
GET  /health
POST /reload
POST /identify   { device_id?, frames: [base64 jpeg, ...] }
POST /verify     { employee_id, frames: [...] }
```

Contoh respons nyata dari pengujian:

```json
{"result": "match", "score": 0.7192, "margin": 0.3495,
 "face_group": "90211",
 "candidates": [{"employee_id": "90211", "score": 0.7192}],
 "liveness": null,
 "frame_quality": {"detection_score": 0.908, "yaw": 0.144, "frames_with_face": 1}}
```

Kasus dua akun:

```json
{"result": "match", "score": 1.0, "margin": 0.7711,
 "face_group": "robert-hall",
 "candidates": [{"employee_id": "90187", "score": 1.0},
                {"employee_id": "101240028", "score": 0.9668}]}
```

`result`: `match` | `no_match` | `ambiguous` | `no_face`.

**Payload**: frame penuh 640×480 (~40 KB) per frame, 3–6 frame. Alternatif yang
ditolak untuk v1: crop 112×112 di kiosk (menghemat ~8× bandwidth tetapi
mengharuskan model deteksi berjalan di APK). Tidak sepadan untuk jaringan LAN.

## 5. Data model

```sql
tbl_face_templates
  _id, user_id → tbl_users, employee_id, face_group,
  embedding bytea        -- AES-GCM, kunci hanya di face service
  model_version          -- 'sface-2021dec'
  quality, created_at
  unique (employee_id, model_version)

tbl_face_verify_log
  device_id, employee_id, face_group, result,
  score, margin, liveness, frame_count, created_at
```

Foto tidak pernah disimpan. Enrollment membaca foto, menghitung embedding, lalu
membuang fotonya.

`model_version` wajib: embedding dari model berbeda tidak kompatibel, jadi ganti
model = enrollment ulang semua orang.

## 6. Galeri dan aturan pengelompokan

### Cara mendaftarkan wajah tanpa bergantung pada ZK

ZKBioTime hanya dipakai **sekali** untuk bootstrap 233 karyawan yang sudah ada.
Setelah itu karyawan baru didaftarkan lewat jalur kita sendiri:

| Jalur | Siapa yang memulai | Bukti identitas | Catatan |
|---|---|---|---|
| **A. Self-enroll di kiosk** | karyawan | tap kartu lebih dulu | paling praktis; kamera kiosk sudah ada |
| **B. Admin lewat CMS** | admin/HR | sesi admin | untuk karyawan tanpa kartu |
| **C. Batch CSV** | admin | sesi admin | migrasi awal / data HR |

Aturan yang tidak boleh dilanggar: **enrollment selalu didahului bukti
kepemilikan akun**. Kalau wajah bisa didaftarkan tanpa bukti, siapa pun bisa
mendaftarkan wajahnya ke akun orang lain — itu pengambilalihan akun, bukan
sekadar salah data.

Karena itu:

- `POST /enroll` hanya dipanggil app_booking, bukan kiosk langsung, dan butuh
  header `X-Face-Token`.
- Jalur A: kiosk tap kartu → app_booking verifikasi kartu → baru panggil enroll.
- Jalur B/C: butuh sesi admin di CMS.
- Re-enroll menimpa template lama (`upsert`), jadi tidak menumpuk.

Kualitas dijaga di gerbang masuk: minimal 2 frame, deteksi ≥0,6, yaw ≤0,35, dan
antar-frame harus konsisten (agreement ≥0,5) supaya frame tidak bisa ditukar di
tengah pengambilan.

| | Jumlah |
|---|---|
| Foto BioTime tersedia | 269 |
| Foto tanpa `employee_id` di UAT (ID lama) | 34 |
| Akun aktif UAT yang punya foto | **233 template** |
| Orang yang diwakili | 232 (Robert punya dua akun) |

Aturan:

- Kunci selalu `employee_id` UAT, bukan nama file foto dan **bukan nama orang**
  (ada dua orang berbeda bernama Gunawan).
- `face_group` hanya diisi untuk akun yang memang satu orang. Saat ini hanya
  Robert (`90187` + `101240028`).
- Zulfakhor: template hanya untuk `90205` (yang punya kartu). `90338` tidak
  diberi template dan tidak punya kartu, jadi akun itu tidak bisa autentikasi
  sampai diberi kartu atau dihapus.
- Akun ruangan (11) dan akun sistem (`ADMIN-001`, `EMP-*`, `UAT-*`) tidak
  masuk galeri.

Karyawan tanpa foto **dan** tanpa kartu: Sutardi (`033-12.06`), Rusminah
(`90007`), Surya K P Kelana (`ISM0023`) — perlu diberikan salah satu.

## 7. Ambang dan dasar pengukurannya

Diukur pada 269 foto BioTime, 36.031 pasangan orang berbeda. Untuk tiap orang
dihitung skor tertinggi terhadap orang lain (itu yang menentukan false accept di
1:N):

| Ambang | Orang yang punya "kembaran" di atas ambang |
|---|---|
| 0,363 (default SFace) | 81,6% |
| 0,50 | 9,0% |
| 0,55 | 3,1% |
| **0,60 (dipakai)** | **1,6%** |
| 0,65 | 0,0% |

Ambang 0,363 aman untuk 1:1 tetapi tidak layak untuk 1:N: dengan 233 template,
hampir setiap orang punya orang lain yang lolos.

**Margin 0,05**: juara pertama harus unggul minimal 0,05 dari orang lain
terdekat. Ambang tunggal tidak bisa memisahkan dua wajah yang mirip.

**Skor asli yang terukur** (satu orang, kamera laptop):

| Kondisi | Cosine |
|---|---|
| Tanpa masker | 0,727 / 0,724 / 0,754 |
| Pakai masker (menutup hidung–dagu) | 0,719 |
| Orang lain terdekat | 0,370 |

Margin antara asli dan impostor ≈ 0,35 — lebar.

Ambang 0,60 masih perlu dikalibrasi ulang dengan tangkapan kamera kiosk dari
20–30 karyawan (kacamata, cahaya koridor, foto lama).

## 8. Keamanan

### Foto: apa yang disimpan di mana

| Lokasi | Isi | Enkripsi |
|---|---|---|
| Server ZKBioTime (`C:\ZKBioTime\auth_files\biophoto`) | foto karyawan asli | `eav101$` AES-CBC, **kunci fallback bawaan vendor** |
| face service (PostgreSQL) | **tidak ada foto**, hanya embedding | AES-GCM, kunci di env service |
| app_booking | tidak ada foto sama sekali | — |
| kiosk | frame di memori, dikirim lalu dilepas | — |
| `tbl_face_verify_log` | skor dan hasil, bukan gambar | — |
| Foto sementara saat enrollment | JPEG polos (jika pakai mode file) | **tidak** — lihat catatan |

Foto sumber tidak benar-benar rahasia: kunci `IMAGE_AES_PASSWORD` adalah nilai
fallback di `site_settings.py` vendor, sama untuk semua instalasi. Karena itu
foto tidak disalin ke sistem kita; yang disimpan hanya embedding.

**Titik lemah yang tersisa:** mode enrollment bawaan membaca JPEG polos dari
disk. Untuk menghindarinya, pakai `--zk-source` + `--zk-key` sehingga dekripsi
terjadi di memori dan tidak ada JPEG polos yang pernah ditulis.

Frame kamera tidak pernah ditulis ke disk atau ke access log; yang tercatat
hanya jumlah frame, skor, dan hasil.

| Aspek | Keadaan |
|---|---|
| Liveness | **belum ada** — response selalu `"liveness": null`, `/health` menyatakan `liveness_required: false` |
| Faktor | wajah saja (kartu = cadangan, bukan faktor kedua) |
| Embedding at rest | AES-GCM, kunci hanya di face service |
| Foto | tidak disimpan |
| Audit | `tbl_face_verify_log` untuk setiap percobaan |
| Identitas | tidak boleh "pilih nama sendiri" saat gagal — harus ke kartu |

Tanpa kartu, wajah adalah satu-satunya faktor. Foto cetak/layar HP bisa lolos
sampai liveness pasif (MiniFASNet, Apache-2.0, ~3,4 MB) terpasang dan **diuji
dengan serangan nyata** di kamera kiosk.

Rencana liveness: tiga lapis — skor model per frame, gerak mikro antar frame,
konsistensi identitas antar frame.

## 9. Deployment

Service baru di compose, tanpa port publik:

```yaml
face:
  build: ../app_faceunlock-service
  environment:
    FACE_DB_DSN: postgresql://booking@db/360booking
    FACE_EMBEDDING_KEY: ${FACE_EMBEDDING_KEY}
  volumes:
    - ../app_faceunlock-service/models:/app/models:ro
  depends_on: [db]
  restart: unless-stopped
```

Model diunduh di server dengan `./fetch-models.sh` (checksum diverifikasi),
tidak dibawa di image. Kunci dibuat di server UAT dengan `openssl rand -base64
32` — **tidak** boleh sama dengan kunci AES BioTime.

## 10. Status dan urutan pekerjaan

| Slice | Isi | Status |
|---|---|---|
| 1 | tabel, engine, enrollment CLI, `/enroll`, `/identify`, `/verify`, selfcheck | **selesai** |
| 2 | enrollment 233 template di UAT + kunci produksi | belum |
| 3 | liveness pasif + uji serangan foto | belum |
| 4 | endpoint kiosk di app_booking + integrasi APK | belum (sengaja ditunda) |
| 5 | kalibrasi ambang dengan 20–30 karyawan | belum |

## 11. Bukti pengujian slice 1

Selfcheck pada 269 foto asli:

```
1. genuine -> match score=0.7192 group=90211
2. teratas -> 90211=0.7192, 90026=0.3697, 90206=0.3463
3. group   -> match score=0.9668 group=robert-hall
SEMUA CEK LULUS
```

End-to-end lewat HTTP (Postgres, 5 template):

| Uji | Hasil |
|---|---|
| identify wajah sendiri (bermasker) | `match` 0,7192 |
| identify Robert | `match` 1,0 — 2 kandidat, 1 grup |
| verify 90211 dengan wajah orang lain | `no_match` 0,3227 |
| verify 90211 dengan wajah sendiri | `match` 0,7192 |

## 12. Hubungan dengan REA ZKFaceCapOnline

REA tidak dipakai sebagai komponen, tetapi memberi tiga hal:

1. **Sumber foto dan kunci.** Foto BioTime `eav101$` di
   `C:\ZKBioTime\auth_files\biophoto`, AES-CBC dengan kunci yang ternyata
   **fallback bawaan vendor** (`IMAGE_AES_PASSWORD` di
   `site_settings.py`) — artinya foto itu tidak rahasia dari siapa pun yang
   punya akses server. Ini justru memperkuat keputusan menyimpan embedding saja.
2. **Opsi B bila suatu saat butuh perangkat ZKTeco.** Protokol capture
   ZKFaceCapOnline (WebSocket, `common`/`getimage`, `jpgbase64`) sudah
   terdokumentasi, jadi kiosk bisa memakai terminal ZK tanpa membangun ulang
   jalur kamera.
3. **Rekomendasi ops.** Service ZK tidak punya autentikasi dan mengirim private
   key TLS di folder instalasi; port 29060/29061 sebaiknya dibatasi ke jaringan
   lokal dan tidak diekspos.

## 13. Risiko yang masih terbuka

- Belum ada liveness → **jangan diaktifkan di produksi**.
- Ambang 0,60 berasal dari 1 orang + 233 foto lama.
- Embedding terikat satu model; penggantian model = enrollment ulang.
- 3 karyawan tanpa foto dan tanpa kartu tidak bisa autentikasi.
- Retensi dan persetujuan data biometrik belum ditetapkan.
- Lisensi model: YuNet MIT, SFace Apache-2.0 — sertakan notice saat distribusi.
