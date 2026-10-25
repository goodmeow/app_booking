# Migrations

Order:

```text
001_prerequisites.sql
002_tables.sql
003_constraints.sql
004_functions.sql
005_phase9_identity.sql
006_phase9_scheduler.sql
007_phase10a_kiosk_devices.sql
008_kiosk_capabilities.sql
009_room_role_separation.sql
010_kiosk_led_default.sql
```

Files are generated mechanically from immutable `bjb.sql`:

```bash
node database/scripts/generate-migrations.mjs
```

Generator verifies expected block counts and removes only legacy `OWNER TO postgres` statements. First four files are generated from immutable dump; later phase migrations are maintained source files. All run as current deployment role.
