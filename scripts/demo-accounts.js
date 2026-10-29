#!/usr/bin/env node
/**
 * Restores the demo accounts after the regression/reset database is restarted.
 * Deliberately not part of the parity seed, so demo data does not affect the
 * expected user count in tests. Do not put production passwords here.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Follows .env.demo so the connection matches the demo.
const envText = fs.readFileSync(path.join(root, ".env.demo"), "utf8");
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const accounts = [
  // Cards here are dummies; real card UIDs are never stored in the repo and are
  // set directly in the local demo DB with private SQL when needed.
  { employeeId: "EMP-PRASADA", name: "Karyawan Prasada", email: "karyawan@uji.prasada.test", password: "1234", floor: "1", card: "DEMO-PRASADA-CARD" },
  { employeeId: "EMP-UJI", name: "Karyawan Uji", email: "emp@uji.local", password: "1234", floor: "1", card: "DEMO-UJI-CARD" },
  // Third demo account, used when a demo needs a second office employee.
  { employeeId: "EMP-DEMO-3", name: "Karyawan Demo", email: "karyawan3@uji.local", password: "1234", floor: "1" },
];

const client = new Client({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT || 54320),
  user: process.env.PGUSER || "booking_test",
  password: process.env.PGPASSWORD || "booking_test_local_only",
  database: process.env.PGDATABASE || "360booking_reconstruction_test",
});

try {
  await client.connect();
  const { rows } = await client.query(
    `SELECT _id
     FROM tbl_role
     WHERE lower(role_name) = 'user'
     LIMIT 1`
  );
  const roleId = rows[0]?._id;
  if (!roleId) {
    throw new Error("tbl_role has no user role; role_id cannot be set");
  }

  const bcrypt = (await import("bcrypt")).default;
  for (const account of accounts) {
    const hash = bcrypt.hashSync(account.password, 12);
    // Cards live in tbl_user_cards; the legacy card_number column is cleared so
    // a rebuilt demo never reintroduces a second source of truth.
    const { rows: [user] } = await client.query(
      `INSERT INTO tbl_users (name, email, password, type, floor, employee_id, role_id, is_deleted)
       VALUES ($1, $2, $3, 'employee', $4, $5, $6, false)
       ON CONFLICT (email) DO UPDATE
         SET password = EXCLUDED.password,
             role_id = EXCLUDED.role_id,
             floor = EXCLUDED.floor,
             employee_id = EXCLUDED.employee_id,
             card_number = NULL,
             is_deleted = false
       RETURNING _id`,
      [account.name, account.email, hash, account.floor, account.employeeId, roleId]
    );
    if (account.card) {
      await client.query(
        `INSERT INTO tbl_user_cards (user_id, card_number, status)
         VALUES ($1, $2, 'active')
         ON CONFLICT (lower(btrim(card_number))) DO UPDATE
           SET status = 'active',
               lost_at = NULL,
               updated_at = now()
           WHERE tbl_user_cards.user_id = EXCLUDED.user_id`,
        [user._id, account.card]
      );
    }
    console.log(`account ready: ${account.email}`);
  }
} finally {
  await client.end().catch(() => {});
}
