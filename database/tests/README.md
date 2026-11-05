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

The former `002_core_behavior.sql` and `003_function_contracts.sql` exercised the
legacy `bjb.sql` PL/pgSQL functions. Those functions are removed by
`030_drop_legacy_functions.sql`, so both test files are gone; behavior is covered
by the server unit tests instead.
