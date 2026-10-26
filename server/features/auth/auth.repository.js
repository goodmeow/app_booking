import { query } from "../../db/pool.js";

const principalSelect = `
  SELECT
    u._id,
    u.name,
    u.email,
    u.username,
    u.password,
    u.type,
    u.floor,
    u.floors,
    u.is_deleted,
    u.must_change_password,
    lower(r.role_name) AS role
  FROM tbl_users u
  LEFT JOIN tbl_role r ON r._id = u.role_id AND r.is_deleted IS NOT TRUE
`;

export const findPrincipalByLogin = async (login) => {
  const result = await query(
    `${principalSelect}
     WHERE lower(u.email) = lower($1)
        OR (u.username IS NOT NULL AND lower(u.username) = lower($1))
     LIMIT 1`,
    [login]
  );
  return result.rows[0] || null;
};

export const findActivePrincipalById = async (id) => {
  const result = await query(
    `${principalSelect}
     WHERE u._id = $1
       AND u.is_deleted IS NOT TRUE
       AND u.type = 'employee'
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
};

export const createEmployeeAccount = async ({ name, email, username, password }) => {
  const result = await query(
    `INSERT INTO tbl_users (name, email, username, password, role_id, is_deleted, type)
     SELECT $1, lower($2), nullif(btrim($3), ''), $4, r._id, false, 'employee'
     FROM tbl_role r
     WHERE lower(r.role_name) = 'user'
       AND r.is_deleted IS NOT TRUE
     RETURNING _id, name, email, username, type`,
    [name, email, username || null, password]
  );
  if (!result.rows[0]) throw new Error("Default user role is not configured");
  return result.rows[0];
};

export const hasMasterCard = async (cardNumber) => {
  const result = await query(
    `SELECT 1 FROM tbl_card_masters
     WHERE lower(card_number) = lower($1)
     LIMIT 1`,
    [cardNumber]
  );
  return result.rowCount > 0;
};

export const hasDoorCard = async (cardNumber) => {
  const result = await query(
    `SELECT 1
     WHERE EXISTS (
       SELECT 1 FROM tbl_card_masters
       WHERE lower(card_number) = lower($1)
     )
     OR EXISTS (
       SELECT 1
       FROM tbl_user_cards card
       JOIN tbl_users owner ON owner._id = card.user_id
       WHERE card.status = 'active'
         AND lower(btrim(card.card_number)) = lower(btrim($1))
         AND owner.type = 'employee'
         AND owner.is_deleted IS NOT TRUE
     )
     LIMIT 1`,
    [cardNumber]
  );
  return result.rowCount > 0;
};
