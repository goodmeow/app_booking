# Tablet integration notes

> **Status 2026-10-21.** Bagian "Phase 10A" di bawah menjelaskan *perangkat
> lunak rekonstruksi* di repo ini. Perilaku tablet yang benar-benar dikirim
> (APK `com.bjb`) sudah dibuktikan terbalik dan **berbeda** dari model WebView
> yang dulu diasumsikan — lihat §3–§8. Sumber bukti ada di repo sebelah:
> `nauchara/hardware/KIOSK-APK-ANALYSIS.md`, `LED-CODES.md`, `DOOR-RELAY.md`,
> dan `LIVE-UI-TEST.md`.

## Current Phase 10A software

- `/kiosk/setup` provisions a named tablet with active room credentials; `/kiosk` resumes its stored assignment.
- `POST /api/kiosk/auth` creates an inventory record and returns a 15-minute room/device-bound access token plus a rotating opaque refresh credential.
- `POST /api/kiosk/refresh` rotates the refresh credential and token version. A lost-response retry returns the same successor for 30 seconds; credentials outside that bounded grace or from revoked devices fail.
- `DELETE /api/kiosk/device` removes the current pairing. Administrators list/revoke devices through `/api/kiosk/devices`.
- Room password reset or room deletion revokes every paired device. Active device sockets are disconnected immediately.
- Administrators can enable NFC and LED indicators independently for each active kiosk. Both default off; changes are pushed to the selected device only.
- Kiosk HTTP and Socket.io access is bound to immutable room/device UUIDs. Event invalidations target affected user/room channels only.
- Display states are `AVAILABLE`, `UPCOMING`, `OCCUPIED`, and fail-safe `UNKNOWN`. Active bookings become red without check-in.
- NFC and LED labels appear only when enabled for that kiosk. Native bridge calls, check-in, and early-finish controls remain deferred design, not active behavior.

**Divergence:** tidak ada endpoint `/api/kiosk/*`, inventaris perangkat, token
rotasi, atau socket terautentikasi di server asli. APK asli memakai
`POST /api/auth/signin` dengan kredensial ruangan, lalu token JWT biasa di
AsyncStorage. Phase 10A adalah penguatan desain, bukan paritas.

## Confirmed hardware

- RGB tablet based on RK3288, 10-inch display, Android 8.1 (SDK 27), `armeabi-v7a`.
- Resolution: **1280×800** (terkonfirmasi dari `screencap`).
- NFC controller: NXP PN7150, 13.56 MHz, NCI over I2C.
- RGB frame exposed through `/sys/devices/platform/led_con_h/zigbee_reset`.
- Relay: **CH340-based LCUS-1 USB relay** (vendorId `0x1a86`), 9600 8N1.

Evidence: private tablet references `182897-spesifikasi-tablet.pdf`,
`NFC Specs.zip`, `Led.kt`, and `led_AllAround.zip`. Original material stays
under ignored `docs/reference/private/`. Device-level evidence lives in
`nauchara/hardware/`.

## Runtime boundary — React Native, not WebView

The shipped APK is a **React Native** app (`assets/index.android.bundle`),
not a WebView shell:

- package `com.bjb`, label "360Booking";
- permissions: `INTERNET`, `ACCESS_NETWORK_STATE`, `NFC`, `CAMERA`, `VIBRATE`;
- **no** `addJavascriptInterface`, no `window.Android`, no `WebViewClient`;
- native modules: `LedModule` (sysfs via root shell), `NativeSerial`
  (USB serial), `community.revteltech.nfc` (`NfcManager`), MLKit barcode
  (camera present, not used in the door flow).

The earlier "WebView + JavaScript bridge" model in this document was a
reconstruction hypothesis and is **superseded**.

```text
React Native JS (index.android.bundle)
  |-- root-shell  -> echo w 0xNN > /sys/devices/platform/led_con_h/zigbee_reset
  |-- NativeSerial -> USB CH340 -> relay A00101A2 / A00100A1
  `-- NfcManager  -> PN7150 -> tag.id (hex UID)
```

## Native module contract (recovered, not proposed)

| Capability | Mechanism | Notes |
|---|---|---|
| Set LED | `su -c "echo w 0xNN > …/zigbee_reset"` | one byte, root required |
| Read NFC | `Nfc.requestTechnology(Nfc.Ndef)` → `getTag().id` | hex UID string |
| Open/close door | `writeHexString('A00101A2')` / `('A00100A1')` | close after 15 s |
| HTTP | `fetch` + `Authorization: Bearer <token>` | base URL from AsyncStorage |
| Config | `AsyncStorage`: `@ipServer`, `@tokenRoom`, `@tokenRoomMaster`, `@room` | plaintext (unencrypted) |
| Reconfigure | long-press logo → "Change Room or Server ?" → room login | no MDM, no kiosk lock |

## LED behavior (verified on device)

Command shape:

```bash
su
echo w 0xCODE > sys/devices/platform/led_con_h/zigbee_reset
```

All 24 codes `0x00`–`0x17` were written to the sysfs node on the spare tablet
and echoed back by the kernel driver (`dmesg`). Codes used by the kiosk flow:

| Code | Meaning | Use |
|---|---|---|
| `0x03` | on (frame power) | once at mount |
| `0x04` | red | meeting in progress **and** checked in |
| `0x05` | green | available / no active meeting |
| `0x14` | yellow / "green yellow" | meeting inside window, **not** checked in |

The app maps UI colours `#44865a` / `#C70039` / `#cccc00` to `0x05` / `0x04` /
`0x14`. `0x0e` (violet) exists only in the native demo method
`LedModule.displayLED()`; it is not used by production states. Effect codes
(`0x0b`, `0x0f`, `0x13`, `0x17`) are inherently non-deterministic snapshots.
Full table + verification: `nauchara/hardware/LED-CODES.md`.

## NFC → door / check-in flow (verified)

```js
tag = await Nfc.getTag();
id  = tag.id;                        // e.g. "04A1B2C3D4E5F6"
b   = id.slice(0, 8)                 // first 4 bytes
        .match(/.{1,2}/g)
        .reverse()
        .join("");
card_number = parseInt(b, 16);       // decimal integer, not string
```

Only the **first 4 bytes, reversed, as a decimal integer** are sent. Two
request variants exist:

| Variant | Request | Body |
|---|---|---|
| open door | `POST /api/door-open` | `{ card_number }` |
| meeting check-in | `PUT /api/events/check-in` | `{ event_id, card_number }` |

After a `200` the tablet drives the relay itself:

```js
writeHexString("A00101A2");   // open
// after 15 s
writeHexString("A00100A1");   // close
```

The server only validates the card (`card_master_validation` →
`tbl_card_masters`); the relay is never reached over the network.

**Failure handling:** dead code. The API helper throws `await res.json()`
(an object, not a `Response`), so `e.response` is always `undefined` and the
error alert never fires. All HTTP failures are silent
(`nauchara/hardware/LIVE-UI-TEST.md §4.5`).

## Display state machine (verified)

States are computed from **today's** events whose `start <= now`:

| Condition | Screen | LED |
|---|---|---|
| no event today / next event later | green, "Available" + next meeting | `0x05` |
| meeting active, not checked in | yellow | `0x14` |
| meeting active, checked in | red | `0x04` |

With two events (one active + one later) the active one wins. Startup always
writes `0x05` first, then the real state ~5 s later once `GET /api/events`
returns.

**Offline defect:** if the server is unreachable the app logs
`ERROR GET DATA HOME` but still shows green "Available" and writes `0x05` —
there is no offline indicator and Check-In stays visible.

## Configuration & provisioning

- First run / empty `@ipServer`: login form with IP Server + Email + Password.
- With a stored server: long-press the logo (~3 s) → dialog
  **"Change Room or Server ?"** (`CANCEL` / `SERVER` / `ROOM`) → room
  autocomplete + password → `Submit`.
- Room list comes from unauthenticated `GET /api/rooms`; token from
  `POST /api/auth/signin`.
- **No autostart**, no MDM, not a system app, no kiosk lock. Update is manual
  (sideload). See `nauchara/hardware/PROVISIONING.md`.

## Security observations

- Room JWT and server URL live in plaintext AsyncStorage; root access to the
  tablet exposes them.
- The relay frame is unauthenticated: anything that can open the serial device
  can open the door.
- LED/root shell accepts arbitrary `echo` strings from the JS layer; a
  compromised bundle has root.
- Socket.io in the original server accepts connections without a token and
  allows arbitrary `room:join` — see `nauchara/CORE-SERVICE.md §11`.
- Do not expose generic shell execution to untrusted JavaScript. If the
  reconstruction adds a bridge, restrict it to known LED codes.

## Missing evidence

- ~~Original 360Booking APK.~~ **Found** — vendor left the installer in
  internal storage; artefact + analysis in
  `nauchara/hardware/tablet-apks/360Booking.apk` and
  `nauchara/hardware/KIOSK-APK-ANALYSIS.md`.
- ~~APK package name, manifest, permissions, and WebView configuration.~~
  **Resolved** — `com.bjb`, React Native, no WebView; permissions
  INTERNET/ACCESS_NETWORK_STATE/NFC/CAMERA/VIBRATE.
- ~~Legacy JavaScript bridge names and payload format.~~ **Resolved** — no
  JavaScript bridge at all; native modules and payload documented in §4–§6.
- PN7150 reader sample: the app uses `community.revteltech.nfc`, not a vendor
  sample. Exact firmware/NCI details remain vendor-side.
- Physical relay verification (USB enumeration, polarity, permissions after
  reboot) — blocked until a CH340 module is available
  (`nauchara/hardware/DOOR-RELAY.md §8`).
