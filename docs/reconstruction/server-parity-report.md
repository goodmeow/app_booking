# Server parity report

Checked: 2026-07-12 against legacy baseline bundle and reconstructed source using PostgreSQL 14 disposable fixtures.

## Result

```text
tests: 12
pass: 12
fail: 0
cancelled: 0
```

Command:

```bash
npm run test:server:parity
```

## Differential coverage

- All 32 endpoint method/path combinations exist.
- Public versus JWT-protected boundary matches.
- Successful signin response, JWT claims shape, and cookie behavior match.
- Users, rooms, room detail, settings, card-master, event details, and usage-report reads match.
- Cross-user read, USER room-create denial, and USER report denial match.
- Authenticated non-admin settings update matches, including database snapshot.
- Master-card door validation matches.
- Event check-in, early finish, and organizer cancellation responses/database mutations match.
- Unauthenticated Socket.io connection and arbitrary `room:join` match.
- `response:setting` room broadcast matches.

## Isolation and normalization

- Legacy bundle runs from byte-copy `build/parity/legacy.bundle.cjs`; immutable `dist/` is not modified.
- Every mutation target gets a fresh migration/seed reset.
- Servers run serially for mutation comparison and on separate ports.
- Only generated JWT and non-null runtime timestamps are normalized.
- Stable fixture UUIDs are compared exactly.

## Preserved legacy behavior

Parity success does not imply security approval. Tests preserve known behavior including non-admin settings mutation and unauthenticated Socket.io room joins. Hardening remains a separate phase.

## Scope boundary

Route boundary matrix covers every endpoint. Deep success/error combinations focus on authentication, representative reads, authorization, settings, door access, event lifecycle, database snapshots, and Socket.io delivery. Additional endpoint-specific regression cases can grow during frontend reconstruction without blocking source baseline acceptance.
