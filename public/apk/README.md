# APK kios untuk tablet

File `kiosk-release.apk` dari folder public bawaan Vite (repo root)
ikut ke build/client dan dilayani CMS/nginx di:

```
/apk/kiosk-release.apk
```

Cara pembaruan:

1. Build release di repo `kioskapp`
   (android/gradlew assembleRelease), lalu salin
   `android/app/build/outputs/apk/release/app-release.apk` ke file ini.
2. Jalankan `npm run build` agar salinan di `build/client/` ikut.

Riwayat isi paket:

- 2026-10-23: pertama masuk paket, termasuk jam sinkron server (`serverTime`),
  panel kiri baru, dan `network_security_config.xml` (HTTP LAN + HTTPS siap).

- 2026-10-23: naik ke 1.1 (versionCode 2), tablet menampilkan versi + UUID
  perangkat di layar; CMS drawer menampilkan versi CMS dari package.json.
