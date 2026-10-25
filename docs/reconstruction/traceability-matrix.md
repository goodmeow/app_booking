# Traceability matrix

All API paths below include `/api` mount (`dist/server/server.bundle.js:2153`). Evidence-backed server/DB/socket map; client screen names remain provisional until client-bundle map completes.

| Screen/domain action | HTTP contract | Controller / DB function | Socket effect |
|---|---|---|---|
| Calendar load/filter | `GET /events?start&end&users&rooms` | `listEvents`; `events_list_data_by_attendee` + `events_list_data_by_organizer` (`626-712`; `bjb.sql:434-500`) | None. |
| Event attendee detail | `GET /events/details?event_id` | `listEventDetails`; `event_details_list_data` (`723-737`; `bjb.sql:171-195`) | None. |
| Create booking | `POST /events`, array of attendee-expanded event rows | `insertEvents`; `events_insert_data` (`745-803`; `bjb.sql:355-426`) | `response:event` to each attendee email. |
| Edit booking | `PUT /events`, header plus `attendees[]` | `updateEvents`; `events_update_data` (`805-861`; `bjb.sql:509-574`) | `response:event` to previous/new attendee rooms. |
| Add attendee | `POST /events/attendee` | `addAttendee`; `event_details_new_attendee` (`864-887`; `bjb.sql:219-230`) | None. |
| Remove attendee | `DELETE /events/details?event_detail_id` | `deleteAttendee`; `events_delete_attendee` (`890-909`; `bjb.sql:310-326`) | None. |
| Cancel booking | `PUT /events/delete?event_id` | `deleteEvents`; `events_delete_events` (`912-940`; `bjb.sql:328-346`) | `response:event` to attendee rooms. |
| Tablet/card check-in | `PUT /events/check-in` `{event_id,card_number}` | `checkIn`; `events_checkin` (`942-964`; `bjb.sql:262-307`) | `response:event` to authenticated email room. |
| End meeting early | `PUT /events/early-finish` `{event_id}` | `earlyFinish`; `event_early_finished` (`966-986`; `bjb.sql:236-254`) | `response:event` to attendees. |
| Room availability picker | `GET /rooms/available?start_dates&end_dates&rooms` | `listAvailableRooms`; `room_available_list` (`1556-1595`; `bjb.sql:693-721`) | None. |
| Room list/filter | `GET /rooms?building&capacity&floor` | `listAllRooms`; `room_list` (`1598-1622`; `bjb.sql:773-812`) | None. |
| Room create | `POST /rooms` (admin) | `createRoom`; `users_insert_data` (`1624-1675`; `bjb.sql:925-978`) | None. |
| Room read/update/delete | `GET/PUT/DELETE /rooms/:roomId`; mutations admin | `detailRoom`/`updateRoom`/`deleteRoom`; `room_detail`/`users_update_data` (`1685-1784`; `bjb.sql:731-763`, `1070-1104`) | None. |
| Room usage report | `GET /rooms/usage-report?start&end` (admin) | `getReportRoomsUsage`; `report_rooms_usage` (`1786-1805`; `bjb.sql:618-683`) | None. |
| Employee lookup | `GET /users?email` | `list`; `users_list` (`1280-1296`; `bjb.sql:987-1022`) | None. |
| Employee create | `POST /users` (authorized) | `create`; `users_insert_data` (`1298-1348`; `bjb.sql:925-978`) | None. |
| Employee read/update/delete | `GET/PUT/DELETE /users/:userId` | `userByID`/`update`/`remove`; `users_list_data`/`users_update_data` (`1354-1466`; `bjb.sql:1031-1104`) | None. |
| Password change/reset | `PUT /users/change-password` | `changePassword`; `users_detail` + `users_update_data` (`1468-1524`; `bjb.sql:890-916`, `1070-1104`) | None. |
| Tablet/app setting load | `GET /settings` | `getAppSettings`; `settings_get_data` (`1895-1906`; `bjb.sql:822-840`) | None. |
| Tablet/app setting update | `PUT /settings` | `updateAppSettings`; `settings_update` (`1908-1942`; `bjb.sql:850-879`) | `response:setting` to all room emails. |
| Card master list/create | `GET/POST /settings/card-master` | `getCardMaster`/`createCardMaster`; matching card functions (`1944-1987`; `bjb.sql:49-93`) | None. |
| Card master update/delete | `PUT/DELETE /settings/card-master/:idCardMaster` | corresponding controllers/functions (`1989-2034`; `bjb.sql:23-41`, `101-122`) | None. |
| Door validation/open | `POST /door-open` `{card_number}` | `doorOpen`; `card_master_validation` (`1230-1248`; `bjb.sql:130-148`) | None; response only says door opened. |

Route middleware evidence: events all JWT-protected (`1259-1271`); room mutations/report admin-protected (`1823-1826`); settings/card-master JWT-only (`2049-2053`); routes mounted at `/auth`, `/events`, `/users`, `/rooms`, `/settings`, `/door-open` (`2065-2073`).
