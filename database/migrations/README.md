# Migrations

Order:

```text
001_prerequisites.sql
002_tables.sql
003_constraints.sql
004_functions.sql
```

Files are generated mechanically from immutable `bjb.sql`:

```bash
node database/scripts/generate-migrations.mjs
```

Generator verifies expected block counts and removes only legacy `OWNER TO postgres` statements. Generated migrations run as current deployment role.
