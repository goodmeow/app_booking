# Socket.io contract

## Transport and connection

- Namespace `/`; transports `websocket` and `polling` (`dist/server/server.bundle.js:2138-2144`, `2282-2289`).
- CORS origin `*` with credentials enabled (`2138-2143`).
- No Socket.io authentication middleware or room authorization found. Any client can connect and request arbitrary room membership.
- Redis adapter disabled; broadcasts are process-local (`2146-2148`).

## Client to server

| Event | Payload | Effect |
|---|---|---|
| `room:join` | String room name, normally user/room email | `socket.join(message)` (`2254-2256`, `2275-2277`). No acknowledgement or validation. |
| `event:add` | Historical shape `{messageData:{socket_room_id}}` | Disabled/commented (`2200-2219`, `2262-2265`). |
| `event:delete` | Same historical shape | Disabled/commented (`2221-2231`, `2267-2269`). |
| `event:update` | Same historical shape | Disabled/commented (`2233-2252`, `2271-2273`). |

## Server to client

| Event | Target room(s) | Payload/source |
|---|---|---|
| `response:event` | Each newly inserted attendee email | One event object `{id,title,start,end,organizer,event_detail_id,attendee_email,description,is_visitor}` (`781-795`). |
| `response:event` | Previous and updated attendee email array | Array of updated event objects (`821-854`). |
| `response:event` | Event attendee email array | On cancel, payload is same email array, not event object (`921-934`). |
| `response:event` | Authenticated caller email | On check-in, DB event row with `_id`, organizer, subject, description, start/end, checked-in (`942-959`). This likely assumes tablet JWT email equals room joined by tablet. |
| `response:event` | All attendee emails | On early finish, payload is array of `{attendee_email}` rows (`966-981`). |
| `response:setting` | Every email returned by `settings_update` | Entire settings request body (`1928-1937`; `bjb.sql:850-879`). |

Payload for `response:event` is intentionally polymorphic. Client reconstruction must treat it as invalidation/refetch signal unless bundle proves shape-specific handling.

## Security/parity notes

- Preserve event names and payload inconsistencies for initial parity.
- Add authenticated Socket.io handshake and authorize `room:join` during later hardening, not silent parity work.
- HTTP controllers receive `io` through `req.io` before `/api` routes mount (`2148-2153`).
- Historical handlers use Socket.io default `message` event through `.send()`, but are inactive (`2219`, `2231`, `2252`).
