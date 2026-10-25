# Server Module Map

Status: extracted statically from `dist/server/server.bundle.js`. Line references below point to that immutable baseline artifact.

## Entry and runtime

- Original entry is `server/server.js` (`webpack.config.cjs:9`). Bundle entry imports config, Express app, Socket.io, socket initializer, and API routes (`server.bundle.js:2103-2108`).
- Loads `.env.production` unconditionally in production bundle (`server.bundle.js:18-24`). Config includes client/server URL and ports, HTTPS, JWT, PostgreSQL, Redis, and email suffixes (`server.bundle.js:27-53`). JWT fallback is `YOUR_secret_key` (`server.bundle.js:38`).
- Creates HTTP or HTTPS server, then Socket.io with websocket/polling and wildcard CORS (`server.bundle.js:2123-2144`). HTTPS branch imports `node:fs/promises` but calls `readFileSync`, a likely runtime defect (`server.bundle.js:2095,2125-2127`).
- Attaches Socket.io as `req.io`, mounts router at `/api`, installs JWT/general error handler, then listens (`server.bundle.js:2148-2184`). Redis adapter exists only as comments (`server.bundle.js:2113,2146-2147`).

## Original source inventory

| Original path | Recovered responsibility | Evidence |
|---|---|---|
| `config/config.js` | Environment-derived runtime config | `server.bundle.js:16-55` |
| `server/server.js` | HTTP(S), Socket.io, `/api`, errors, listen | `webpack.config.cjs:9`; `server.bundle.js:2102-2186` |
| `server/express.js` | Express middleware: body parser, cookies, compression, Helmet, CORS, logger | `server.bundle.js:2333-2388` |
| `server/services/pgpool.js` | Singleton PostgreSQL `Pool` | `server.bundle.js:79-102` |
| `server/pglibs/schema.js` | Minimal schema container | `server.bundle.js:70-74` |
| `server/pglibs/model.js` | SQL-string-building `find/save/update/remove` | `server.bundle.js:103-495` |
| `server/pglibs/index.js` | `Pgoose` model factory | `server.bundle.js:496-512` |
| `server/models/events.model.js` | Event schema/model | `server.bundle.js:513-555` |
| `server/models/users.model.js` | User/room schema/model | `server.bundle.js:999-1048` |
| `server/models/settings.model.js` | App settings schema/model | `server.bundle.js:1836-1867` |
| `server/models/cardMaster.model.js` | Card master schema/model | `server.bundle.js:1868-1890` |
| `server/helpers/helpers.js` | Date/week conversion and `isEmpty` | `server.bundle.js:557-615` |
| `server/helpers/dbErrorHandler.js` | Legacy DB error formatting | `server.bundle.js:1053-1093` |
| `server/utils/bcrypt.js` | bcrypt hash/compare, cost 10 | `server.bundle.js:1096-1104` |
| `server/controllers/auth.controller.js` | Auth, JWT guards, door validation | `server.bundle.js:1106-1258` |
| `server/controllers/events.controller.js` | Event CRUD, attendee, check-in, early finish | `server.bundle.js:619-998` |
| `server/controllers/user.controller.js` | User CRUD/password | `server.bundle.js:1275-1534` |
| `server/controllers/rooms.controllers.js` | Room CRUD/availability/report | `server.bundle.js:1549-1815` |
| `server/controllers/setting.controller.js` | Settings/card master CRUD | `server.bundle.js:1891-2043` |
| `server/routes/auth.routes.js` | `/auth` routes | `server.bundle.js:1828-1835` |
| `server/routes/events.routes.js` | `/events` routes | `server.bundle.js:1259-1272` |
| `server/routes/user.routes.js` | `/users` routes and `userId` preload | `server.bundle.js:1535-1546` |
| `server/routes/rooms.routes.js` | `/rooms` routes | `server.bundle.js:1816-1827` |
| `server/routes/setting.routes.js` | `/settings` routes | `server.bundle.js:2044-2054` |
| `server/routes/index.js` | API router composition and `/door-open` | `server.bundle.js:2055-2074` |
| `server/socket/controllers/event.socket.js` | Prototype add/delete/update handlers plus room join | `server.bundle.js:2199-2257` |
| `server/socket/initSocket.js` | Active `room:join`; event handlers commented | `server.bundle.js:2259-2279` |
| `server/socket/webSocket.js` | Root namespace connection/disconnect | `server.bundle.js:2280-2292` |

## Data access behavior

All models share one custom adapter. It calls PostgreSQL functions with generated SQL, rather than ordinary table CRUD:

- `find`: `SELECT * FROM function(...)` (`server.bundle.js:197-213`).
- `save`: function parameters or generated column/value strings (`server.bundle.js:244-330`).
- `update`: function parameters or generated set/where strings (`server.bundle.js:385-418`).
- `remove`: function parameters or generated value arrays (`server.bundle.js:441-484`).

Values and identifiers are concatenated into SQL. Preserve behavior for parity tests; replace with parameterized calls only during hardening.

## Middleware and authorization

- Express: JSON and URL-encoded body, cookies, compression, Helmet with CSP disabled, unrestricted CORS, request logger (`server.bundle.js:2346-2368`).
- `requireSignin`: `express-jwt`, secret from config, decoded JWT stored in `req.auth` (`server.bundle.js:1202-1205`).
- `hasAuthorization`: ADMIN or target `req.profile._id == req.auth._id` (`server.bundle.js:1212-1220`). Route order matters: `userId` param loader creates `req.profile` (`server.bundle.js:1354-1369,1545`).
- `adminOnly`: exact uppercase role `ADMIN` (`server.bundle.js:1221-1229`).
- Settings and card-master mutations have authentication but no admin guard (`server.bundle.js:2049-2053`).

## Socket contract summary

- Namespace `/`; no socket authentication (`server.bundle.js:2282-2290`).
- Client event `room:join` accepts raw room name and calls `socket.join(message)` (`server.bundle.js:2254-2257,2275-2277`).
- Server event `response:event` emitted by event create/update/delete/check-in/early-finish (`server.bundle.js:793,854,933,958,980`).
- Server event `response:setting` emitted to all returned room emails after settings update (`server.bundle.js:1932-1933`).
- `event:add`, `event:delete`, `event:update` handlers are inactive comments (`server.bundle.js:2262-2273`).

## Known parity traps

- Several required-field conditions use JavaScript comma operator, e.g. `if (!name, !email, !password)`, so only final expression controls failure (`server.bundle.js:1163,1307,1636,1720,1792`).
- `GET /users/:userId` has no ownership/admin guard after authentication (`server.bundle.js:1544`).
- `GET /auth/signout` is public and only clears cookie; API auth otherwise uses bearer JWT (`server.bundle.js:1202-1210,1834`).
- `users_detail` must return password hash because signin/change-password compare `user[0].password` (`server.bundle.js:1120-1131,1485-1495`).
