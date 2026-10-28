# Face service

Verifikasi wajah untuk kiosk booking ruangan. Proses terpisah dari app_booking.

```
kiosk  --frames-->  app_booking  --frames-->  face service  --cosine-->  PostgreSQL
                        |                          |                      (embedding
                     keputusan                 models ONNX                terenkripsi)
```

Service ini **hanya** menjawab "ini wajah siapa" dan "skor kecocokannya berapa".
Aturan booking (siapa boleh masuk ruangan mana) tetap di app_booking, karena
service ini tidak membaca tabel event sama sekali.

## Status

| Bagian | Status |
|---|---|
| Deteksi + embedding (YuNet + SFace) | selesai, diuji pada 269 foto asli |
| Pencocokan 1:N + ambang + margin | selesai |
| Grup wajah (satu orang, dua akun) | selesai |
| Simpan template terenkripsi | selesai |
| Endpoint `/identify`, `/verify`, `/enroll`, `/health` | selesai |
| **Liveness (anti-spoof)** | **belum** — lihat bagian Batasan |
| Integrasi ke app_booking & kiosk | belum, sengaja ditunda |

## Model

| Model | Berkas | Lisensi |
|---|---|---|
| YuNet (deteksi) | `yunet.onnx` (227 KB) | MIT |
| SFace (embedding) | `sface.onnx` (37 MB) | Apache-2.0 |

```sh
./fetch-models.sh          # unduh + verifikasi checksum ke ./models
```

Sertakan berkas lisensi kedua model saat men-deploy (kewajiban MIT dan Apache-2.0).

## Variabel lingkungan

| Variabel | Wajib | Keterangan |
|---|---|---|
| `FACE_DB_DSN` | ya | koneksi Postgres, mis. `postgresql://booking@db/360booking` |
| `FACE_EMBEDDING_KEY` | ya | base64 32 byte; kunci AES-GCM untuk kolom `embedding` |
| `FACE_MATCH_THRESHOLD` | tidak | default `0.60` |
| `FACE_MATCH_MARGIN` | tidak | default `0.05` |
| `FACE_YUNET_PATH`, `FACE_SFACE_PATH` | tidak | default `models/*.onnx` |

Buat kunci:

```sh
openssl rand -base64 32
```

Kunci ini **tidak** boleh sama dengan kunci AES BioTime (`IMAGE_AES_PASSWORD`),
dan tidak boleh ikut ke git.

## Enrollment

Input CSV: `employee_id,photo,face_group`

```csv
employee_id,photo,face_group
90211,/srv/photos/90211.jpg,
90187,/srv/photos/90187.jpg,robert-hall
101240028,/srv/photos/101240028.jpg,robert-hall
```

`face_group` kosong = memakai `employee_id`. Isi kolom itu **hanya** kalau dua
akun memang orang yang sama. Jangan mengelompokkan berdasarkan nama — dua orang
berbeda bisa bernama sama.

```sh
python enroll.py --csv mapping.csv --dsn "$FACE_DB_DSN"
python enroll.py --csv mapping.csv --dry-run      # cek kualitas foto saja
```

Alternatif yang lebih aman: baca langsung dari foto BioTime terenkripsi, tanpa
pernah menulis JPEG polos ke disk.

```sh
python enroll.py --csv mapping.csv \
  --zk-source /mnt/biophoto --zk-key "$IMAGE_AES_PASSWORD"
```

Dengan `--zk-source`, kolom `photo` di CSV boleh dikosongkan; berkas diambil
dari `<folder>/<employee_id>.jpg` dan didekripsi di memori (AES-CBC, PKCS7,
format `eav101$`).

Foto tidak disimpan. Yang masuk database hanya embedding terenkripsi.
Setelah enrollment, panggil `POST /reload` agar service memuat template baru.

## API

**GET /health**

```json
{"ok": true, "model_version": "sface-2021dec", "templates": 233,
 "threshold": 0.6, "margin": 0.05, "liveness_required": false}
```

**POST /identify**

```json
{"device_id": "lt5mr3", "frames": ["<base64 jpeg>", "..."]}
```

```json
{"result": "match", "score": 0.7192, "margin": 0.3495,
 "face_group": "90211",
 "candidates": [{"employee_id": "90211", "score": 0.7192}],
 "liveness": null,
 "frame_quality": {"detection_score": 0.91, "yaw": 0.14, "frames_with_face": 6}}
```

`result`: `match` | `no_match` | `ambiguous` | `no_face`.

Kalau `candidates` berisi lebih dari satu akun, semuanya orang yang sama
(face_group sama) — app_booking yang memilih akun mana berdasarkan data booking.

**POST /verify**

```json
{"employee_id": "90211", "frames": ["<base64 jpeg>"]}
```

Dipakai setelah tap kartu, saat identitas sudah diketahui.

**POST /enroll** — internal, butuh header `X-Face-Token`

```json
{"employee_id": "90211", "frames": ["<base64 jpeg>", "..."]}
```

```json
{"ok": true, "employee_id": "90211", "quality": 0.957,
 "yaw": 0.006, "agreement": 0.719, "frames": 2, "templates": 1}
```

Minimal 2 frame. Ditolak (`422`) kalau deteksi lemah (<0,6), kepala menoleh
(yaw >0,35), atau frame tidak konsisten (agreement <0,5 — indikasi frame ditukar
di tengah burst). Ditolak (`404`) kalau `employee_id` tidak ada di `tbl_users`.
`401` kalau token tidak cocok.

Endpoint ini mengubah siapa yang bisa login sebagai siapa, jadi **hanya boleh
dipanggil app_booking** setelah identitas pemilik akun terbukti. Jangan
mengeksposnya ke kiosk langsung.

## Ambang: dari mana angka 0,60

Diukur pada 269 foto BioTime (255 orang unik setelah akun duplikat digabung).
Untuk setiap orang dihitung skor tertinggi terhadap orang lain:

| Ambang | Orang yang punya "kembaran" di atas ambang |
|---|---|
| 0,363 (default SFace) | 81,6% |
| 0,50 | 9,0% |
| 0,55 | 3,1% |
| **0,60** | **1,6%** |
| 0,65 | 0,0% |

0,60 dipilih karena menyisakan ruang untuk variasi nyata (kacamata, foto lama)
tanpa membuka false accept selebar 3%. Margin 0,05 menangani dua orang yang
skornya berdekatan, yang tidak bisa diselesaikan oleh ambang tunggal.

Angka ini masih perlu dikalibrasi ulang dengan tangkapan kamera kiosk dari
20–30 karyawan.

## Batasan

- **Belum ada liveness.** Tanpa kartu, wajah adalah satu-satunya faktor, jadi
  layar HP atau foto cetak bisa lolos. Jangan aktifkan face-unlock di produksi
  sebelum liveness pasif (MiniFASNet, Apache-2.0) terpasang dan diuji.
- Embedding terikat ke `model_version`. Ganti model = enrollment ulang semua.
- Galeri 233 template hanya mencakup karyawan yang punya foto BioTime.

## Menjalankan

```sh
pip install -r requirements.txt
./fetch-models.sh
export FACE_DB_DSN=postgresql://booking@127.0.0.1:54320/360booking_reconstruction_test
export FACE_EMBEDDING_KEY=$(openssl rand -base64 32)
uvicorn app:app --port 8090
```

Uji cepat tanpa database:

```sh
FACE_SELFCHECK_GALLERY=/path/foto \
FACE_SELFCHECK_PROBE=/path/tangkapan.jpg \
python selfcheck.py
```
