# Reconstruction References

## Directories

- `private/`: original operational material. Ignored by Git.
- `sanitized/`: redacted copies safe to commit and share.

Never move credentials or unredacted infrastructure material into `sanitized/`.

## Sanitization checklist

Remove or mask:

- Passwords, tokens, cookies, and secret keys.
- Internal URLs, hostnames, and IP addresses.
- Real names and email addresses.
- Card, badge, and device identifiers.
- Network topology details and switch ports.
- Metadata identifying document authors when unnecessary.

Keep UI layout, field names, workflow order, generic room labels, device model,
screen resolution, colors, and expected behavior.

## Recommended names

```text
sanitized/tablet-hardware-manual.pdf
sanitized/operations-and-ui-guide.pdf
sanitized/screenshots/auth-signin.png
sanitized/screenshots/calendar-week-admin.png
sanitized/screenshots/tablet-available.png
sanitized/screenshots/tablet-check-in.png
sanitized/screenshots/tablet-occupied.png
```
