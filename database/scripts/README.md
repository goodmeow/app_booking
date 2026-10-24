# Database scripts

Scripts here operate only on the disposable Compose service `postgres-test`.

Run Docker through a login shell after group membership refresh. During the current session, prefix Docker commands with:

```bash
sg docker -c 'docker compose ...'
```

Never adapt reset commands to production or shared databases.

Full disposable rebuild (demo database only):

```bash
database/scripts/rebuild-test-db.sh
```

Script refuses any database name except `360booking_reconstruction_test`,
applies all migrations, loads sanitized seed, then runs every SQL test.

## Operational scripts (production)

The three scripts below are for the production host, not for the disposable
Compose service. Read `docs/operations-runbook.md` section 5 before running
them.

| Script | Purpose |
|---|---|
| `backup-db.sh` | `pg_dump -Fc` + archive check + sha256 + retention + optional rsync |
| `restore-db.sh` | restore a dump into `<db>_restore_test`; production only with `--force` |
| `preflight-import.mjs` | read-only import pre-flight (schema, roles, floors, conflicts) |
| `import-bjb-users.mjs` | user/card executor; legacy update mode and `--fresh` clean-slate mode |
| `import-fresh-assets.mjs` | clean-slate assets: rooms, admin/receptionist, master cards |

Import guard rails: `--apply` requires `IMPORT_TARGET_DB` to match the connected
database and a backup proof (`BACKUP_CONFIRMED=1` or `--backup-file`). The
scripts refuse `bjb`, `bjb_compare`, `360booking_reconstruction_test`, and
`360booking_parity_test`.

### Fresh install (clean slate)

Historical events are **not** migrated. A new server imports 238 employees as
creates (not updates), with cards in the same plan:

```bash
# order: roles -> backup -> preflight -> rooms -> special -> master-cards -> users+cards
node database/scripts/preflight-import.mjs --fresh \
  --plan=integration/plan-import-fresh.local.csv \
  --passwords=integration/plan-password-reset.local.csv \
  --rooms=integration/plan-rooms-fresh.local.csv \
  --special=integration/plan-special-users.local.csv \
  --master-cards=integration/plan-master-cards.local.csv \
  --defaults=integration/.env.import.local

IMPORT_TARGET_DB=360booking node database/scripts/import-fresh-assets.mjs \
  --phase=all --apply --backup-file=<dump> \
  --rooms=... --special=... --master-cards=... --defaults=...

IMPORT_TARGET_DB=360booking node database/scripts/import-bjb-users.mjs \
  --fresh --phase=all --apply --backup-file=<dump> \
  --plan=... --passwords=... --defaults=...
```

`--fresh` is also auto-detected when every plan row has `action=create`. The
legacy plan (`plan-import.local.csv`, 197 update + 41 create) is still supported
for databases that already contain the old BJB users.

Plan files (`integration/*.local.csv`, `integration/.env.import.local`) contain
PII and stay outside the repository. Pass them with `--plan`, `--passwords`,
`--cards`, `--rooms`, `--special`, `--master-cards`, and `--defaults`; never
commit or paste them into logs.


Parity/regression reset (separate database):

```bash
database/scripts/reset-parity-db.sh
```

Script only touches `360booking_parity_test`; it creates the database when
missing, applies migrations + `development.sql` + `parity.sql`, and refuses
the demo database name. The parity/regression harness calls it automatically.
