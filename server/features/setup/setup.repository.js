import { query } from "../../db/pool.js";

// The setup state is read as a single row so the service can decide from the
// flag and the presence of an admin in one round trip.
export const getSetupState = async (execute = query) => (await execute(
  `SELECT
     EXISTS (
       SELECT 1
       FROM tbl_app_settings
       WHERE setup_completed IS TRUE
     ) AS setup_completed,
     EXISTS (
       SELECT 1
       FROM tbl_users u
       JOIN tbl_role r ON r._id = u.role_id
       WHERE lower(r.role_name) = 'admin'
         AND u.is_deleted IS NOT TRUE
     ) AS has_admin`
)).rows[0];

// Transactions in the setup service pass their own client as `execute`, so the
// helpers below never open a second connection.
export const findAdminRoleId = async (execute = query) => (await execute(
  `SELECT _id
   FROM tbl_role
   WHERE lower(role_name) = 'admin'
     AND is_deleted IS NOT TRUE
   ORDER BY created_at
   LIMIT 1`
)).rows[0]?._id || null;

export const insertFirstAdmin = async ({ name, email, passwordHash, employeeId, roleId }, execute = query) => (await execute(
  `INSERT INTO tbl_users
     (name, email, password, role_id, employee_id, type, floor, must_change_password, is_deleted)
   VALUES
     ($1, lower($2), $3, $4, $5, 'employee', NULL, false, false)
   RETURNING _id, name, email`,
  [name, email, passwordHash, roleId, employeeId]
)).rows[0];

// Settings are required by the kiosk and the CMS after the first login. A fresh
// database has no row yet, so the defaults below mirror the demo seed values.
export const insertDefaultSettings = async (execute = query) => execute(
  `INSERT INTO tbl_app_settings (
     lock_timer,
     led_timer,
     table_input,
     not_checked_in_time_limit,
     time_of_event_start_soon,
     available_color,
     will_start_color,
     on_meeting_color
   )
   SELECT 5, 5, true, 15, 10, '05', '08', '04'
   WHERE NOT EXISTS (
     SELECT 1 FROM tbl_app_settings
   )`
);

export const markSetupCompleted = async (execute = query) => execute(
  `UPDATE tbl_app_settings
   SET setup_completed = true,
       updated_at = now()`
);

// A second browser racing the first one must wait for the same transaction
// instead of creating a duplicate admin, so the setup transaction takes an
// advisory lock before it reads the state.
export const lockSetup = async (execute = query) => execute(
  "SELECT pg_advisory_xact_lock(hashtext('360booking_initial_setup'))"
);
