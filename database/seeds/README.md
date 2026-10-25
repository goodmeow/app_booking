# Seeds

Seeds must contain dummy identities, emails, card numbers, room names, and events only. Never derive seed values from private operational references.

Planned minimum fixture:

- Admin and user roles.
- One admin and one regular user.
- Three rooms.
- Default app settings.
- Dummy card master.
- Available, upcoming, and checked-in event examples.

`development.sql` currently provides deterministic roles, two employees, three rooms, settings, one master card, and one future meeting. All identities use reserved `.test` addresses and synthetic card identifiers.

Local demo credentials are deterministic: employee accounts use `ParityTest123!` and room accounts use `RoomTablet123!`. These credentials are for disposable development/test databases only.
