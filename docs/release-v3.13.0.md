# Rilis v3.13.0 — Ver 3 Rev 14

Tanggal: 2026-10-30. APK kiosk tetap **1.4.5 (26)**.

## Ringkasan

- Revamp UI CMS ke Ant Design 5, light/dark theme, kalender/agenda, users,
  rooms/devices, settings, branding, role matrix, audit, report, dan web kiosk.
- Hardening: proteksi super admin, validasi ID/payload, detail lantai khusus
  resepsionis, kartu lost, storage browser, refresh kiosk, backup advisory
  lock, audit retention, dan migrasi 026 timezone.
- Purge dependency/config/locale tidak terpakai (`body-parser`, `react-router`,
  `terser`, `terser-webpack-plugin`, config mati, locale mati).

## Verifikasi

- Client 99/99
- Server unit 85/85
- Regression 105/105
- Parity prepare 2/2, parity 8/8
- Build client/server lulus, lint 0 error

## Deploy dan database

- Migrasi terakhir: `026_event_room_timezone.sql`.
- UAT local test bed dan UAT live memakai tag `v3.13.0`; app/web/db sehat.
- Tidak ada perubahan database lain setelah migrasi 026.

## Catatan

- Tag CMS: `v3.13.0`.
- APK kiosk tetap 1.4.5 (26); signing key tidak diubah pada rilis ini.
