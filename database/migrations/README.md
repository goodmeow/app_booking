# Migrations

Order:

```text
001_prerequisites.sql
002_tables.sql
003_constraints.sql
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
029_kiosk_action_toggles.sql
030_drop_legacy_functions.sql
```

Numbers 027 and 028 are reserved for the face-unlock branch, so the list skips them.

The first three files (001-003) were generated once from the immutable `bjb.sql`
dump, which is no longer part of the repo, so those files are now maintained as
source. `database/scripts/generate-migrations.mjs` is kept for reference only and
no longer emits a functions file. Every file runs as the current deployment role.

The 28 legacy PL/pgSQL functions from `bjb.sql` are no longer shipped: the server
does all data access through SQL repositories. `030_drop_legacy_functions.sql`
removes them from databases that already applied the old `004_functions.sql`.
