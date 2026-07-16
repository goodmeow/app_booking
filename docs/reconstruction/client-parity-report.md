# Client parity report

Date: 2026-07-13

## Result

Phase 8 is complete against the preserved `dist/client` bundle, recovered CSS, route/state maps, server differential harness, and reconstructed runtime. Route and active HTTP contracts match after the fixes below. Calendar invalidation and reconnect behavior are covered by a focused middleware test. Report dates, response mapping, workbook rows, filename, sheet name, and dynamic column sizing are covered by pure contract tests.

Pixel-level screenshot comparison is not claimed: the repository contains no sanitized legacy screenshots and the environment has no browser engine. Responsive behavior was therefore compared from the preserved bundle/CSS and verified through the production build plus SPA route/chunk smoke checks.

## Corrections made during Phase 8

| Area | Recovered behavior restored |
|---|---|
| Authentication | Sign-out clears `sessionStorage.jwt` and navigates immediately, without waiting for the cookie-clearing request. Navbar sign-out returns through `/`. |
| Routes and permissions | Admin route/menu checks require exact `ADMIN`; organizer edit rights require exact recovered email equality. |
| Navbar | White app bar, 32px brand icon, active color treatment, fresh `GET /users/:id` welcome name, and removal of the duplicate home label. |
| RTK Query | Queries refetch on mount/argument change as in the bundle. |
| Event payload | Description input is URI-encoded once and sent in the recovered JSON shape, then decoded for editor/report display. |
| Query strings | Scalar spaces use `%20`; nested values use recovered bracket notation. |
| Card master | Latent update contract retains `_id` in the request body while also using it in the URL. |
| Calendar realtime | Removed the selected-room second Socket.io connection; the recovered authenticated singleton remains. Reconnect rejoins known rooms and `response:event` invalidates event queries. |
| Management | New employee users default to the User role; the room form has no role field. |
| Report | Workbook construction is testable, uses recovered row/sheet/filename contracts, dynamically sizes six columns, and contains export error handling. |
| Theme | Restored the recovered white background and `#0f6cbd` primary/secondary foundation. |

## Accepted deviations

These are deliberate compatibility repairs or robustness improvements, not unreviewed gaps:

- Room-filtered calendar queries omit the simultaneous user predicate. The legacy client sends both, while the legacy organizer lookup applies an invalid room alias. The reconstructed server skips that invalid organizer branch for a room-wide query; the regression suite proves room bookings are returned.
- Empty event descriptions are normalized to `-` server-side because the recovered PostgreSQL array serializer fails on an empty element.
- Required-field checks and room/user email-domain checks remain stricter than the weak recovered form predicates, as decided in Phase 7.
- Malformed stored sessions are rejected and removed rather than treated as authenticated.
- Socket room state is deduplicated and replayed after reconnect. The bundle is more fragile and may lose membership.
- Calendar drag/resize is not enabled. The bundle mutates the local calendar after confirmation without persisting the change; exposing that behavior would falsely imply the booking was saved.
- Calendar and report controls stack on smaller screens instead of preserving the legacy fixed-width table layout. Native date inputs replace legacy MUI date pickers. These changes preserve the HTTP/date contracts and prevent narrow-screen clipping.
- Invalid report ranges skip the request and show an error. Malformed encoded descriptions and empty/zero values are handled without crashing.

## Verification evidence

- `npm run test:client`: 9 files pass, including auth sequencing, calendar/query/payload helpers, Socket.io join/invalidation/reconnect, and XLSX workbook contracts.
- `npm run build:client`: production build succeeds with all protected feature chunks emitted.
- Runtime SPA smoke: `/`, `/signin`, `/signup`, `/app-management`, `/report`, and `/user/test` return HTTP 200 from the reconstructed build.
- `npm run test:server:regression`: 2/2 pass for room-filtered calendar and empty event descriptions.
- `npm run test:server:parity`: 12/12 pass across all 32 server route boundaries and Socket.io contracts.
- `npm run build:server:check`: reconstructed server production bundle compiles.
- `git diff --check`: no whitespace errors.

## Remaining boundary

Settings remains a latent API capability without evidence for visible UI. Tablet check-in, NFC, RGB LED, and native kiosk behavior remain outside this web-client reconstruction.
