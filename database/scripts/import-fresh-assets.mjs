#!/usr/bin/env node
// Clean-slate assets for 360 Scheduler: rooms, admin/receptionist accounts, and
// the door master-card list. Users and their cards are handled by
// import-bjb-users.mjs --fresh; this script only covers the assets that are not
// part of the 238-employee plan.
//
// Default is a dry-run. `--apply` needs IMPORT_TARGET_DB and backup proof,
// exactly like the user importer.
//
//   node database/scripts/import-fresh-assets.mjs --phase=all --plan ...
//   IMPORT_TARGET_DB=360booking node database/scripts/import-fresh-assets.mjs \
//     --phase=all --apply --backup-file=/var/backups/360booking/....dump ...

import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import bcrypt from "bcrypt";
import pg from "pg";
import {
  FatalError,
  assertApplyTarget,
  assertBackupProof,
  assertDatabaseNameAllowed,
  csvEscape,
  maskCardNumber,
  maskEmail,
  parseOptions,
  readDefaultPassword,
  readMasterCardPlan,
  readRoomPlan,
  readSpecialUserPlan,
  validateDefaultPassword,
} from "./lib/import-plan.mjs";

const { Client } = pg;

const BCRYPT_COST = 12;
const PHASES = ["rooms", "special", "master-cards"];
const DEFAULT_ROOMS = "integration/plan-rooms-fresh.local.csv";
const DEFAULT_SPECIAL = "integration/plan-special-users.local.csv";
const DEFAULT_MASTER_CARDS = "integration/plan-master-cards.local.csv";
const DEFAULT_DEFAULTS = "integration/.env.import.local";

const USAGE = `Usage: node database/scripts/import-fresh-assets.mjs [options]

Options:
  --phase=rooms|special|master-cards|all   Phase to run (default: all)
  --apply                                  Write changes; without it the run is a dry-run
  --rooms=PATH                             room plan CSV (default: ${DEFAULT_ROOMS})
  --special=PATH                           admin/receptionist CSV (default: ${DEFAULT_SPECIAL})
  --master-cards=PATH                      master-card CSV (default: ${DEFAULT_MASTER_CARDS})
  --defaults=PATH                          env file with DEFAULT_PASSWORD (default: ${DEFAULT_DEFAULTS})
  --report=PATH                            local .json or .csv report (default: temp dir)
  --backup-file=PATH                       dump used as backup proof for --apply
  --help                                   Show this text

Database comes from PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.
--apply additionally requires:
  * IMPORT_TARGET_DB equal to the connected database name,
  * BACKUP_CONFIRMED=1 or --backup-file pointing at a non-empty pg_dump archive.

Refused databases: bjb, bjb_compare, 360booking_reconstruction_test,
360booking_parity_test.

Run order: rooms -> special -> master-cards -> users/cards (import-bjb-users).
Historical events are not migrated; the target starts empty.
`;

const optionSpec = {
  phase: "value",
  apply: "flag",
  rooms: "value",
  special: "value",
  "master-cards": "value",
  defaults: "value",
  report: "value",
  "backup-file": "value",
};

const fail = (message) => {
  throw new FatalError(message);
};

const queryOne = async (client, text, values = []) => {
  const result = await client.query(text, values);
  return result.rows[0] ?? null;
};

const findUserByEmail = (client, email) =>
  queryOne(
    client,
    `SELECT _id, name, email, type, employee_id, floor, capacity, building, feature,
            role_id, must_change_password, password, is_deleted
       FROM tbl_users
      WHERE lower(btrim(email)) = lower(btrim($1))
      ORDER BY (is_deleted IS TRUE), created_at
      LIMIT 1`,
    [email],
  );

const findEmployeeIdOwner = (client, employeeId) =>
  queryOne(
    client,
    `SELECT _id, email
       FROM tbl_users
      WHERE lower(btrim(employee_id)) = lower(btrim($1))
        AND coalesce(btrim(employee_id), '') <> ''
      ORDER BY (is_deleted IS TRUE)
      LIMIT 1`,
    [employeeId],
  );

const findRoleId = (client, roleName) =>
  queryOne(
    client,
    `SELECT _id
       FROM tbl_role
      WHERE lower(role_name) = lower($1)
        AND coalesce(is_deleted, false) = false
      LIMIT 1`,
    [roleName],
  );

const findMasterCard = (client, cardNumber) =>
  queryOne(
    client,
    `SELECT _id, card_number
       FROM tbl_card_masters
      WHERE lower(btrim(card_number)) = lower(btrim($1))
      LIMIT 1`,
    [cardNumber],
  );

const normalizedText = (value) => String(value ?? "").trim();

const roomMatchesPlan = (user, row) =>
  normalizedText(user.name) === row.name &&
  normalizedText(user.floor) === row.floor &&
  normalizedText(user.capacity) === row.capacity &&
  normalizedText(user.building) === row.building &&
  normalizedText(user.feature) === row.feature;

const createSummary = (phase) => ({
  phase,
  ok: 0,
  skipped: 0,
  error: 0,
  rows: [],
});

const addResult = (summary, { item, status, reason, cardNumber }) => {
  summary[status] += 1;
  summary.rows.push({
    phase: summary.phase,
    row: item.rowNumber,
    email_masked: maskEmail(item.email),
    card_masked: cardNumber ? maskCardNumber(cardNumber) : "",
    status,
    reason,
  });
};

const runRoomsPhase = async (client, { apply, roomRows, defaultPassword }) => {
  const summary = createSummary("rooms");

  for (const row of roomRows) {
    const existing = await findUserByEmail(client, row.email);

    if (existing) {
      if (existing.is_deleted) {
        addResult(summary, { item: row, status: "error", reason: "user-deleted" });
        continue;
      }
      if (existing.type !== "room") {
        addResult(summary, { item: row, status: "error", reason: "email-taken-by-non-room" });
        continue;
      }
      if (roomMatchesPlan(existing, row)) {
        addResult(summary, { item: row, status: "skipped", reason: "already-imported" });
        continue;
      }

      if (apply) {
        await client.query(
          `UPDATE tbl_users
              SET name = $1,
                  floor = nullif($2, ''),
                  capacity = nullif($3, ''),
                  building = nullif($4, ''),
                  feature = nullif($5, ''),
                  updated_at = now()
            WHERE _id = $6 AND type = 'room'`,
          [row.name, row.floor, row.capacity, row.building, row.feature, existing._id],
        );
      }
      addResult(summary, { item: row, status: "ok", reason: "updated" });
      continue;
    }

    if (apply) {
      const passwordHash = await bcrypt.hash(validateDefaultPassword(defaultPassword), BCRYPT_COST);
      await client.query(
        `INSERT INTO tbl_users
           (name, email, password, role_id, employee_id, type, floor, capacity,
            building, feature, must_change_password, is_deleted)
         VALUES
           ($1, lower($2), $3, NULL, NULL, 'room', $4, nullif($5, ''),
            nullif($6, ''), nullif($7, ''), $8, false)`,
        [row.name, row.email, passwordHash, row.floor, row.capacity, row.building, row.feature, row.mustChangePassword],
      );
    }
    addResult(summary, { item: row, status: "ok", reason: "created" });
  }

  return summary;
};

const runSpecialPhase = async (client, { apply, specialRows, defaultPassword }) => {
  const summary = createSummary("special");
  const roleCache = new Map();

  const roleIdFor = async (roleName) => {
    if (!roleCache.has(roleName)) {
      const role = await findRoleId(client, roleName);
      if (!role) fail(`Role "${roleName}" is missing from tbl_role`);
      roleCache.set(roleName, role._id);
    }
    return roleCache.get(roleName);
  };

  for (const row of specialRows) {
    const roleId = await roleIdFor(row.role);
    const existing = await findUserByEmail(client, row.email);

    if (existing) {
      if (existing.is_deleted) {
        addResult(summary, { item: row, status: "error", reason: "user-deleted" });
        continue;
      }
      if (existing.type !== "employee") {
        addResult(summary, { item: row, status: "error", reason: "email-taken-by-non-employee" });
        continue;
      }

      const owner = await findEmployeeIdOwner(client, row.employeeId);
      if (owner && owner._id !== existing._id) {
        addResult(summary, { item: row, status: "error", reason: "employee-id-taken" });
        continue;
      }

      const sameIdentity =
        normalizedText(existing.employee_id).toLowerCase() === row.employeeId.toLowerCase() &&
        normalizedText(existing.floor) === row.floor &&
        String(existing.role_id ?? "") === String(roleId) &&
        Boolean(existing.must_change_password) === row.mustChangePassword;

      if (sameIdentity) {
        addResult(summary, { item: row, status: "skipped", reason: "already-imported" });
        continue;
      }

      if (apply) {
        await client.query(
          `UPDATE tbl_users
              SET employee_id = $1,
                  role_id = $2,
                  floor = nullif($3, ''),
                  must_change_password = $4,
                  updated_at = now()
            WHERE _id = $5 AND type = 'employee'`,
          [row.employeeId, roleId, row.floor, row.mustChangePassword, existing._id],
        );
      }
      addResult(summary, { item: row, status: "ok", reason: "updated" });
      continue;
    }

    const owner = await findEmployeeIdOwner(client, row.employeeId);
    if (owner) {
      addResult(summary, { item: row, status: "error", reason: "employee-id-taken" });
      continue;
    }

    if (apply) {
      const passwordHash = await bcrypt.hash(validateDefaultPassword(defaultPassword), BCRYPT_COST);
      await client.query(
        `INSERT INTO tbl_users
           (name, email, password, role_id, employee_id, type, floor,
            must_change_password, is_deleted)
         VALUES
           ($1, lower($2), $3, $4, $5, 'employee', nullif($6, ''), $7, false)`,
        [row.name, row.email, passwordHash, roleId, row.employeeId, row.floor, row.mustChangePassword],
      );
    }
    addResult(summary, { item: row, status: "ok", reason: "created" });
  }

  return summary;
};

const runMasterCardPhase = async (client, { apply, masterCardRows }) => {
  const summary = createSummary("master-cards");

  for (const row of masterCardRows) {
    const existing = await findMasterCard(client, row.cardNumber);
    if (existing) {
      addResult(summary, {
        item: row,
        status: "skipped",
        reason: "already-present",
        cardNumber: row.cardNumber,
      });
      continue;
    }

    if (apply) {
      await client.query(
        `INSERT INTO tbl_card_masters (card_number, created_by)
         VALUES ($1, NULL)
         ON CONFLICT (card_number) DO NOTHING`,
        [row.cardNumber],
      );
    }
    addResult(summary, { item: row, status: "ok", reason: "inserted", cardNumber: row.cardNumber });
  }

  return summary;
};

const executePhase = async (client, phase, context) => {
  switch (phase) {
    case "rooms":
      return runRoomsPhase(client, context);
    case "special":
      return runSpecialPhase(client, context);
    case "master-cards":
      return runMasterCardPhase(client, context);
    default:
      fail(`Unknown phase: ${phase}`);
  }
};

const runPhaseInTransaction = async (client, phase, context) => {
  await client.query("BEGIN");
  try {
    const summary = await executePhase(client, phase, context);
    await client.query("COMMIT");
    return summary;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};

const buildReportPath = (option) => {
  if (option) return path.resolve(option);
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\..+$/, "");
  return path.join(tmpdir(), `360booking-fresh-assets-${stamp}.local.json`);
};

const writeReport = async (reportPath, report) => {
  if (reportPath.toLowerCase().endsWith(".csv")) {
    const rows = report.phases.flatMap((phase) => phase.rows);
    const columns = ["phase", "row", "email_masked", "card_masked", "status", "reason"];
    const lines = [columns.join(",")];
    for (const row of rows) {
      lines.push(columns.map((column) => csvEscape(row[column])).join(","));
    }
    await writeFile(reportPath, `${lines.join("\n")}\n`, { mode: 0o600 });
    return;
  }

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
};

const printSummary = (summary) => {
  console.log(`  [${summary.phase}] ok=${summary.ok} skipped=${summary.skipped} error=${summary.error}`);
  const errors = summary.rows.filter((row) => row.status === "error");
  for (const row of errors.slice(0, 10)) {
    console.log(`    row ${row.row} ${row.email_masked}: ${row.reason}`);
  }
  if (errors.length > 10) {
    console.log(`    ... ${errors.length - 10} more error(s); see the report`);
  }
};

const main = async () => {
  const options = parseOptions(process.argv.slice(2), optionSpec);
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const phase = options.phase ?? "all";
  if (phase !== "all" && !PHASES.includes(phase)) {
    fail(`Unknown --phase "${phase}"; use ${PHASES.join(", ")} or all`);
  }
  const apply = options.apply === true;
  const phasesToRun = phase === "all" ? PHASES : [phase];

  const defaultsPath = options.defaults ?? DEFAULT_DEFAULTS;
  const defaultPassword = await readDefaultPassword(defaultsPath);

  const roomRows = phasesToRun.includes("rooms") ? await readRoomPlan(options.rooms ?? DEFAULT_ROOMS) : [];
  const specialRows = phasesToRun.includes("special")
    ? await readSpecialUserPlan(options.special ?? DEFAULT_SPECIAL)
    : [];
  const masterCardRows = phasesToRun.includes("master-cards")
    ? await readMasterCardPlan(options["master-cards"] ?? DEFAULT_MASTER_CARDS)
    : [];

  const client = new Client({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    application_name: "360booking-fresh-assets",
  });

  await client.connect();

  let databaseName;
  try {
    databaseName = (await client.query("SELECT current_database() AS name")).rows[0].name;
    assertDatabaseNameAllowed(databaseName);

    let backupProof = "";
    if (apply) {
      assertApplyTarget(databaseName);
      backupProof = await assertBackupProof(options["backup-file"]);
    } else {
      await client.query("SET default_transaction_read_only = on");
    }

    console.log(
      `${apply ? "APPLY" : "DRY-RUN"} target=${databaseName} phase=${phase}` +
        (backupProof ? ` backup-proof=${backupProof}` : ""),
    );
    console.log(`rooms=${roomRows.length} special=${specialRows.length} master-cards=${masterCardRows.length}`);

    const context = { apply, roomRows, specialRows, masterCardRows, defaultPassword };
    const summaries = [];

    for (const currentPhase of phasesToRun) {
      const summary = apply
        ? await runPhaseInTransaction(client, currentPhase, context)
        : await executePhase(client, currentPhase, context);
      summaries.push(summary);
      printSummary(summary);

      if (apply && summary.error > 0) {
        console.error(
          `Stopping after phase "${currentPhase}" because it reported ${summary.error} error(s); ` +
            "fix the rows and run again (the script is idempotent).",
        );
        break;
      }
    }

    const report = {
      generated_at: new Date().toISOString(),
      mode: apply ? "apply" : "dry-run",
      database: databaseName,
      phase,
      backup_proof: backupProof || null,
      totals: {
        ok: summaries.reduce((sum, summary) => sum + summary.ok, 0),
        skipped: summaries.reduce((sum, summary) => sum + summary.skipped, 0),
        error: summaries.reduce((sum, summary) => sum + summary.error, 0),
      },
      phases: summaries,
    };

    const reportPath = buildReportPath(options.report);
    await writeReport(reportPath, report);
    console.log(`Report: ${reportPath} (masked e-mail addresses and card endings only)`);

    return report.totals.error > 0 ? 1 : 0;
  } finally {
    await client.end();
  }
};

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    if (error instanceof FatalError) {
      console.error(`FATAL: ${error.message}`);
      process.exitCode = 2;
      return;
    }
    console.error(`FATAL: ${error.message}`);
    if (error?.code) console.error(`PostgreSQL code: ${error.code}`);
    process.exitCode = 2;
  });
