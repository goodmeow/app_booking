# Tablet integration notes

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

## Confirmed hardware

- RGB tablet based on RK3288, 10-inch display, Android APK client.
- Likely display resolution: 1280x800.
- NFC controller: NXP PN7150, 13.56 MHz, Android/Linux support through NCI over I2C.
- RGB frame exposed through `/sys/devices/platform/led_con_h/zigbee_reset`.

Evidence: private tablet references `182897-spesifikasi-tablet.pdf`, `NFC Specs.zip`, `Led.kt`, and `led_AllAround.zip`. Original material stays under ignored `docs/reference/private/`.

## WebView boundary

Web content cannot directly access NFC hardware, root shell, or sysfs. APK must provide a narrow native JavaScript bridge:

```text
React WebView client
  | JavaScript bridge
Android Kotlin/Java wrapper
  |-- LED sysfs adapter
  `-- Android NFC/NCI adapter
```

Current source contains no active `addJavascriptInterface`, `window.Android`, NFC, LED, or door-open integration. Tablet hardware capability belongs to a later APK/native layer.

## Proposed bridge contract

Native methods exposed to web:

```text
Tablet.setLed(code)
Tablet.startNfcScan()
Tablet.cancelNfcScan()
Tablet.getDeviceInfo()
```

Native events delivered to web:

```text
tablet:nfc          { cardNumber }
tablet:nfc-error    { code, message }
tablet:led-error    { code, message }
tablet:ready        { deviceId, roomEmail, capabilities }
```

Exact names are reconstruction proposals, not recovered legacy contracts.

## LED behavior

Recovered command shape:

```bash
echo 'w 0xCODE' > /sys/devices/platform/led_con_h/zigbee_reset
```

Known codes:

- `02`: off
- `03`: on
- `04`: red
- `05`: green
- `06`: blue
- `08`: orange
- `09`: cyan
- `13`: color fade
- `17`: RGB roll

Observed application states:

- Green: room available.
- Yellow/orange: meeting approaching or check-in allowed.
- Red: meeting checked in/room occupied.

## NFC flow

Expected flow from operational screenshots:

1. Web UI displays upcoming meeting.
2. User presses check-in.
3. APK starts NFC reader and web UI displays `Please tap your card`.
4. APK reads card identifier and sends it to web client.
5. Web client calls `PUT /api/events/check-in` with event/card data.
6. Server validates through `events_checkin` and emits event update.
7. Tablet changes LED/state based on updated meeting status.

Exact PN7150 Android API remains unknown. Datasheet proves hardware capability, not application-level integration.

## Security requirements

- Never expose generic shell execution such as `runCommand(command)` to JavaScript.
- `setLed` must accept only known codes.
- Allow bridge calls only from trusted, allowlisted application origins.
- Disable arbitrary navigation, file access, and WebView debugging in production.
- Do not inject card identifiers into JavaScript source without safe serialization.
- Authenticate API and Socket.io sessions before NFC/check-in operations.
- Avoid changing sysfs permissions globally; prefer vendor service, signed system app, or narrowly scoped privileged helper.

## Missing evidence

- Original 360Booking APK.
- APK package name, manifest, permissions, and WebView configuration.
- Legacy JavaScript bridge names and payload format.
- PN7150 Android reader sample used by deployed tablet.
- Device provisioning, kiosk/autostart, room identity, and update mechanism.
