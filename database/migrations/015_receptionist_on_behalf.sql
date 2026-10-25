\set ON_ERROR_STOP on

-- Floor business process, phase 1: a receptionist books a room for another
-- employee when that employee's own floor is full.
--
-- The booking stays owned by the employee (tbl_events.organizer_id); booked_by
-- records the account that actually created it, so the audit trail survives and
-- the receptionist can still see and edit the booking they made. Self bookings
-- keep booked_by NULL, which is also why the foreign key uses ON DELETE SET
-- NULL: deleting the receptionist account must not delete the meeting.
BEGIN;

INSERT INTO tbl_role (_id, role_name, is_deleted)
VALUES ('3f6a9c2e-8b41-4d7a-9e52-6c0b8a1d4f73', 'receptionist', false)
ON CONFLICT (_id) DO NOTHING;

ALTER TABLE tbl_events
  ADD COLUMN IF NOT EXISTS booked_by uuid REFERENCES tbl_users (_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tbl_events_booked_by_idx
  ON tbl_events (booked_by);

COMMIT;
