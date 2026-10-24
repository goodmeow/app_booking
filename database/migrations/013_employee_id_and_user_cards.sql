\set ON_ERROR_STOP on

-- Two changes that belong together:
--   1. every employee gets a human-readable employee ID,
--   2. a user may hold several NFC cards, but at most two active ones.
--
-- employee_id stays nullable on purpose. Rows created before the API rule
-- existed have no value, and inventing IDs during the migration would make the
-- unique index fail on the second row. The API requires it for every new user
-- and for every edit that supplies it.
BEGIN;

ALTER TABLE tbl_users
  ADD COLUMN IF NOT EXISTS employee_id character varying;

-- Case-insensitive and trimmed, matching what the service writes. The partial
-- predicate keeps legacy rows without an ID out of the index, so they can stay
-- NULL without colliding with each other.
CREATE UNIQUE INDEX IF NOT EXISTS tbl_users_employee_id_lower_key
  ON tbl_users (lower(btrim(employee_id)))
  WHERE coalesce(btrim(employee_id), '') <> '';

-- Cards are never deleted. A reported-lost card keeps its row with status
-- 'lost' and lost_at, so the admin history survives and a replacement card can
-- be issued without reusing the number. Only 'active' cards open a door or a
-- kiosk action.
CREATE TABLE IF NOT EXISTS tbl_user_cards (
  _id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_number character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'active',
  lost_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tbl_user_cards_user_fk
    FOREIGN KEY (user_id) REFERENCES tbl_users (_id) ON DELETE CASCADE,
  CONSTRAINT tbl_user_cards_status_check
    CHECK (status IN ('active', 'lost'))
);

-- One physical card belongs to one user at a time, whatever the letter case;
-- the kiosk sends the UID exactly as the reader reported it.
CREATE UNIQUE INDEX IF NOT EXISTS tbl_user_cards_card_number_key
  ON tbl_user_cards (lower(btrim(card_number)));

CREATE INDEX IF NOT EXISTS tbl_user_cards_user_id_idx
  ON tbl_user_cards (user_id);

-- Move the single legacy card of each employee into the new table. The old
-- column is left untouched (nothing deletes data in a migration) but no query
-- reads it any more after this file. ON CONFLICT keeps the migration usable on
-- a database where the same card number was already entered twice.
INSERT INTO tbl_user_cards (user_id, card_number, status)
SELECT u._id, btrim(u.card_number), 'active'
FROM tbl_users u
WHERE coalesce(btrim(u.card_number), '') <> ''
  AND u.type = 'employee'
ORDER BY u.created_at
ON CONFLICT DO NOTHING;

COMMIT;
