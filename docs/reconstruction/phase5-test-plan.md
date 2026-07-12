# Phase 5 server parity test plan

## Harness decision

Use native `node:test`, built-in `fetch`, child-process servers, existing `socket.io-client`, and serial database resets. No new dependency required.

Targets:

- Legacy bundle copied byte-for-byte to ignored `build/parity/legacy.bundle.cjs`, port 5101.
- Reconstructed source `server/server.js`, port 5102.
- Shared disposable PostgreSQL 14 database, reset before each mutation scenario.

Never modify or execute baseline `dist/server/server.bundle.js` in-place.

## Coverage target

- 32 HTTP endpoints.
- Public, missing-token, invalid-token, ADMIN, USER, self, and other-user authorization.
- Success, validation, database error, and documented legacy-defect branches.
- Response status, JSON shape/value, cookie behavior, and database snapshot.
- Six HTTP-triggered Socket.io broadcasts.
- `room:join`, arbitrary unauthenticated joins, recipient isolation, union deduplication, and three inactive inbound event names.

## Normalization

Compare generated JWT, UUID, timestamp, bcrypt, and ordering-sensitive fields semantically rather than byte-for-byte. Do not normalize stable fixture IDs or meaningful payload differences.

## Execution order

1. Reset parity database.
2. Run public/read-only scenarios on legacy and reconstructed targets.
3. For every mutation: reset, run legacy, capture response/database; reset, run reconstructed, compare.
4. Run Socket.io scenarios with listeners attached before HTTP trigger.
5. Publish endpoint matrix and parity report.

## Prepared assets

- `database/scripts/reset-parity-db.sh`
- `database/seeds/parity.sql`
- `server/tests/parity/harness.js`
- `server/tests/parity/fixtures.js`
- `server/tests/parity/prepare.test.js`

## Known assertions

- Seed signin password: `ParityTest123!`.
- Legacy signup role UUID is seeded.
- Filtered `users_list` failure remains expected.
- Containing-event room overlap remains expected.
- Any authenticated user can read another user.
- Settings/card mutations require JWT but not ADMIN.
- Socket connection and arbitrary room join require no authentication.

## Execution result

Differential suite passes 12/12 tests. See `server-parity-report.md`.
