#!/usr/bin/env node
/**
 * Memulihkan akun demo setelah database regresi/reset dimulai ulang.
 * Sengaja bukan bagian dari seed parity supaya data demo tidak memengaruhi
 * perkiraan jumlah user pada tes. Jangan taruh sandi produksi di sini.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Ikut .env.demo supaya koneksi sama seperti demo.
const envText = fs.readFileSync(path.join(root, ".env.demo"), "utf8");
for (const line of envText.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
}

const ROLE_USER = "67e9500b-908a-497d-9d3b-54bc020700cb";
const accounts = [
  // Kartu di sini dummy; UID kartu nyata tidak pernah disimpan di repo dan
  // diatur langsung di DB demo lokal memakai SQL pribadi bila diperlukan.
  { name: "Karyawan Prasada", email: "karyawan@uji.prasada.test", password: "1234", floor: "1", card: "DEMO-PRASADA-CARD" },
  { name: "Karyawan Uji", email: "emp@uji.local", password: "1234", floor: "1", card: "DEMO-UJI-CARD" },
  // Akun karyawan kantor (sandi pendek diharapkan, dibuat lewat skrip: CMS menolak sandi <8).
  { name: "Karyawan Demo", email: "karyawan3@uji.local", password: "1234", floor: "1" },
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
  const { rows } = await client.query("SELECT _id FROM tbl_role WHERE lower(role_name) = 'user' LIMIT 1");
  const roleId = rows[0]?._id;
  if (!roleId) {
    throw new Error("tbl_role tidak berisi role user; role_id tidak bisa dipasang");
  }

  const bcrypt = (await import("bcrypt")).default;
  for (const account of accounts) {
    const hash = bcrypt.hashSync(account.password, 12);
    await client.query(
      `INSERT INTO tbl_users (name, email, password, type, floor, card_number, role_id, is_deleted)
       VALUES ($1, $2, $3, 'employee', $4, $5, $6, false)
       ON CONFLICT (email) DO UPDATE
         SET password = EXCLUDED.password,
             role_id = EXCLUDED.role_id,
             floor = EXCLUDED.floor,
             card_number = EXCLUDED.card_number,
             is_deleted = false`,
      [account.name, account.email, hash, account.floor, account.card, roleId]
    );
    console.log(`akun siap: ${account.email}`);
  }
} finally {
  await client.end().catch(() => {});
}
