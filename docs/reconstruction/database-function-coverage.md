# Database function coverage

PostgreSQL 14 migration rebuild exposes exactly 28 legacy public functions. `database/tests/003_function_contracts.sql` asserts complete inventory and runs all active server paths inside a rolled-back transaction.

## Executed behavior

- Card master: list, insert, update, delete, validation success/error.
- Event detail: list and add attendee.
- Events: insert, modern JSON update, attendee/organizer lists, check-in, early finish, organizer cancellation.
- Rooms: list, detail, availability, usage report.
- Settings: read and update with room recipient list.
- Users: insert, list, detail, list-data, JSON update.

## Signature-only legacy paths

- `event_details_delete_data`
- `events_delete_attendee`
- `events_update_data_old`

These functions are retained for schema parity but active reconstructed controllers should use modern paths already present in legacy bundle. Their scalar/array indexing and dynamic SQL are malformed. They remain explicit known defects, not silently repaired migrations.

## Expected defect assertion

Filtered `users_list` execution must currently fail because SQL references undefined alias `i.is_deleted`. Unfiltered behavior passes. Hardening or compatibility decision belongs after server parity baseline.

`room_available_list` contract confirms legacy overlap defect: an existing event from 10:00–11:00 does not exclude its room for a request from 10:15–10:30. Function returns all three rooms because it checks only whether existing start/end falls inside requested interval.

## Test files

- `001_schema_smoke.sql`: object counts.
- `002_core_behavior.sql`: critical operational workflow.
- `003_function_contracts.sql`: complete inventory plus active-path contracts.
