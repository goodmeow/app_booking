#!/usr/bin/env node
// BJB -> 360 Scheduler user import executor.
//
// Default is a dry-run: every phase reads and validates, nothing is written.
// `--apply` needs BOTH an explicit IMPORT_TARGET_DB and proof of a backup.
//
//   node database/scripts/import-bjb-users.mjs --phase=update --plan=...
//   IMPORT_TARGET_DB=360booking BACKUP_CONFIRMED=1 \
//     node database/scripts/import-bjb-users.mjs --phase=all --apply ...
//
// Plan files contain PII. They live outside the repository and are passed by
// path; this script never prints full e-mail addresses, card numbers, passwords,
// or hashes.

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
  buildCardItems,
  csvEscape,
  detectFreshPlan,
  maskCardNumber,
  maskEmail,
  normalizeCardNumber,
  normalizeEmail,
  normalizeEmployeeId,
  parseOptions,
  readCardChangePlan,
  readDefaultPassword,
  readImportPlan,
  readPasswordResetPlan,
  validateDefaultPassword,
} from "./lib/import-plan.mjs";

const { Client } = pg;

const BCRYPT_COST = 12;
const ACTIVE_CARD_LIMIT = 2;
const PHASES = ["update", "create", "cards", "passwords"];
const DEFAULT_PLAN = "integration/plan-import.local.csv";
const DEFAULT_PASSWORDS = "integration/plan-password-reset.local.csv";
const DEFAULT_CARDS = "integration/plan-card-changes.local.csv";
const DEFAULT_DEFAULTS = "integration/.env.import.local";

const USAGE = `Usage: node database/scripts/import-bjb-users.mjs [options]

Options:
  --phase=update|create|cards|passwords|all   Phase to run (default: all)
  --fresh                                     Clean-slate plan: every row is a create.
                                              Auto-detected when the plan has only creates.
  --apply                                     Write changes; without it the run is a dry-run
  --plan=PATH                                 plan-import CSV (default: ${DEFAULT_PLAN})
  --passwords=PATH                            password-reset CSV (default: ${DEFAULT_PASSWORDS})
  --cards=PATH                                card-changes CSV (default: ${DEFAULT_CARDS}; unused in fresh)
  --defaults=PATH                             env file with DEFAULT_PASSWORD (default: ${DEFAULT_DEFAULTS})
  --report=PATH                               local .json or .csv report (default: temp dir)
  --backup-file=PATH                          dump used as backup proof for --apply
  --help                                      Show this text

Database comes from PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE.
--apply additionally requires:
  * IMPORT_TARGET_DB equal to the connected database name,
  * BACKUP_CONFIRMED=1 or --backup-file pointing at a non-empty file.

Refused databases: bjb, bjb_compare, 360booking_reconstruction_test,
360booking_parity_test.
`;

const optionSpec = {
  phase: "value",
  fresh: "flag",
  apply: "flag",
  plan: "value",
  passwords: "value",
  cards: "value",
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
    `SELECT _id, email, name, type, employee_id, floor, must_change_password, password, is_deleted
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

const findCard = (client, cardNumber) =>
  queryOne(
    client,
    `SELECT _id, user_id, card_number, status, lost_at
       FROM tbl_user_cards
      WHERE lower(btrim(card_number)) = lower(btrim($1))
      LIMIT 1`,
    [cardNumber],
  );

const listActiveCards = async (client, userId) => {
  const result = await client.query(
    `SELECT _id, card_number
       FROM tbl_user_cards
      WHERE user_id = $1 AND status = 'active'`,
    [userId],
  );
  return result.rows;
};

const findUserRoleId = (client) =>
  queryOne(
    client,
    `SELECT _id
       FROM tbl_role
      WHERE lower(role_name) = 'user'
        AND coalesce(is_deleted, false) = false
      LIMIT 1`,
  );

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
    employee_id: item.employeeId ?? "",
    email_masked: maskEmail(item.email),
    card_masked: cardNumber ? maskCardNumber(cardNumber) : "",
    status,
    reason,
  });
};

const runUpdatePhase = async (client, { apply, planRows }) => {
  const summary = createSummary("update");

  for (const row of planRows) {
    if (row.action !== "update") continue;

    const user = await findUserByEmail(client, row.email);
    if (!user) {
      addResult(summary, { item: row, status: "error", reason: "user-not-found" });
      continue;
    }
    if (user.is_deleted) {
      addResult(summary, { item: row, status: "error", reason: "user-deleted" });
      continue;
    }
    if (user.type !== "employee") {
      addResult(summary, { item: row, status: "error", reason: "not-an-employee" });
      continue;
    }

    const sameEmployeeId = normalizeEmployeeId(user.employee_id) === normalizeEmployeeId(row.employeeId);
    const sameFloor = String(user.floor ?? "").trim() === row.floor;

    if (sameEmployeeId && sameFloor) {
      addResult(summary, { item: row, status: "skipped", reason: "already-applied" });
      continue;
    }

    const owner = await findEmployeeIdOwner(client, row.employeeId);
    if (owner && owner._id !== user._id) {
      addResult(summary, { item: row, status: "error", reason: "employee-id-taken" });
      continue;
    }

    if (apply) {
      await client.query(
        `UPDATE tbl_users
            SET employee_id = $1,
                floor = $2,
                updated_at = now()
          WHERE _id = $3`,
        [row.employeeId, row.floor, user._id],
      );
    }

    const reason = !sameEmployeeId ? "employee-id-and-floor-set" : "floor-set";
    addResult(summary, { item: row, status: "ok", reason });
  }

  return summary;
};

const runCreatePhase = async (client, { apply, planRows, defaultPassword }) => {
  const summary = createSummary("create");
  const userRole = await findUserRoleId(client);
  if (!userRole) fail("Role 'user' is missing from tbl_role");

  for (const row of planRows) {
    if (row.action !== "create") continue;

    const existing = await findUserByEmail(client, row.email);
    if (existing) {
      const sameEmployeeId = normalizeEmployeeId(existing.employee_id) === normalizeEmployeeId(row.employeeId);
      if (!existing.is_deleted && sameEmployeeId) {
        addResult(summary, { item: row, status: "skipped", reason: "already-imported" });
      } else {
        addResult(summary, { item: row, status: "error", reason: "email-exists" });
      }
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
           ($1, lower($2), $3, $4, $5, 'employee', $6, true, false)`,
        [row.name, row.email, passwordHash, userRole._id, row.employeeId, row.floor],
      );
    }

    addResult(summary, { item: row, status: "ok", reason: "created" });
  }

  return summary;
};

const runCardPhase = async (client, { apply, cardItems, pendingCreateEmails }) => {
  const summary = createSummary("cards");

  for (const item of cardItems) {
    const user = await findUserByEmail(client, item.email);
    if (!user || user.is_deleted) {
      if (!user && pendingCreateEmails.has(normalizeEmail(item.email))) {
        // Dry-run only: the create phase would have inserted this user before
        // the cards phase, so this card is planned, not a conflict.
        addResult(summary, { item, status: "ok", reason: "would-insert-after-create" });
      } else {
        addResult(summary, { item, status: "error", reason: "user-not-found" });
      }
      continue;
    }
    if (user.type !== "employee") {
      addResult(summary, { item, status: "error", reason: "not-an-employee" });
      continue;
    }

    let newCard = await findCard(client, item.newCardNumber);
    if (newCard && newCard.user_id !== user._id) {
      addResult(summary, {
        item,
        status: "error",
        reason: "new-card-owned-by-other-user",
        cardNumber: item.newCardNumber,
      });
      continue;
    }

    let activeCards = await listActiveCards(client, user._id);
    let activeCount = activeCards.length;
    let oldCardReason = "";

    if (item.action === "replace") {
      if (
        item.oldCardNumber &&
        normalizeCardNumber(item.oldCardNumber).toLowerCase() === normalizeCardNumber(item.newCardNumber).toLowerCase()
      ) {
        addResult(summary, {
          item,
          status: "error",
          reason: "old-card-equals-new-card",
          cardNumber: item.newCardNumber,
        });
        continue;
      }

      const oldCard = item.oldCardNumber ? await findCard(client, item.oldCardNumber) : null;
      if (!oldCard) {
        // The card may only exist in a legacy dump; inserting the replacement is
        // still correct and the report keeps the warning.
        oldCardReason = "old-card-not-found";
      } else if (oldCard.user_id !== user._id) {
        addResult(summary, {
          item,
          status: "error",
          reason: "old-card-owned-by-other-user",
          cardNumber: item.oldCardNumber,
        });
        continue;
      } else if (oldCard.status === "active") {
        if (apply) {
          await client.query(
            `UPDATE tbl_user_cards
                SET status = 'lost',
                    lost_at = now(),
                    updated_at = now()
              WHERE _id = $1 AND status = 'active'`,
            [oldCard._id],
          );
          await client.query(
            `DELETE FROM tbl_card_masters
              WHERE lower(btrim(card_number)) = lower(btrim($1))`,
            [oldCard.card_number],
          );
        }
        activeCount -= 1;
        activeCards = activeCards.filter((card) => card._id !== oldCard._id);
        oldCardReason = "old-card-marked-lost";
      } else {
        oldCardReason = "old-card-already-lost";
      }
    }

    if (newCard && newCard.user_id === user._id) {
      if (newCard.status === "active") {
        addResult(summary, {
          item,
          status: "skipped",
          reason: oldCardReason ? `already-active;${oldCardReason}` : "already-active",
          cardNumber: item.newCardNumber,
        });
        continue;
      }
      addResult(summary, {
        item,
        status: "error",
        reason: "new-card-is-lost",
        cardNumber: item.newCardNumber,
      });
      continue;
    }

    if (activeCount >= ACTIVE_CARD_LIMIT) {
      addResult(summary, {
        item,
        status: "error",
        reason: "active-card-limit",
        cardNumber: item.newCardNumber,
      });
      continue;
    }

    if (apply) {
      try {
        await client.query(
          `INSERT INTO tbl_user_cards (user_id, card_number, status)
           VALUES ($1, $2, 'active')`,
          [user._id, item.newCardNumber],
        );
      } catch (error) {
        if (error?.code === "23505") {
          addResult(summary, {
            item,
            status: "error",
            reason: "card-already-registered",
            cardNumber: item.newCardNumber,
          });
          continue;
        }
        throw error;
      }
    }

    addResult(summary, {
      item,
      status: "ok",
      reason: oldCardReason ? `inserted;${oldCardReason}` : "inserted",
      cardNumber: item.newCardNumber,
    });
  }

  return summary;
};

const runPasswordPhase = async (client, { apply, fresh, passwordRows, defaultPassword, pendingCreateEmails }) => {
  const summary = createSummary("passwords");
  let processed = 0;

  for (const row of passwordRows) {
    processed += 1;
    if (apply && processed % 25 === 0) {
      process.stderr.write(`  passwords: ${processed}/${passwordRows.length}\n`);
    }

    // In a clean-slate run the create phase already wrote the default hash and
    // the must-change flag, so comparing bcrypt for all 238 rows is wasted work.
    if (fresh && pendingCreateEmails.has(normalizeEmail(row.email))) {
      addResult(summary, { item: row, status: "skipped", reason: "created-with-default-password" });
      continue;
    }

    const user = await findUserByEmail(client, row.email);
    if (!user) {
      // Tablet and receptionist accounts from BJB are deliberately not imported
      // (source "keep-orphan"); users created by this same plan already have the
      // default password, so the reset is a no-op.
      if (row.source === "keep-orphan") {
        addResult(summary, { item: row, status: "skipped", reason: "keep-orphan-not-imported" });
      } else if (pendingCreateEmails.has(normalizeEmail(row.email))) {
        addResult(summary, { item: row, status: "skipped", reason: "created-with-default-password" });
      } else {
        addResult(summary, { item: row, status: "error", reason: "user-not-found" });
      }
      continue;
    }
    if (user.is_deleted) {
      addResult(summary, { item: row, status: "error", reason: "user-deleted" });
      continue;
    }

    if (
      user.must_change_password === true &&
      user.password &&
      (await bcrypt.compare(validateDefaultPassword(defaultPassword), user.password))
    ) {
      addResult(summary, { item: row, status: "skipped", reason: "already-set" });
      continue;
    }

    if (!apply) {
      addResult(summary, { item: row, status: "ok", reason: "would-reset-password" });
      continue;
    }

    const passwordHash = await bcrypt.hash(validateDefaultPassword(defaultPassword), BCRYPT_COST);
    await client.query(
      `UPDATE tbl_users
          SET password = $1,
              must_change_password = true,
              updated_at = now()
        WHERE _id = $2`,
      [passwordHash, user._id],
    );

    addResult(summary, { item: row, status: "ok", reason: "password-reset" });
  }

  return summary;
};

const executePhase = async (client, phase, context) => {
  switch (phase) {
    case "update":
      return runUpdatePhase(client, context);
    case "create":
      return runCreatePhase(client, context);
    case "cards":
      return runCardPhase(client, context);
    case "passwords":
      return runPasswordPhase(client, context);
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
  return path.join(tmpdir(), `360booking-import-${stamp}.local.json`);
};

const writeReport = async (reportPath, report) => {
  if (reportPath.toLowerCase().endsWith(".csv")) {
    const rows = report.phases.flatMap((phase) => phase.rows);
    const columns = ["phase", "row", "employee_id", "email_masked", "card_masked", "status", "reason"];
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
  const visible = errors.slice(0, 10);
  for (const row of visible) {
    console.log(`    row ${row.row} employee ${row.employee_id}: ${row.reason}`);
  }
  if (errors.length > visible.length) {
    console.log(`    ... ${errors.length - visible.length} more error(s); see the report`);
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

  const planPath = options.plan ?? DEFAULT_PLAN;
  const passwordsPath = options.passwords ?? DEFAULT_PASSWORDS;
  const defaultsPath = options.defaults ?? DEFAULT_DEFAULTS;

  const defaultPassword = await readDefaultPassword(defaultsPath);
  const freshFlag = options.fresh === true;

  let planRows = [];
  let passwordRows = [];
  let cardChangeRows = [];
  let cardItems = [];

  const needsPlan =
    freshFlag || phasesToRun.includes("update") || phasesToRun.includes("create") || phasesToRun.includes("cards");

  if (needsPlan) {
    planRows = await readImportPlan(planPath);
  }
  if (phasesToRun.includes("passwords")) {
    passwordRows = await readPasswordResetPlan(passwordsPath);
  }

  const planLooksFresh = detectFreshPlan(planRows);
  const fresh = freshFlag || planLooksFresh;

  if (freshFlag && !planLooksFresh) {
    fail("--fresh requires a plan where every row has action=create (clean-slate plan)");
  }
  if (fresh) {
    if (planRows.some((row) => row.action === "update")) {
      fail("A fresh plan must not contain update rows");
    }
    if (planRows.some((row) => row.cardAction === "replace")) {
      fail("A fresh plan must not contain card_action=replace; use add or no-card");
    }
  }

  if (phasesToRun.includes("cards")) {
    // In a fresh run the cards are already part of the plan, so the legacy
    // replace list must not be mixed in unless the operator passes it.
    if (!fresh || options.cards) {
      cardChangeRows = await readCardChangePlan(options.cards ?? DEFAULT_CARDS);
    }
    cardItems = buildCardItems(planRows, cardChangeRows);
  }

  // Users this plan would create. Used only when a later phase cannot find the
  // user during a dry-run; in apply mode the create phase has already run.
  const pendingCreateEmails = new Set(
    planRows.filter((row) => row.action === "create").map((row) => normalizeEmail(row.email)),
  );

  const client = new Client({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    application_name: "360booking-import",
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
      // Defence in depth: a dry-run must not change anything, even through a
      // helper added later.
      await client.query("SET default_transaction_read_only = on");
    }

    console.log(
      `${apply ? "APPLY" : "DRY-RUN"} target=${databaseName} phase=${phase} ` +
        `mode=${fresh ? "fresh" : "legacy"}` +
        (backupProof ? ` backup-proof=${backupProof}` : ""),
    );
    console.log(`plan=${planRows.length} password-rows=${passwordRows.length} card-items=${cardItems.length}`);

    const context = {
      apply,
      fresh,
      planRows,
      passwordRows,
      cardItems,
      defaultPassword,
      pendingCreateEmails,
    };
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
      plan_mode: fresh ? "fresh" : "legacy",
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
    console.log(`Report: ${reportPath} (contains masked e-mail addresses and card endings only)`);

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
