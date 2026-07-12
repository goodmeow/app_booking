# Phase 7 implementation plan

## Goal

Replace the four protected placeholders with recovered web screens while preserving the Phase 5 server contracts and Phase 6 client foundation.

Phase 7 covers browser UI only. The recovered web bundle has no tablet route or native NFC/LED bridge. Tablet check-in, early-finish, door-open, kiosk provisioning, and APK work remain outside this phase. The settings API is retained, but no visible settings panel will be added without new evidence because the legacy rendered page only confirms card, user, and room sections.

## Evidence

- `screen-inventory.md`: fields, actions, validation, loading/error states, and visual structure.
- `client-route-map.md`: routes, guards, navigation, and route-to-data mapping.
- `client-state-map.md`: RTK Query contracts, payload shapes, cache behavior, and local state.
- `traceability-matrix.md`: server/database/socket effects.
- Private operations PDF: visual oracle for sign-in, management dialogs, profile, report, calendar, booking modal, and separate tablet states. It must not be copied into tracked files until sanitized.
- `dist/client`: immutable CSS and bundle oracle, never an implementation source directory.

## Delivery slices

### 7.1 Shared contracts and UI primitives

- Add reusable confirm-delete, entity-form, password, feedback, loading, and empty-state components.
- Add pure event validation, query, and create/update payload helpers.
- Replace raw event delete/attendee query strings with structured encoded parameters.
- Add confirmed `GET /rooms/available` and `POST /events/attendee` hooks only when their consuming workflow is implemented.
- Keep recovered but server-unmounted `DELETE /events` hook unused; do not build UI around it.
- Define shared date formatting and current-month range helpers.

Acceptance: helpers have focused tests; existing API paths and authentication headers remain unchanged.

### 7.2 Authentication parity

- Match centered white card, brand icon, labels, loading, Enter-submit, and inline errors.
- Preserve `@room.com` rejection and retained-location redirect.
- Replace signup success alert with recovered success dialog and Sign In action.

Acceptance: anonymous routes work; malformed sessions remain safe; successful sign-in returns to the full retained location.

### 7.3 Application management

- Build three page-size-5 DataGrids: card master, users, rooms.
- Card actions: list, create, delete. Do not expose unsupported legacy edit UI.
- User actions: create, edit, admin password reset, delete.
- Room actions: create, edit, password reset, delete.
- Validate every required field client-side because recovered server validation has weak required-field expressions.

Acceptance: ADMIN only; each mutation invalidates and refreshes its list; errors stay visible in the active dialog.

### 7.4 User profile

- Show avatar, name, email, and joined date.
- Allow edit, password change, and delete only when route user matches session user.
- Clear JWT and close realtime connection after successful self-delete.

Acceptance: other authenticated profiles are read-only; admin-route privileges do not bypass recovered self-action rules.

### 7.5 Room usage report

- Default range to current month and reject end before start.
- Render expandable room rows and meeting histories.
- Preserve recovered loading, error, and empty states.
- Export the visible result with exact filename `History Meeting Report (DD-MM-YYYY - DD-MM-YYYY).xlsx`.

Acceptance: ADMIN only; date query is encoded; XLSX contains the same rows shown on screen.

### 7.6 Calendar and room finder

- Build narrow finder/sidebar and wide FullCalendar weekly workspace.
- Load events with `start`, `end`, `users`, and `rooms` filters.
- Load room/user sources for filters and editor suggestions.
- Keep `response:event` cache invalidation and room rejoin behavior from Phase 6.

Acceptance: navigation changes visible range and refetches once; filters produce deterministic query parameters; socket updates refresh events.

### 7.7 Event editor

- Build create/detail/edit/cancel modal with title, attendees, start/end, location, and description.
- Support known attendees plus free-form email and single room-location replacement.
- Use attendee-expanded rows for create and header plus `attendees[]` for update.
- Enforce end not in the past, start not after end, same-day range, and at least one room attendee.
- Restrict edit/cancel to organizer; ended meetings are read-only.
- Preserve exact collision handling for `This room already booked on that time`.

Acceptance: create, edit, attendee removal/addition, and cancellation match server mutations and refresh calendar state.

## Proposed source layout

```text
client/
  components/common/
  domain/events/
  domain/users/
  domain/rooms/
  calendar/
  management/
  profile/
  report/
```

Feature screens own orchestration. Domain modules own validation, query construction, and payload mapping. Shared dialogs must not contain endpoint-specific logic.

## Verification gates

For every slice:

1. Production client build passes.
2. Public/authenticated/admin route guards still pass.
3. Relevant request method, path, query, and body match recovered contracts.
4. Loading, error, empty, success, and permission states are exercised.
5. No tracked file under `dist/` or `docs/reference/private/` changes.

Final Phase 7 smoke uses seeded disposable PostgreSQL and reconstructed server. Detailed visual/network parity remains Phase 8.

## Known decisions and blockers

- Use existing React 17, React Router 5, MUI 5, FullCalendar 6, DataGrid 6, date pickers, and XLSX versions.
- Add client test tooling during slice 7.1; no current test tooling covers client code, and current JavaScript test commands cover server parity only.
- Use recovered Admin/User role UUIDs `471ba030-c950-41f9-90da-4e0fe10426a6` and `67e9500b-908a-497d-9d3b-54bc020700cb`. Development seed and SQL contract fixture are aligned so signup and management forms can use the same identities as server/client legacy contracts.
- Settings UI stays hidden unless screenshots or runtime evidence prove it was rendered.
- Tablet UI and native hardware bridge require APK/runtime evidence and a separate plan.
