# Runbook deploy — Ubuntu Server 22.04

Target: satu host Ubuntu, PostgreSQL + nginx di situ, aplikasi RoomBooking
dijalankan lewat systemd. Tablet kiosk dan CMS mengakses host ini lewat satu
origin nginx (HTTP :80 atau HTTPS :443).

## Satu perintah (IP + HTTP + port 80)

Di Ubuntu kosong, setelah clone repo:

```bash
sudo ./deploy/bootstrap.sh
```

Script akan:
1. install Node/PostgreSQL/ufw (+ nginx, kecuali `--no-nginx`),
2. generate password DB + `JWT_SECRET`,
3. menulis `/etc/360booking/app.env` (runtime) + `provision.env` (root-only),
4. membuat DB + migrasi + role,
5. build client/server,
6. install systemd (+ nginx, kecuali `--no-nginx`),
7. mencetak URL `/setup`.

Opsi: `--ip ADDRESS`, `--port PORT`, `--build-user USER`, `--no-nginx`,
`--bind-host ADDRESS`, `--origin URL`, `--proxy-ip ADDRESS`, `--force`.
Admin pertama tetap dibuat lewat halaman `/setup`.

### Tanpa nginx di app server

Kalau nginx sudah ada di server lain:

```bash
sudo ./deploy/bootstrap.sh \
  --no-nginx \
  --proxy-ip 192.0.2.10 \
  --origin http://roombooking.lan
```

`--origin` dan `--proxy-ip` **wajib** untuk mode ini. API listen di
`0.0.0.0:9091`; `--proxy-ip` membuka port 9091 hanya untuk nginx eksternal.
Copy `build/client/` ke root nginx, lalu proxy `/api/` dan `/socket.io/` ke
app server port 9091. `--bind-host 127.0.0.1` ditolak karena tidak bisa
diakses dari mesin nginx. Jika nginx lokal masih aktif, hentikan dulu.

## Urutan manual

```bash
sudo ./deploy/01-install-prerequisites.sh
sudo install -d -m 0750 /etc/360booking
sudo cp deploy/app.env.example /etc/360booking/app.env
sudo cp deploy/provision.env.example /etc/360booking/provision.env
sudo chown root:root /etc/360booking/app.env /etc/360booking/provision.env
sudo chmod 600 /etc/360booking/app.env /etc/360booking/provision.env
sudo nano /etc/360booking/app.env
sudo nano /etc/360booking/provision.env
sudo ./deploy/02-provision-database.sh
./deploy/03-build.sh
sudo ./deploy/04-install-app.sh
# lalu buka http://<ip>/setup (05-create-admin opsional)
```

Lo script 03 boleh dijalankan di mesin lokal lalu hasil `build/` dikirim
ke server; 04 mengasumsikan `build/`, `package.json`, dan `package-lock.json`
sudah ada di direktori repo di host target.

## Topologi

| Komponen | Cara dijalankan | Port |
|---|---|---|
| Statik CMS (`build/client`) | nginx `root` + fallback SPA | 80/443 |
| API + Socket.io (`build/server`) | systemd `360booking-server.service` | 127.0.0.1:9091 |
| PostgreSQL | paket distro `postgresql` | 127.0.0.1:5432 |
| Tablet kiosk | provisioning: ketik `https://<host>/` | outbound saja |

Semua lalu lintas tablet murni *outbound* dari tablet; server men-push
update realtime lewat koneksi socket.io yang dibukanya, jadi firewall hanya
butuh inbound 22/80/443 ke server.

## HTTPS

Aktifkan dua-duanya bila memakai TLS di nginx:

- `TRUST_PROXY=true` di `app.env` (parsing `X-Forwarded-*`).
- `CORS_ORIGINS=https://<domain>` (tanpa wildcard).

Atau bila tanpa reverse proxy, set `HTTPS=true` + `TLS_CERT_PATH` +
`TLS_KEY_PATH` di `app.env` dan buka port 9091 di ufw.

## Tablet kiosk di jaringan produksi

1. Settings → Ethernet → IP statis (alamat router/gateway sekantor).
2. Layar provisioning tablet: ketik server, mis. `https://scheduler.contoh.id`.
3. Bila server memakai sertifikat self-signed/CA internal: install CA-nya ke
   Settings tablet (dipercaya lewat anchor `user`), lalu klik ulang pasangan.

Baca juga `.env.example` untuk komentar tiap variabel.
