# Database import report

Checked: 2026-07-12 against PostgreSQL 14.23 in disposable Docker Compose service `postgres-test`.

## First import

Unmodified `bjb.sql` stopped after its first function:

```text
ERROR: role "postgres" does not exist
```

Cause: dump contains `ALTER ... OWNER TO postgres`, while Compose cluster was initialized only with role `booking_test`.

## Compatibility action

Created non-login owner role inside test cluster:

```sql
CREATE ROLE postgres NOLOGIN;
```

Reset only `360booking_reconstruction_test`, then imported unmodified `bjb.sql` again with `ON_ERROR_STOP=1`.

## Result

Second import completed with exit code 0:

- 7 public tables.
- 28 public functions.
- 9 public constraints.
- All imported tables owned by compatibility role `postgres`.
- No seed/application rows included by dump.

No source SQL modification was required. Production ownership must be decided during migration design; compatibility role exists only to validate legacy dump parity.

## Reproduction

```bash
sg docker -c "docker compose exec -T postgres-test psql \
  -U booking_test -d postgres \
  -c 'CREATE ROLE postgres NOLOGIN;'"

sg docker -c 'docker compose exec -T postgres-test \
  psql -v ON_ERROR_STOP=1 \
  -U booking_test -d 360booking_reconstruction_test' < bjb.sql

sg docker -c 'docker compose exec -T postgres-test \
  psql -v ON_ERROR_STOP=1 \
  -U booking_test -d 360booking_reconstruction_test' \
  < database/tests/001_schema_smoke.sql
```

## Caveats

- Successful creation proves syntax/object dependency compatibility, not business correctness.
- Stored functions still require behavior tests with sanitized fixtures.
- Dump has logical relations but no foreign keys.
- Owner role mismatch must be removed from final migrations.

## Automated validation added

- `database/tests/001_schema_smoke.sql`: passes with 7 tables, 28 functions, and 9 constraints.
- `database/seeds/development.sql`: loads deterministic sanitized fixtures successfully.
- `database/tests/002_core_behavior.sql`: passes settings/listing, master-card validation, NFC check-in, early finish, and organizer cancellation checks. Mutations run inside a rolled-back transaction.

Initial core coverage was partial; expanded function contracts now verify all 28 signatures and execute active server paths.

## Migration reconstruction result

Legacy dump is now represented by four ordered migrations:

- `001_prerequisites.sql`
- `002_tables.sql`
- `003_constraints.sql`
- `004_functions.sql`

They are mechanically generated from `bjb.sql` with legacy ownership clauses removed. Full disposable rebuild succeeds without importing `bjb.sql` and without creating compatibility role `postgres`.

`database/scripts/rebuild-test-db.sh` then loads sanitized fixtures and passes all three SQL suites. Function inventory covers all 28 signatures; active server paths have behavior execution. Three malformed legacy-only functions remain signature-tested and documented as known parity defects.
