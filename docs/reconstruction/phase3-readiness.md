# Phase 3 readiness

Checked: 2026-07-12, Asia/Jakarta.

## Workspace status

- `bjb.sql`: available.
- Database map and API traceability: available under `docs/reconstruction/`.
- `.env.test.example`: prepared with disposable database name.
- Migration, seed, and test directories: prepared.
- PostgreSQL CLI tools: available inside Compose container.
- Docker: `29.6.1`.
- Docker Compose: `5.3.1`.
- Podman: missing.
- PostgreSQL: `14.23` from `postgres:14-alpine`.
- Running disposable PostgreSQL instance: healthy on `127.0.0.1:54320`.

## Session note

User belongs to the `docker` group, but current shell session predates that membership. Use `sg docker -c 'docker compose ...'` until logout/login refreshes supplementary groups.

Verified commands:

```bash
sg docker -c 'docker compose exec -T postgres-test psql --version'
sg docker -c 'docker compose exec -T postgres-test pg_isready -U booking_test -d 360booking_reconstruction_test'
```

Unmodified `bjb.sql` imports successfully after adding non-login compatibility owner role `postgres`. Schema smoke target: 7 tables, 28 functions, 9 constraints. See `database-import-report.md`.

## Completion

- Ordered migrations generated and verified.
- Clean rebuild no longer requires direct `bjb.sql` import.
- Sanitized deterministic seed loads successfully.
- Schema, core behavior, and function contract suites pass.
- Rebuild automation refuses unexpected database names.
