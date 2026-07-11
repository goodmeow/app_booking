# Database reconstruction

This directory will replace the monolithic `bjb.sql` dump with reproducible migrations, sanitized seeds, and behavior tests.

## Safety boundary

Use a dedicated disposable PostgreSQL database. Never run reconstruction imports or destructive tests against production, staging, or a shared database.

Expected test database:

```text
360booking_reconstruction_test
```

Copy `.env.test.example` to `.env.test` and set local credentials. `.env.test` is ignored by Git.

## Compose test database

```bash
docker compose up -d postgres-test
docker compose ps
```

Host connection: `127.0.0.1:54320`. Container name: `360booking-postgres-test`.

Destroy disposable data when a clean cluster is required:

```bash
docker compose down -v
```

## Required tools

- PostgreSQL 14 server or compatible container.
- `psql`, `pg_isready`, `createdb`, `dropdb`, `pg_dump`, and `pg_restore`.
- PostgreSQL user allowed to create tables and PL/pgSQL functions.

Current workspace readiness is recorded in `docs/reconstruction/phase3-readiness.md`.

## Planned workflow

1. Create disposable database.
2. Import root `bjb.sql` unchanged and capture errors.
3. Verify seven tables, constraints, and stored functions.
4. Add behavior tests before changing SQL.
5. Split dump into ordered migrations.
6. Add sanitized development/test seeds.
7. Rebuild database from migrations and rerun tests.

Run complete workflow:

```bash
database/scripts/rebuild-test-db.sh
```

## Directory contract

```text
database/
├── migrations/  # Ordered schema/function migrations
├── seeds/       # Sanitized, non-production fixtures
└── tests/       # SQL behavior and regression tests
```

`bjb.sql` remains immutable evidence until parity tests pass.
