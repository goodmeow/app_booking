# Tablet integration notes

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

Current web bundle contains no confirmed `addJavascriptInterface`, `window.Android`, NFC, LED, check-in, early-finish, or door-open integration. Tablet capability therefore belongs to a separate APK/native layer or missing tablet-specific client.

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
