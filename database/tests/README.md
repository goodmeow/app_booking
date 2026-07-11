# Database behavior tests

Planned coverage:

- Clean schema creation and constraints.
- User creation, detail, update, password, and soft-delete behavior.
- Room availability and usage report.
- Event creation collision checks.
- Attendee add/delete behavior.
- NFC card check-in.
- Early finish.
- App settings and card-master operations.
- Transaction rollback on invalid operations.

Current automated checks:

- `001_schema_smoke.sql`: object counts.
- `002_core_behavior.sql`: settings, employee/room listing, card validation, check-in, early finish, and organizer cancellation.
- `003_function_contracts.sql`: all 28 signatures, active-path reads/mutations, and known-defect assertions.
