# Client foundation report

Phase 6 restores React 17/Vite shell while deferring complex feature screens to Phase 7.

## Restored

- Root HTML and React 17 entrypoint.
- MUI theme and Bootstrap base styles.
- React Router 5 route table.
- Public, authenticated, and ADMIN guards.
- Signin/signup foundation with legacy sessionStorage JWT contract.
- Navbar role/session behavior.
- Shared RTK Query API with users, rooms, events, settings, and card operations.
- Redux store with serializable checks disabled.
- Socket.io middleware, durable email room join across reconnects, and events-cache invalidation.
- Protected placeholder shells for calendar, management, report, and profile.

## Phase boundary

Signin/signup are functional foundation forms. Calendar, event modal, DataGrid administration, profile dialogs, and report/export remain Phase 7. Tablet NFC/LED remains separate APK work.

## Verification

- Vite production build succeeds to `build/client`.
- React 17, React Router 5, Redux Toolkit 1.9, MUI 5, and Vite 4 remain installed.
- Local preview launcher resolves project-local Vite CLI without global install.
- SPA fallback returns HTTP 200 for `/`, `/signin`, `/signup`, `/app-management`, `/report`, and `/user/:userId`.
- Immutable `dist/` checksums remain valid.
