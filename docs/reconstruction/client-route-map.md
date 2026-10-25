# Client Route Map

## Evidence and confidence

Primary source: `dist/client/assets/index-dbf511d4.js`, minified line 349. Route table begins at byte `1694636`. Supporting shell metadata: `dist/client/index.html`, lines 1-14. Names below describe recovered behavior, not original source filenames.

Confidence: high for routes, guards, navigation, and HTTP contracts; medium for original component boundaries/names.

## Routes

| Path | Access | Recovered screen | Navigation |
|---|---|---|---|
| `/signup` | Public | Sign Up | Public navbar |
| `/signin` | Public | Sign In | Public navbar; protected-route redirect target |
| `/` | Authenticated | Meeting calendar / room finder | Brand/home link |
| `/app-management` | Admin | Card, user, room administration | Admin navbar only |
| `/report` | Admin | Room usage report | Admin navbar only |
| `/user/:userId` | Authenticated | User profile | `My Profile`; URL uses authenticated user ID |

Guard behavior:

- Protected anonymous request redirects to `/signin`, retaining attempted location in `state.from`.
- Non-admin request to admin route redirects to `/`.
- Sign-in success redirects to retained `state.from`, default `/`.
- `/signup` and `/signin` remain public even while authenticated.

## Global navigation

- Brand: icon plus `360Books`, link `/`.
- Anonymous: `Sign up`, `Sign In`.
- Authenticated user: `My Profile`, `Sign out`, `Welcome, <name>`.
- Admin additions: `Apps Management`, `Report`.
- Active item colors: white on `#0f6cbd`; default text `#003049`.
- Sign-out clears session JWT then pushes `/`.

## Route-to-data trace

| Route | Reads | Writes |
|---|---|---|
| `/signin` | none | `POST /api/auth/signin/` |
| `/signup` | none | `POST /api/auth/signup/` |
| `/` | events, rooms, users | create/update/delete event |
| `/app-management` | card master, users, rooms, settings (settings result unused) | card/user/room CRUD, password change |
| `/report` | room usage by date range | client-side XLSX export |
| `/user/:userId` | user detail | self edit/password/delete |

## Reconstruction notes

- Router: React Router DOM v5 (`BrowserRouter`, `Route`, `Redirect`).
- App title says `360Booking`; rendered brand says `360Books`. Preserve mismatch until parity phase decides canonical label.
- No catch-all/404 route recovered.
- No separate tablet route recovered. Existing bundle is web management/calendar client; APK/tablet UI must be treated as separate future target unless further evidence links it.
