# Database map

Evidence source: `bjb.sql`, PostgreSQL 14.1 dump (`bjb.sql:1-6`). This documents observed schema, not desired redesign.

## Tables

| Table | Columns | Constraints | Observed role |
|---|---|---|---|
| `tbl_events` | `_id uuid`, organizer, location, subject, description, start/end timestamps, cancel/draft/all-day flags, created/updated timestamps, `checked_in`, `late_threshold` | PK `_id` | Meeting header (`bjb.sql:1152-1167`, `1265-1266`). |
| `tbl_event_details` | `_id uuid`, `event_id`, attendee email, deleted flag, timestamps, visitor flag | PK `_id` | Attendees, including room email (`bjb.sql:202-210`, `1257-1258`). |
| `tbl_users` | `_id`, name, unique email, password fields, `role_id`, deleted flag, `type`, room metadata, card number | PK `_id`; unique email | Employees and rooms share one table; `type` discriminates them (`bjb.sql:1208-1224`, `1289-1298`). |
| `tbl_role` | `_id`, role name, deleted flag, timestamps | PK `_id` | User authorization role (`bjb.sql:1176-1182`, `1273-1274`). |
| `tbl_app_settings` | `_id`; lock/LED/check-in/start-soon timers; table-input flag; available/upcoming/meeting colors; timestamps | PK `_id`; timer/color fields NOT NULL | Singleton-like tablet behavior/settings record (`bjb.sql:1115-1127`, `1233-1234`). |
| `tbl_card_masters` | `_id`, unique card number, audit timestamps/user UUIDs | PK `_id`; unique card number | Global valid card registry (`bjb.sql:1136-1143`, `1241-1250`). |
| `tbl_rooms` | `_id`, room name, floor, integer capacity, deleted flag, timestamps | PK `_id` | Legacy/unused room table: active server room operations target `tbl_users` (`bjb.sql:1191-1199`, bundle `1549-1800`). |

No foreign-key constraints exist in dump. Logical relations only:

- `tbl_event_details.event_id` to `tbl_events._id`.
- attendee/organizer email to `tbl_users.email`.
- `tbl_users.role_id` to `tbl_role._id`.
- card-master audit UUIDs to `tbl_users._id`.

Deletion therefore has no DB-enforced cascade/restrict behavior.

## Stored functions

| Domain | Functions | Behavior/evidence |
|---|---|---|
| Card master | `card_master_get_data`, `insert_data`, `update_data`, `delete_data`, `validation` | CRUD and case-insensitive door-card validation. Validation returns `Door Opened`, else raises `Card not registered` (`bjb.sql:23-148`). |
| Event attendees | `event_details_list_data`, `event_details_new_attendee`, `event_details_delete_data`, `events_delete_attendee` | List/add/delete attendee rows (`bjb.sql:155-230`, `310-346`). |
| Events | `events_insert_data`, `events_update_data`, `events_update_data_old`, `events_delete_events` | Insert/update/cancel meetings; delete is soft cancel and organizer-only (`bjb.sql:328-426`, `509-610`). |
| Event queries/actions | `events_list_data_by_attendee`, `events_list_data_by_organizer`, `events_checkin`, `event_early_finished` | Calendar queries, NFC/card check-in, set end time now (`bjb.sql:236-308`, `434-500`). |
| Rooms/report | `room_available_list`, `room_detail`, `room_list`, `report_rooms_usage` | Reads rooms from users; availability excludes overlapping attendee room; report aggregates meeting duration/list (`bjb.sql:618-812`). |
| Settings | `settings_get_data`, `settings_update` | Read first settings row; update selected row; return all `@room.com` emails for socket broadcast (`bjb.sql:822-879`). |
| Users | `users_detail`, `users_insert_data`, `users_list`, `users_list_data`, `users_update_data` | Employee/auth/detail CRUD; room CRUD also reuses insert/update (`bjb.sql:890-1104`). |

## Business rules recovered

- Room identity uses email suffix `@room.com`; event insert/update treats attendee with that suffix as room and rejects conflicts (`bjb.sql:355-426`, `509-574`).
- Conflict check only detects existing event start/end inside requested interval. Existing event fully spanning requested interval may escape detection (`bjb.sql:377-382`, `524-529`).
- Event cancel permitted only when authenticated email equals organizer; row retained with `is_cancel=true` (`bjb.sql:328-346`; bundle `913-934`).
- Check-in card accepted when present globally in card master, assigned to attendee user, or assigned to organizer user. Success stamps `checked_in=NOW()` (`bjb.sql:262-307`).
- Early finish stamps `end_date=NOW()` and returns attendee emails used as socket rooms (`bjb.sql:236-254`; bundle `966-981`).
- Room usage includes non-cancelled meetings wholly bounded by selected date range; rooms sourced from non-deleted `@room.com` users (`bjb.sql:618-683`).
- Active user/room deletion is soft via `is_deleted=true` through generic `users_update_data` (bundle `1438-1461`, `1762-1779`).

## Reconstruction hazards

- Many functions concatenate caller-built SQL fragments. Preserve behavior for parity, replace with typed/parameterized queries during hardening.
- `tbl_rooms` duplicates room concepts but server uses `tbl_users.type='room'`; do not migrate active data into `tbl_rooms` without evidence.
- `users_detail` returns password hash (`bjb.sql:890-916`); required by old password verification, must never become public API output.
- No FKs; reconstruction migrations should initially preserve this behavior, then add integrity only after orphan audit.
- `users_list` filtered branch references alias `i.is_deleted`, likely runtime SQL error (`bjb.sql:987-1022`).
- Legacy delete attendee functions index scalar strings like arrays and need parity tests before reuse (`bjb.sql:155-169`, `310-326`).
