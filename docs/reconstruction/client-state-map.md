# Client State and Data Map

## Evidence

Primary bundle: `dist/client/assets/index-dbf511d4.js`.

- API base/auth header: minified line 174, byte `420447`.
- Users endpoints: line 174, byte `420806`.
- Settings/card endpoints: line 174, byte `421890`.
- Rooms endpoints: line 269, byte `867379`.
- Events endpoints: line 286, byte `1336053`.
- WebSocket slice: line 313, byte `1544843`; middleware later on line 349.

## Store

Redux Toolkit store combines:

- `websocket`: ordinary slice.
- One shared RTK Query API reducer under generated API `reducerPath`; event, room, user, and settings endpoint objects all inject into same base API. Bundle repeats same computed reducer key/middleware references; reconstruction should register base API once, then inject domains.
- `serializableCheck: false`.
- Custom Socket.io middleware appended after RTK Query middleware.

## Authentication state

Authentication is not Redux state.

- `sessionStorage.jwt` contains JSON response from sign-in, expected `{ token, user }`.
- API base is `/api/`.
- Each RTK Query request reads current session value and adds `Authorization: Bearer <token>`.
- Auth helpers expose `authenticate`, `isAuthenticated`, `clearJWT`.
- Sign-in/signup use direct `fetch`, JSON body, and `credentials: include`.
- Sign-out uses direct `GET /api/auth/signout/`.

## RTK Query endpoints

### Users

| Hook operation | Method/path | Input/body | Cache |
|---|---|---|---|
| `createUser` | `POST users/` | user object | invalidate `users` |
| `listUser` | `GET users/` | none | provide `users` |
| `detailUser` | `GET users/:id` | ID | provide `users` |
| `updateUser` | `PUT users/:userId` | remaining object after removing `userId` | invalidate `users` |
| `changePassword` | `PUT users/change-password` | password object | none |
| `deleteUser` | `DELETE users/:id` | ID | invalidate `users` |

Observed create/update fields: `name`, `email`, `password` (create), `roleId`, `card_number`; room branch also uses `floor`, `building`, `capacity`, `feature`. Password body uses `oldPassword`, `newPassword`, `newPasswordConfirmation`; admin reset of another user omits `oldPassword` and adds `userId`.

### Rooms

| Operation | Method/path | Input |
|---|---|---|
| `getRooms` | `GET rooms?<query>` | filtered query object |
| `getRoomById` | `GET rooms/:id` | ID |
| `storeRoom` | `POST rooms/` | room object |
| `updateRoom` | `PUT rooms/:userId` | remaining room object |
| `deleteRoomById` | `DELETE rooms/:id` | empty JSON body |
| `getRoomUsage` | `GET rooms/usage-report?start=YYYY-MM-DD&end=YYYY-MM-DD` | date range |

### Events

| Operation | Method/path | Input |
|---|---|---|
| `getEvents` | `GET events?<query>` | calendar/filter query |
| `GetEventDetails` | `GET events/details?event_id=:id` | event ID query |
| `storeEvent` | `POST events` | attendee-expanded array |
| `updateEvent` | `PUT events` | event object |
| `deleteEventAttendee` | `DELETE events/details?<rawQuery>` | raw query string |
| `deleteEventById` | `PUT events/delete?<rawQuery>` | raw query string |
| `deleteEvents` | `DELETE events` | empty JSON body |

Create body repeats event details per attendee:

```json
[
  {
    "organizer": "user@example.com",
    "subject": "Meeting",
    "attendee_email": "room@example.com",
    "start_date": "Date serialized by fetchBaseQuery",
    "end_date": "Date serialized by fetchBaseQuery",
    "description": "..."
  }
]
```

Update body:

```json
{
  "id": "event-id",
  "organizer": "user@example.com",
  "subject": "Meeting",
  "description": "...",
  "start_date": "Date",
  "end_date": "Date",
  "attendees": [{ "attendee_email": "room@example.com" }]
}
```

Client validations: end not passed; start before/equal end; same calendar day; at least one attendee email containing `@room`; collision error special-cases exact message `This room already booked on that time`.

### Settings and card master

| Operation | Method/path | Input |
|---|---|---|
| `getSettings` | `GET settings` | none |
| `updateSettings` | `PUT settings` | settings object |
| `getCardMaster` | `GET settings/card-master?<query>` | optional filters |
| `storeCardMaster` | `POST settings/card-master` | `{card_number}` |
| `updateCardMaster` | `PUT settings/card-master/:_id` | whole card object |
| `deleteCardMaster` | `DELETE settings/card-master/:id` | ID |

Settings read executes in app management, but recovered render does not expose settings UI and update hook appears unused. Treat settings screen as latent/dead bundle capability pending screenshots/server evidence.

## WebSocket state and middleware

State fields:

```text
connected=false
status=""
autoReconnect=false
reconnected=false
socket_room_list=[]
last_socket_emit=null
```

Flow:

1. Authenticated route wrapper dispatches `wsConnect` whenever pathname changes.
2. Middleware opens Socket.io namespace `/`, transport forced to `websocket`.
3. On connection, slice becomes connected.
4. Wrapper dispatches `wsJoinRoom(authenticatedUser.email)`; middleware emits `room:join` with email string.
5. Server event `response:event` invalidates RTK Query `events` cache.
6. Reconnect also invalidates `events` cache.
7. Unmount dispatches disconnect and closes singleton socket.
8. Generic `wsEmit` removes payload `event` key, then emits remaining object under that event name. No active UI dispatch was confirmed.

Known weakness preserved for parity record: socket join has no client auth payload beyond room email; auth token is not explicitly passed in Socket.io options.

## Local component state

- Auth forms: controlled fields, error, redirect/success dialog.
- Administration: modal visibility, selected entity ID/type; RTK Query owns lists/loading.
- Event calendar: selected date/event, event array, room/building filters, modal, start/end, attendees/location.
- Profile: edit/password/delete modal flags.
- Report: start/end month dates; response rendered as expandable room history and exported client-side with SheetJS.
