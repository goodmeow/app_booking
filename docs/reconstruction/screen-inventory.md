# Client Screen Inventory

## Scope

Inventory recovered from web bundle `dist/client/assets/index-dbf511d4.js`, CSS, and `index.html`. Screenshot/PDF reference material is private and intentionally not copied here. Web bundle title: `360Booking - Management Meeting Scheduling Application`; viewport is responsive.

## 1. Sign In

- Public `/signin`.
- Centered MUI card, icon, `360Books`, email/password, Submit.
- Enter key submits.
- Rejects any email containing `@room.com`: `Room cannot sign in here`.
- Server error shown inline.
- Success stores JWT response and redirects.

## 2. Sign Up

- Public `/signup`.
- Fields: Name, Email, Password.
- Rejects email containing `@room.com`.
- Success dialog: `New account successfully created.` plus Sign In link.
- No role selector in public form.

## 3. Meeting Calendar / Room Finder

- Protected `/`.
- Main workspace: narrow left controls plus wide calendar/time-grid content.
- `Add Event` opens event modal.
- Calendar stack: FullCalendar React, day grid/time grid/interaction/resource timeline plugins.
- Left-side room finder filters building/room and can select room chips; hidden room search controls also remain in bundle.
- Data refreshed through RTK Query and `response:event` Socket.io notifications.
- Exact query keys for initial calendar fetch need runtime/server cross-check; bundle constructs nested query strings with empty/null removal.

### Event create/edit modal

- Fields/actions: Save, Delete, Add a Title, Invite Attendees, Start date, End date, Location, Description.
- Attendee autocomplete offers known users plus free-form email (`Use this name`).
- Location autocomplete replaces existing room attendee; room recognized by email containing `@room`.
- Edit loads `events/details?event_id=...`.
- Only organizer can edit/delete; ended meetings become read-only.
- Calendar selection can update start/end when allowed.
- Indonesian validation messages retained in otherwise English UI.

## 4. Apps Management

- Admin-only `/app-management`.
- One page containing three MUI DataGrid sections, page size 5.

### Card Master List

- Columns: Card ID, Card Number, Created By, Action.
- Add New Card Master; delete action.
- Create form field: Card Number.
- Update endpoint exists, but recovered action UI only exposes delete for card rows.

### All Users

- Columns: User ID, Name, Email, Action.
- Actions: edit, change password, delete.
- Create: Name, Email, Password, Card Number, Role.
- Roles hardcoded in bundle with UUIDs for Admin and User. Reconstruction should move these to server data/config after parity.
- Edit: Name, Email, Card Number, Role.
- Admin password reset for another user requires new password/confirmation, not old password.

### All Rooms

- Columns: Room ID, Name, Building, Capacity, Floor, Email, Action.
- Actions: edit, change password, delete.
- Create: Name, Email, Password, Floor, Building, Capacity, Feature, Role.
- Edit: Name, Email, Floor, Building, Capacity, Feature.

### Dormant settings capability

- Page fetches settings, and update endpoint/hook exists.
- No visible settings section found in final rendered page. Confirm against screenshots and server contract before reconstructing UI.

## 5. User Profile

- Protected `/user/:userId`.
- Shows avatar icon, name, email, joined date.
- Edit/change-password/delete actions shown only when route ID matches authenticated user.
- Self edit: Name, Email.
- Self password change: Old Password, New Password, Confirmation Password.
- Delete confirmation clears JWT and returns home.

## 6. Room Usage Report

- Admin-only `/report`.
- Start Time and End Time date pickers, default current month bounds.
- End date cannot precede start.
- Table columns: expand control, Room Name, Total Pemakaian.
- Expanded row: History Meeting with Subject, Organizer, Description, Start Date, End Date.
- Loading/error/empty states: `Loading...`, `An error occured`, `No Meeting History`.
- Exports XLSX named `History Meeting Report (DD-MM-YYYY - DD-MM-YYYY).xlsx`.

## 7. Global states/dialogs

- Protected-route redirects.
- Inline API errors in auth/edit/password/create forms.
- Confirm Delete dialog with Cancel/Confirm.
- Event collision/time/location snackbar, five-second auto-hide.
- DataGrid loading states for admin lists.
- Navbar switches anonymous/authenticated/admin actions.

## Tablet/APK boundary

Private references describe 10-inch Android RK3288 tablet, NFC, and RGB LED behavior. No matching tablet-only route, NFC bridge, LED bridge, check-in, early-finish, or door-open call appears in this web bundle's recovered API layer. Likely separate APK/source artifact. Do not falsely merge tablet UI into reconstructed web client without APK/runtime evidence.

## Visual foundation

- React 17, MUI 5, Bootstrap 5 utility classes, FullCalendar, MUI DataGrid/date pickers.
- Theme primary/secondary `#0f6cbd`; white app bar; light cards; protected/open title palette variants.
- CSS bundle includes Bootstrap, FullCalendar, daterangepicker, and application rules. Reuse CSS only as oracle; rebuild component styles maintainably.
