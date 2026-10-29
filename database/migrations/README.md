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
011_kiosk_show_subject.sql
012_series_monthly_cadence.sql
013_employee_id_and_user_cards.sql
014_self_signup_toggle.sql
015_receptionist_on_behalf.sql
016_must_change_password.sql
017_initial_setup.sql
018_week_start_day.sql
019_branding.sql
020_backup_settings.sql
021_protect_setup_admin.sql
022_role_menu_access.sql
023_user_floors.sql
024_audit_log.sql
025_user_token_version.sql
026_event_room_timezone.sql
```

Files are generated mechanically from immutable `bjb.sql`:

```bash
node database/scripts/generate-migrations.mjs
```

Generator verifies expected block counts and removes only legacy `OWNER TO postgres` statements. First four files are generated from immutable dump; later phase migrations are maintained source files. All run as current deployment role.
