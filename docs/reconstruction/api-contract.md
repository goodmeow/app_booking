# Recovered API Contract

Base path: `/api` (`server.bundle.js:2153`). Unless marked Public, endpoint requires bearer JWT via `express-jwt`; decoded payload is `{_id,email,name,role}` (`server.bundle.js:1132-1148,1202-1205`). Normal controller failures are generally HTTP 400 `{error}`; invalid/missing JWT is HTTP 401 (`server.bundle.js:2155-2164`).

## Authentication and door

| Method/path | Access | Input | Success | PostgreSQL function | Evidence |
|---|---|---|---|---|---|
| `POST /auth/signin` | Public | body `email,password` | 200 `{token,user:{_id,name,email,role}}`; cookie `t` | `users_detail` | `server.bundle.js:1113-1154,1832` |
| `POST /auth/signup` | Public | body `name,email,password`; fixed employee role UUID | 200 `{message:"Successfully signed up!"}` | `users_insert_data` | `server.bundle.js:1156-1200,1833` |
| `GET /auth/signout` | Public | none | 200 `{message:"signed out"}`; clears `t` | none | `server.bundle.js:1206-1210,1834` |
| `POST /door-open` | JWT | body `card_number` | 200 `{message:"Door opened"}` | `card_master_validation(card_number)` | `server.bundle.js:1230-1248,2073` |

Signin errors use HTTP 401: missing credentials, user not found, inactive account, mismatch. Signup rejects `@room.com`, hashes password with bcrypt cost 10, maps duplicate to `Email already exist` (`server.bundle.js:1119-1153,1163-1199`). Door errors: `Card number must be provided`, `Card number not found` (`server.bundle.js:1235-1246`).

## Events

Routes: `server.bundle.js:1263-1271`.

| Method/path | Input | Success / mapping | PostgreSQL function(s) | Evidence |
|---|---|---|---|---|
| `GET /events` | query optional `start,end,users,rooms` | 200 unique events mapped to `id,title,start,end,organizer,description,is_cancel,is_draft,is_allday,created_at,checked_in,late_threshold` | `events_list_data_by_attendee`, `events_list_data_by_organizer` | `server.bundle.js:625-719` |
| `POST /events` | body nonempty array; each item `organizer,subject,description,start_date,end_date,attendee_email` | 200 array `id,title,start,end,organizer,event_detail_id,attendee_email,description,is_visitor`; emits per attendee | `events_insert_data` | `server.bundle.js:745-802` |
| `PUT /events` | body `id,organizer,start_date,end_date,attendees[]` plus event fields; organizer must equal JWT email | 200 mapped event array; emits attendees | `event_details_list_data`, `events_update_data(headerJSON,attendeesJSON)` | `server.bundle.js:805-861` |
| `POST /events/attendee` | body array; first item `event_id,attendee_email` | 200 DB rows | `event_details_new_attendee` | `server.bundle.js:864-887` |
| `PUT /events/delete` | query `event_id` | 200 DB rows; organizer enforced in DB; emits attendees | `events_delete_events(jwtEmail,event_id)`, `event_details_list_data` | `server.bundle.js:912-940` |
| `GET /events/details` | query `event_id` | 200 DB rows | `event_details_list_data` | `server.bundle.js:722-742` |
| `DELETE /events/details` | query `event_detail_id` | 200 DB rows | `events_delete_attendee` | `server.bundle.js:890-909` |
| `PUT /events/check-in` | body `event_id,card_number` | 200 first DB row when `checked_in` truthy; emits JWT email room | `events_checkin(event_id,card_number)` | `server.bundle.js:942-964` |
| `PUT /events/early-finish` | body `event_id` | 200 DB array; emits all attendee rooms | `event_early_finished(event_id)` | `server.bundle.js:966-986` |

Create validation errors: `Bad request`, `start_time cannot be later than end_time`, `Cannot be different day`. Update also rejects non-organizer. Check-in errors: `Some required field is missing`, `Check in failed`. Early finish: `event_id is required`, `Action failed` (`server.bundle.js:749-752,809-810,948-955,971-976`). Visitor status is false when attendee contains configured employee or room suffix (`server.bundle.js:772-773,834-838`).

## Users

Routes and guards: `server.bundle.js:1539-1545`. `POST/PUT/DELETE` use `hasAuthorization`; creation has no `:userId`, thus `req.profile` is absent and effective access is ADMIN only (`server.bundle.js:1212-1219,1542`).

| Method/path | Input | Success | PostgreSQL function | Evidence |
|---|---|---|---|---|
| `GET /users` | query optional `email` | 200 DB array | `users_list` | `server.bundle.js:1280-1296` |
| `POST /users` | ADMIN; body `name,email,password,roleId`, optional `card_number` | 200 signup message | `users_insert_data` | `server.bundle.js:1298-1348` |
| `PUT /users/change-password` | body `oldPassword,newPassword,newPasswordConfirmation`; ADMIN may supply `userId` and bypass old password for another user | 200 updated user sans room fields | `users_detail`, `users_update_data` | `server.bundle.js:1468-1524` |
| `GET /users/:userId` | JWT; no ownership guard | 200 preloaded `req.profile` | `users_list_data` | `server.bundle.js:1354-1377,1544-1545` |
| `PUT /users/:userId` | ADMIN or self; body `name,email`; ADMIN may set `roleId,card_number` | 200 updated user sans room fields | `users_update_data` | `server.bundle.js:1379-1436` |
| `DELETE /users/:userId` | ADMIN or self | 200 user with `is_deleted=true`, sans room fields | `users_update_data` | `server.bundle.js:1438-1466` |

User creation/update reject room email. Password errors are exact strings at `server.bundle.js:1480-1495`. Missing/user preload errors are `User not found` or `Could not retrieve user` (`server.bundle.js:1365-1373`).

## Rooms

Routes and guards: `server.bundle.js:1820-1826`. Create/update/delete/report require ADMIN; list, availability, detail require JWT.

| Method/path | Input | Success | PostgreSQL function | Evidence |
|---|---|---|---|---|
| `GET /rooms` | query optional `building,capacity,floor` | 200 DB array | `room_list` | `server.bundle.js:1598-1622` |
| `POST /rooms` | ADMIN; body `name,email,password,roleId`; optional `building,capacity,floor,feature` | 200 signup message | `users_insert_data` | `server.bundle.js:1624-1683` |
| `GET /rooms/available` | query optional `start_dates,end_dates,rooms`; defaults start now/end +30m | 200 DB array | `room_available_list` | `server.bundle.js:1556-1595` |
| `GET /rooms/usage-report` | ADMIN; query `start,end` | 200 DB array | `report_rooms_usage(start,end)` | `server.bundle.js:1786-1805` |
| `GET /rooms/:roomId` | JWT | 200 first DB row | `room_detail` | `server.bundle.js:1685-1704` |
| `PUT /rooms/:roomId` | ADMIN; body `name,email,roleId`, optional room fields | 200 updated row | `users_update_data` | `server.bundle.js:1706-1760` |
| `DELETE /rooms/:roomId` | ADMIN | 200 row with `is_deleted=true` | `users_update_data` | `server.bundle.js:1762-1784` |

Room email must contain `@room.com`; defaults optional fields to `-`. Duplicate create maps to `Email room already exist` (`server.bundle.js:1636-1681`). Report validates dates/order, though missing-field comma-operator bug checks only `end` (`server.bundle.js:1792-1804`).

## Settings and card master

All require JWT; none requires ADMIN (`server.bundle.js:2048-2053`).

| Method/path | Input | Success | PostgreSQL function | Evidence |
|---|---|---|---|---|
| `GET /settings` | none | 200 first row or `{}` | `settings_get_data` | `server.bundle.js:1895-1906` |
| `PUT /settings` | body `id,lock_timer,led_timer,table_input,not_checked_in_time_limit,time_of_event_start_soon,available_color,will_start_color,on_meeting_color` | 200 `{status:"updated",message:"Setting successfully updated"}`; emits rooms | `settings_update(bodyJSON)` | `server.bundle.js:1908-1942` |
| `GET /settings/card-master` | query optional `card_number` | 200 DB array | `card_master_get_data` | `server.bundle.js:1944-1963` |
| `POST /settings/card-master` | body `card_number`; creator from JWT `_id` | 201 `{status:"created",message:"Card successfully created"}` | `card_master_insert_data` | `server.bundle.js:1965-1987` |
| `PUT /settings/card-master/:idCardMaster` | body `card_number`; updater from JWT `_id` | 200 updated message | `card_master_update_data` | `server.bundle.js:1989-2014` |
| `DELETE /settings/card-master/:idCardMaster` | path id | 200 deleted message | `card_master_delete_data` | `server.bundle.js:2016-2034` |

Settings validation exact errors cover missing id/parameters, numeric timers, boolean `table_input` (`server.bundle.js:1921-1927`). Duplicate card error maps PostgreSQL `23505` to `Card number already exist` (`server.bundle.js:1980-1985,2007-2012`).

## Function traceability

Recovered controllers call 26 distinct PostgreSQL functions: `users_detail`, `users_insert_data`, `card_master_validation`, `events_list_data_by_attendee`, `events_list_data_by_organizer`, `event_details_list_data`, `events_insert_data`, `events_update_data`, `event_details_new_attendee`, `events_delete_attendee`, `events_delete_events`, `events_checkin`, `event_early_finished`, `users_list`, `users_list_data`, `users_update_data`, `room_available_list`, `room_list`, `room_detail`, `report_rooms_usage`, `settings_get_data`, `settings_update`, `card_master_get_data`, `card_master_insert_data`, `card_master_update_data`, `card_master_delete_data`. Shared functions serve multiple endpoints.
