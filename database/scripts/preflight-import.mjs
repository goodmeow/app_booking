#!/usr/bin/env node
// Read-only pre-flight for the BJB -> 360 Scheduler import.
//
// It answers one question: can the plan run against this database without a
// blocker? It never writes (the session is set to read-only), and it prints
// only masked e-mail addresses.
//
//   PGDATABASE=360booking node database/scripts/preflight-import.mjs \
//     --plan=... --passwords=... --cards=... --defaults=...
//
// Exit codes: 0 = no blocker, 1 = blocker found, 2 = fatal usage/connection.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import {
  DISPOSABLE_DATABASE_PATTERN,
  EXPECTED_CARD_CHANGE_ROWS,
  EXPECTED_CREATE_ROWS,
  EXPECTED_FRESH_CARD_ROWS,
  EXPECTED_FRESH_CREATE_ROWS,
  EXPECTED_FRESH_PLAN_ROWS,
  EXPECTED_MASTER_CARD_ROWS,
  EXPECTED_NO_CARD_ROWS,
  EXPECTED_PASSWORD_ROWS,
  EXPECTED_PLAN_ROWS,
  EXPECTED_PLACEHOLDER_ROWS,
  EXPECTED_ROOM_ROWS,
  EXPECTED_SPECIAL_USER_ROWS,
  EXPECTED_UPDATE_ROWS,
  FatalError,
  assertDatabaseNameAllowed,
  buildCardItems,
  detectFreshPlan,
  isForbiddenDatabase,
  normalizeEmail,
  normalizeEmployeeId,
  parseOptions,
  readCardChangePlan,
  readDefaultPassword,
  readImportPlan,
  readMasterCardPlan,
  readPasswordResetPlan,
  readRoomPlan,
  readSpecialUserPlan,
} from "./lib/import-plan.mjs";

const { Client } = pg;

const ACTIVE_CARD_LIMIT = 2;
const REQUIRED_TABLES = ["tbl_users", "tbl_role", "tbl_user_cards", "tbl_rooms", "tbl_card_masters"];
const REQUIRED_COLUMNS = [
  ["tbl_users", "employee_id"],
  ["tbl_users", "must_change_password"],
  ["tbl_user_cards", "status"],
  ["tbl_user_cards", "lost_at"],
];
const REQUIRED_INDEXES = ["tbl_users_employee_id_lower_key", "tbl_user_cards_card_number_key"];

const DEFAULT_PLAN = "integration/plan-import.local.csv";
const DEFAULT_FRESH_PLAN = "integration/plan-import-fresh.local.csv";
const DEFAULT_PASSWORDS = "integration/plan-password-reset.local.csv";
const DEFAULT_CARDS = "integration/plan-card-changes.local.csv";
const DEFAULT_DEFAULTS = "integration/.env.import.local";

const USAGE = `Usage: node database/scripts/preflight-import.mjs [options]

Options:
  --fresh            Clean-slate plan (all rows create); auto-detected from the plan
  --plan=PATH        plan-import CSV (default: ${DEFAULT_PLAN}; ${DEFAULT_FRESH_PLAN} with --fresh)
  --passwords=PATH   password-reset CSV (default: ${DEFAULT_PASSWORDS})
  --cards=PATH       card-changes CSV (legacy mode only; default: ${DEFAULT_CARDS})
  --rooms=PATH       fresh mode: room plan to validate (default: none)
  --special=PATH     fresh mode: admin/receptionist plan to validate (default: none)
  --master-cards=PATH fresh mode: master-card plan to validate (default: none)
  --defaults=PATH    env file with DEFAULT_PASSWORD (default: ${DEFAULT_DEFAULTS})
  --report=PATH      optional JSON report for the findings
  --rehearsal        scratch DB only: expected row counts become warnings,
                     so a small synthetic plan can exercise the checks
  --help             Show this text

The database comes from PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE and the
session runs with default_transaction_read_only=on.`;

const optionSpec = {
  fresh: "flag",
  plan: "value",
  passwords: "value",
  cards: "value",
  rooms: "value",
  special: "value",
  "master-cards": "value",
  defaults: "value",
  report: "value",
  rehearsal: "flag",
};

class Findings {
  constructor() {
    this.items = [];
  }

  add(severity, code, message) {
    this.items.push({ severity, code, message });
  }

  error(code, message) {
    this.add("error", code, message);
  }

  warning(code, message) {
    this.add("warning", code, message);
  }

  info(code, message) {
    this.add("info", code, message);
  }

  count(severity) {
    return this.items.filter((item) => item.severity === severity).length;
  }
}

const uniqueList = (values) => [...new Set(values)];

const fail = (message) => {
  throw new FatalError(message);
};

const runOfflineChecks = (
  findings,
  {
    planRows,
    passwordRows,
    cardChangeRows,
    cardItems,
    defaultPassword,
    rehearsal,
    fresh,
    roomRows,
    specialRows,
    masterCardRows,
  },
) => {
  const countIssue = (code, message) => {
    if (rehearsal) findings.warning(code, message);
    else findings.error(code, message);
  };

  const expectedPlanRows = fresh ? EXPECTED_FRESH_PLAN_ROWS : EXPECTED_PLAN_ROWS;
  const expectedUpdateRows = fresh ? 0 : EXPECTED_UPDATE_ROWS;
  const expectedCreateRows = fresh ? EXPECTED_FRESH_CREATE_ROWS : EXPECTED_CREATE_ROWS;
  const expectedCardItems = fresh ? EXPECTED_FRESH_CARD_ROWS : EXPECTED_CARD_CHANGE_ROWS;

  if (planRows.length !== expectedPlanRows) {
    countIssue("plan-row-count", `plan has ${planRows.length} rows, expected ${expectedPlanRows}`);
  }
  const updateCount = planRows.filter((row) => row.action === "update").length;
  const createCount = planRows.filter((row) => row.action === "create").length;
  if (updateCount !== expectedUpdateRows) {
    countIssue("plan-update-count", `plan has ${updateCount} update rows, expected ${expectedUpdateRows}`);
  }
  if (createCount !== expectedCreateRows) {
    countIssue("plan-create-count", `plan has ${createCount} create rows, expected ${expectedCreateRows}`);
  }
  if (passwordRows.length !== EXPECTED_PASSWORD_ROWS) {
    countIssue(
      "password-row-count",
      `password plan has ${passwordRows.length} rows, expected ${EXPECTED_PASSWORD_ROWS}`,
    );
  }
  if (fresh) {
    if (cardItems.length !== expectedCardItems) {
      countIssue("card-item-count", `plan has ${cardItems.length} card rows, expected ${expectedCardItems}`);
    }
  } else if (cardChangeRows.length !== EXPECTED_CARD_CHANGE_ROWS) {
    countIssue("card-row-count", `card plan has ${cardChangeRows.length} rows, expected ${EXPECTED_CARD_CHANGE_ROWS}`);
  }

  const emailKeys = planRows.map((row) => normalizeEmail(row.email));
  const employeeKeys = planRows.map((row) => normalizeEmployeeId(row.employeeId));
  const duplicateEmails = emailKeys.filter((key, index) => emailKeys.indexOf(key) !== index);
  const duplicateEmployeeIds = employeeKeys.filter((key, index) => employeeKeys.indexOf(key) !== index);

  if (duplicateEmails.length > 0) {
    findings.error(
      "duplicate-plan-email",
      `${uniqueList(duplicateEmails).length} e-mail address(es) repeat in the plan`,
    );
  }
  if (duplicateEmployeeIds.length > 0) {
    findings.error(
      "duplicate-plan-employee-id",
      `${uniqueList(duplicateEmployeeIds).length} employee_id value(s) repeat in the plan`,
    );
  }

  const planEmails = new Set(emailKeys);
  const passwordEmails = new Set(passwordRows.map((row) => normalizeEmail(row.email)));
  const missingReset = [...planEmails].filter((email) => !passwordEmails.has(email));
  if (missingReset.length > 0) {
    findings.error(
      "password-plan-incomplete",
      `${missingReset.length} plan e-mail address(es) have no password-reset row`,
    );
  }

  const newCardKeys = cardItems.map((item) => item.newCardNumber.toLowerCase());
  const duplicateCards = newCardKeys.filter((key, index) => newCardKeys.indexOf(key) !== index);
  if (duplicateCards.length > 0) {
    findings.error("duplicate-plan-card", `${uniqueList(duplicateCards).length} card number(s) are assigned twice`);
  }

  if (defaultPassword.length < 8) {
    findings.error("weak-default-password", "DEFAULT_PASSWORD is shorter than 8 characters");
  }

  const placeholderCount = planRows.filter((row) => row.placeholder).length;
  if (placeholderCount !== EXPECTED_PLACEHOLDER_ROWS) {
    findings.warning(
      "placeholder-count-changed",
      `${placeholderCount} placeholder accounts (@<company-domain>), expected ${EXPECTED_PLACEHOLDER_ROWS}; review before import`,
    );
  } else {
    findings.warning(
      "placeholder-accounts",
      `${placeholderCount} accounts still use a placeholder e-mail (@<company-domain>); they can log in only after the address is updated`,
    );
  }

  const noCardCount = planRows.filter((row) => row.cardAction === "no-card").length;
  if (noCardCount !== EXPECTED_NO_CARD_ROWS) {
    findings.warning(
      "no-card-count-changed",
      `${noCardCount} accounts have no card, expected ${EXPECTED_NO_CARD_ROWS}`,
    );
  } else {
    findings.warning(
      "no-card-accounts",
      `${noCardCount} accounts have no access card; they use the CMS only until a card is issued`,
    );
  }

  const floors = uniqueList(planRows.map((row) => row.floor)).sort();
  findings.info("plan-floors", `plan uses floors ${floors.join(", ")}`);

  if (roomRows) {
    if (roomRows.length !== EXPECTED_ROOM_ROWS) {
      countIssue("room-row-count", `room plan has ${roomRows.length} rows, expected ${EXPECTED_ROOM_ROWS}`);
    }
    const roomEmailKeys = roomRows.map((row) => normalizeEmail(row.email));
    if (uniqueList(roomEmailKeys).length !== roomEmailKeys.length) {
      findings.error("duplicate-room-email", "room plan contains duplicate e-mail addresses");
    }
    const collisions = roomEmailKeys.filter((email) => planEmails.has(email));
    if (collisions.length > 0) {
      findings.error("room-email-collision", `${collisions.length} room e-mail(s) also appear in the user plan`);
    }
    findings.info(
      "room-floors",
      `room plan covers floors ${uniqueList(roomRows.map((row) => row.floor))
        .sort()
        .join(", ")}`,
    );
  }

  if (specialRows) {
    if (specialRows.length !== EXPECTED_SPECIAL_USER_ROWS) {
      countIssue(
        "special-user-count",
        `special-user plan has ${specialRows.length} rows, expected ${EXPECTED_SPECIAL_USER_ROWS}`,
      );
    }
    const specialEmailKeys = specialRows.map((row) => normalizeEmail(row.email));
    if (uniqueList(specialEmailKeys).length !== specialEmailKeys.length) {
      findings.error("duplicate-special-email", "special-user plan contains duplicate e-mail addresses");
    }
    const emailCollisions = specialEmailKeys.filter((email) => planEmails.has(email));
    if (emailCollisions.length > 0) {
      findings.error(
        "special-email-collision",
        `${emailCollisions.length} special-user e-mail(s) also appear in the user plan`,
      );
    }
    const specialIdCollisions = specialRows
      .map((row) => normalizeEmployeeId(row.employeeId))
      .filter((employeeId) => employeeKeys.includes(employeeId));
    if (specialIdCollisions.length > 0) {
      findings.error(
        "special-employee-id-collision",
        `${specialIdCollisions.length} special employee_id value(s) also appear in the user plan`,
      );
    }
    findings.info(
      "special-roles",
      `special users: ${specialRows.filter((row) => row.role === "admin").length} admin, ` +
        `${specialRows.filter((row) => row.role === "receptionist").length} receptionist`,
    );
  }

  if (masterCardRows) {
    if (masterCardRows.length !== EXPECTED_MASTER_CARD_ROWS) {
      countIssue(
        "master-card-count",
        `master-card plan has ${masterCardRows.length} rows, expected ${EXPECTED_MASTER_CARD_ROWS}`,
      );
    }
    findings.info("master-cards", `${masterCardRows.length} master card number(s) in the plan`);
  }
};

const checkSchema = async (client, findings) => {
  const tables = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [REQUIRED_TABLES],
  );
  const presentTables = new Set(tables.rows.map((row) => row.table_name));
  const missingTables = REQUIRED_TABLES.filter((table) => !presentTables.has(table));
  if (missingTables.length > 0) {
    findings.error("missing-table", `missing table(s): ${missingTables.join(", ")}`);
  }

  const columns = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [REQUIRED_TABLES],
  );
  const columnKeys = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missingColumns = REQUIRED_COLUMNS.filter(([table, column]) => !columnKeys.has(`${table}.${column}`));
  if (missingColumns.length > 0) {
    findings.error(
      "missing-column",
      `missing column(s): ${missingColumns.map(([table, column]) => `${table}.${column}`).join(", ")}`,
    );
  }

  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)`,
    [REQUIRED_INDEXES],
  );
  const presentIndexes = new Set(indexes.rows.map((row) => row.indexname));
  const missingIndexes = REQUIRED_INDEXES.filter((index) => !presentIndexes.has(index));
  if (missingIndexes.length > 0) {
    findings.error("missing-index", `missing index(es): ${missingIndexes.join(", ")}`);
  }

  return {
    tablesOk: missingTables.length === 0,
    columnsOk: missingColumns.length === 0,
  };
};

const checkRoles = async (client, findings) => {
  const result = await client.query(
    `SELECT role_name
       FROM tbl_role
      WHERE coalesce(is_deleted, false) = false`,
  );
  const roles = new Set(result.rows.map((row) => row.role_name.toLowerCase()));
  for (const role of ["user", "receptionist"]) {
    if (!roles.has(role)) findings.error("missing-role", `role "${role}" is missing from tbl_role`);
  }
  return roles;
};

const checkRooms = async (client, findings, planRows, { fresh = false, plannedFloors = new Set() } = {}) => {
  const result = await client.query(
    `SELECT DISTINCT btrim(floor) AS floor
       FROM tbl_rooms
      WHERE is_deleted IS NOT TRUE
        AND coalesce(btrim(floor), '') <> ''`,
  );
  const roomFloors = new Set(result.rows.map((row) => row.floor));
  const requiredFloors = uniqueList(planRows.map((row) => row.floor));
  const missingFloors = requiredFloors.filter((floor) => !roomFloors.has(floor));
  const pendingFloors = missingFloors.filter((floor) => plannedFloors.has(floor));
  const realMissingFloors = missingFloors.filter((floor) => !plannedFloors.has(floor));

  if (realMissingFloors.length > 0) {
    const message = `no active room on floor(s) ${realMissingFloors.join(", ")}; imported employees would not be able to book`;
    // In a fresh install the room plan is imported before the users, so a floor
    // that the plan covers is expected to be empty at this point.
    if (fresh) findings.warning("missing-floor", message);
    else findings.error("missing-floor", message);
  } else if (pendingFloors.length > 0) {
    findings.info("floor-pending-rooms", `floor(s) ${pendingFloors.join(", ")} will be created by the room plan`);
  } else {
    findings.info("room-floors", `active rooms on floors ${[...roomFloors].sort().join(", ")}`);
  }
};

const loadUserIndex = async (client) => {
  const result = await client.query(
    `SELECT _id,
            lower(btrim(email)) AS email_key,
            lower(btrim(employee_id)) AS employee_key,
            type,
            is_deleted
       FROM tbl_users`,
  );

  const byEmail = new Map();
  const byEmployeeId = new Map();
  const emailCounts = new Map();

  for (const row of result.rows) {
    const emailKey = row.email_key || "";
    if (emailKey) {
      emailCounts.set(emailKey, (emailCounts.get(emailKey) ?? 0) + 1);
      if (!byEmail.has(emailKey)) byEmail.set(emailKey, row);
    }
    const employeeKey = row.employee_key || "";
    if (employeeKey && !byEmployeeId.has(employeeKey)) byEmployeeId.set(employeeKey, row);
  }

  return { byEmail, byEmployeeId, emailCounts };
};

const loadCardIndex = async (client) => {
  const result = await client.query(
    `SELECT _id, user_id, lower(btrim(card_number)) AS card_key, status
       FROM tbl_user_cards`,
  );

  const byCardNumber = new Map();
  const activeCounts = new Map();

  for (const row of result.rows) {
    if (row.card_key && !byCardNumber.has(row.card_key)) byCardNumber.set(row.card_key, row);
    if (row.status === "active") {
      activeCounts.set(row.user_id, (activeCounts.get(row.user_id) ?? 0) + 1);
    }
  }

  return { byCardNumber, activeCounts };
};

const checkConflicts = (findings, { planRows, passwordRows, cardItems, userIndex, cardIndex, fresh }) => {
  const duplicatedEmailRows = [...userIndex.emailCounts.entries()].filter(([, count]) => count > 1);
  if (duplicatedEmailRows.length > 0) {
    findings.error(
      "duplicate-target-email",
      `${duplicatedEmailRows.length} e-mail address(es) exist more than once in the target (case-insensitive); ` +
        "the update phase cannot choose a user",
    );
  }

  const missingUpdates = [];
  const employeeIdConflicts = [];
  const notEmployees = [];
  const deletedUsers = [];

  for (const row of planRows) {
    if (row.action !== "update") continue;
    const user = userIndex.byEmail.get(normalizeEmail(row.email));
    if (!user) {
      missingUpdates.push(row.employeeId);
      continue;
    }
    if (user.is_deleted) {
      deletedUsers.push(row.employeeId);
      continue;
    }
    if (user.type !== "employee") {
      notEmployees.push(row.employeeId);
      continue;
    }
    const owner = userIndex.byEmployeeId.get(normalizeEmployeeId(row.employeeId));
    if (owner && owner._id !== user._id) employeeIdConflicts.push(row.employeeId);
  }

  if (missingUpdates.length > 0) {
    findings.error(
      "update-target-missing",
      `${missingUpdates.length} update row(s) have no matching user in the target ` +
        `(employee ids: ${missingUpdates.slice(0, 5).join(", ")}${missingUpdates.length > 5 ? ", ..." : ""})`,
    );
  }
  if (deletedUsers.length > 0) {
    findings.error("update-target-deleted", `${deletedUsers.length} update target(s) are soft-deleted`);
  }
  if (notEmployees.length > 0) {
    findings.error("update-target-not-employee", `${notEmployees.length} update target(s) are not employee accounts`);
  }
  if (employeeIdConflicts.length > 0) {
    findings.error(
      "update-employee-id-taken",
      `${employeeIdConflicts.length} employee_id value(s) already belong to another user ` +
        `(employee ids: ${employeeIdConflicts.slice(0, 5).join(", ")})`,
    );
  }

  const createEmailExists = [];
  const createIdTaken = [];
  for (const row of planRows) {
    if (row.action !== "create") continue;
    const existing = userIndex.byEmail.get(normalizeEmail(row.email));
    const owner = userIndex.byEmployeeId.get(normalizeEmployeeId(row.employeeId));

    if (fresh) {
      // A clean-slate target must be empty of the plan: any hit is a blocker,
      // even when the row was already imported by a previous run.
      if (existing) createEmailExists.push(row.employeeId);
      if (owner) createIdTaken.push(row.employeeId);
      continue;
    }

    const alreadyImported =
      Boolean(existing) &&
      !existing.is_deleted &&
      normalizeEmployeeId(existing.employee_key) === normalizeEmployeeId(row.employeeId);
    if (existing && !alreadyImported) createEmailExists.push(row.employeeId);
    if (alreadyImported) continue;
    if (owner) createIdTaken.push(row.employeeId);
  }
  if (createEmailExists.length > 0) {
    findings.error(
      "create-email-exists",
      `${createEmailExists.length} create row(s) already have that e-mail in the target ` +
        `(employee ids: ${createEmailExists.slice(0, 5).join(", ")})`,
    );
  }
  if (createIdTaken.length > 0) {
    findings.error(
      "create-employee-id-taken",
      `${createIdTaken.length} create row(s) use an employee_id that already exists ` +
        `(employee ids: ${createIdTaken.slice(0, 5).join(", ")})`,
    );
  }

  const cardUserMissing = [];
  const cardUserPendingCreate = [];
  const cardOwnedByOther = [];
  const oldCardOwnedByOther = [];
  const oldCardMissing = [];
  const cardSlotExceeded = [];
  const newCardLost = [];
  let alreadyApplied = 0;

  const createEmployeeIds = new Set(
    planRows.filter((row) => row.action === "create").map((row) => normalizeEmployeeId(row.employeeId)),
  );

  for (const item of cardItems) {
    const user = userIndex.byEmail.get(normalizeEmail(item.email));
    const newCard = cardIndex.byCardNumber.get(item.newCardNumber.toLowerCase());

    if (!user) {
      // A card already registered to somebody prevents a clean insert, even
      // when its target user is created later in the same plan.
      if (newCard) {
        cardOwnedByOther.push(item.employeeId);
      } else if (createEmployeeIds.has(normalizeEmployeeId(item.employeeId))) {
        // The create phase runs before the cards phase.
        cardUserPendingCreate.push(item.employeeId);
      } else {
        cardUserMissing.push(item.employeeId);
      }
      continue;
    }

    if (newCard && newCard.user_id !== user._id) {
      cardOwnedByOther.push(item.employeeId);
      continue;
    }

    if (newCard && newCard.user_id === user._id) {
      if (newCard.status === "active") {
        alreadyApplied += 1;
        continue;
      }
      newCardLost.push(item.employeeId);
      continue;
    }

    let projectedActive = cardIndex.activeCounts.get(user._id) ?? 0;

    if (item.action === "replace" && item.oldCardNumber) {
      const oldCard = cardIndex.byCardNumber.get(item.oldCardNumber.toLowerCase());
      if (!oldCard) {
        oldCardMissing.push(item.employeeId);
      } else if (oldCard.user_id !== user._id) {
        oldCardOwnedByOther.push(item.employeeId);
        continue;
      } else if (oldCard.status === "active") {
        projectedActive -= 1;
      }
    }

    if (projectedActive + 1 > ACTIVE_CARD_LIMIT) {
      cardSlotExceeded.push(item.employeeId);
    }
  }

  if (cardUserMissing.length > 0) {
    findings.error(
      "card-user-missing",
      `${cardUserMissing.length} card row(s) target a user that does not exist yet ` +
        `(employee ids: ${cardUserMissing.slice(0, 5).join(", ")})`,
    );
  }
  if (cardUserPendingCreate.length > 0) {
    findings.info(
      "card-user-pending-create",
      `${cardUserPendingCreate.length} card row(s) belong to users created earlier in the same plan`,
    );
  }
  if (cardOwnedByOther.length > 0) {
    findings.error(
      "card-owned-by-other-user",
      `${cardOwnedByOther.length} new card(s) are already registered to another user ` +
        `(employee ids: ${cardOwnedByOther.slice(0, 5).join(", ")})`,
    );
  }
  if (oldCardOwnedByOther.length > 0) {
    findings.error(
      "old-card-owned-by-other-user",
      `${oldCardOwnedByOther.length} old card(s) belong to another user ` +
        `(employee ids: ${oldCardOwnedByOther.slice(0, 5).join(", ")})`,
    );
  }
  if (cardSlotExceeded.length > 0) {
    findings.error(
      "active-card-limit",
      `${cardSlotExceeded.length} user(s) would exceed ${ACTIVE_CARD_LIMIT} active cards ` +
        `(employee ids: ${cardSlotExceeded.slice(0, 5).join(", ")})`,
    );
  }
  if (oldCardMissing.length > 0) {
    findings.warning(
      "old-card-not-found",
      `${oldCardMissing.length} old card(s) are not in tbl_user_cards; the replacement will be inserted ` +
        "and the old number keeps working only if it is still active elsewhere",
    );
  }
  if (newCardLost.length > 0) {
    findings.error(
      "new-card-is-lost",
      `${newCardLost.length} replacement card(s) already exist as lost for the same user; reactivate manually`,
    );
  }
  if (alreadyApplied > 0) {
    findings.info("cards-already-applied", `${alreadyApplied} card change(s) are already applied`);
  }

  const passwordMissing = passwordRows.filter((row) => !userIndex.byEmail.has(normalizeEmail(row.email)));
  const orphanResets = passwordMissing.filter((row) => row.source === "keep-orphan");
  const pendingCreateResets = passwordMissing.filter(
    (row) => row.source !== "keep-orphan" && createEmployeeIds.has(normalizeEmployeeId(row.employeeId)),
  );
  const unexpectedMissingResets = passwordMissing.filter(
    (row) => row.source !== "keep-orphan" && !createEmployeeIds.has(normalizeEmployeeId(row.employeeId)),
  );
  if (orphanResets.length > 0) {
    findings.info(
      "orphan-password-rows",
      `${orphanResets.length} password rows belong to deliberately non-imported accounts (keep-orphan)`,
    );
  }
  if (pendingCreateResets.length > 0) {
    findings.info(
      "password-rows-pending-create",
      `${pendingCreateResets.length} password row(s) belong to users created earlier in the same plan`,
    );
  }
  if (unexpectedMissingResets.length > 0) {
    findings.warning(
      "password-user-missing",
      `${unexpectedMissingResets.length} password row(s) have no target user yet; they will be skipped by the import`,
    );
  }
};

const loadMasterCardIndex = async (client) => {
  const result = await client.query(`SELECT lower(btrim(card_number)) AS card_key FROM tbl_card_masters`);
  return new Set(result.rows.map((row) => row.card_key));
};

const checkAssetConflicts = (
  findings,
  { roomRows, specialRows, masterCardRows, userIndex, roles, masterCardIndex },
) => {
  if (roomRows) {
    const roomEmailTaken = roomRows.filter((row) => {
      const existing = userIndex.byEmail.get(normalizeEmail(row.email));
      return existing && existing.type !== "room";
    });
    if (roomEmailTaken.length > 0) {
      findings.error(
        "room-email-taken",
        `${roomEmailTaken.length} room e-mail(s) already belong to a non-room account`,
      );
    }
    const roomEmails = roomRows.map((row) => normalizeEmail(row.email));
    const already = roomEmails.filter((email) => userIndex.byEmail.get(email)?.type === "room").length;
    if (already > 0) {
      findings.info("rooms-already-imported", `${already} room account(s) already exist`);
    }
  }

  if (specialRows) {
    const missingRoles = uniqueList(specialRows.map((row) => row.role)).filter((role) => !roles.has(role));
    if (missingRoles.length > 0) {
      findings.error("missing-special-role", `role(s) missing from tbl_role: ${missingRoles.join(", ")}`);
    }

    const emailTaken = [];
    const idTaken = [];
    for (const row of specialRows) {
      const existing = userIndex.byEmail.get(normalizeEmail(row.email));
      if (existing) {
        const sameEmployeeId = normalizeEmployeeId(existing.employee_key) === normalizeEmployeeId(row.employeeId);
        if (!(existing.type === "employee" && sameEmployeeId)) emailTaken.push(row.employeeId);
      }
      const owner = userIndex.byEmployeeId.get(normalizeEmployeeId(row.employeeId));
      if (owner && normalizeEmail(owner.email_key) !== normalizeEmail(row.email)) {
        idTaken.push(row.employeeId);
      }
    }
    if (emailTaken.length > 0) {
      findings.error(
        "special-email-taken",
        `${emailTaken.length} special-user e-mail(s) already belong to another account`,
      );
    }
    if (idTaken.length > 0) {
      findings.error(
        "special-employee-id-taken",
        `${idTaken.length} special employee_id value(s) already belong to another account`,
      );
    }
  }

  if (masterCardRows && masterCardIndex) {
    const already = masterCardRows.filter((row) => masterCardIndex.has(row.cardNumber.toLowerCase())).length;
    if (already > 0) {
      findings.info("master-cards-already-present", `${already} master card(s) already exist (insert is a no-op)`);
    }
  }
};

const main = async () => {
  const options = parseOptions(process.argv.slice(2), optionSpec);
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const freshFlag = options.fresh === true;
  const planPath = options.plan ?? (freshFlag ? DEFAULT_FRESH_PLAN : DEFAULT_PLAN);
  const passwordsPath = options.passwords ?? DEFAULT_PASSWORDS;
  const defaultsPath = options.defaults ?? DEFAULT_DEFAULTS;

  const defaultPassword = await readDefaultPassword(defaultsPath);
  const planRows = await readImportPlan(planPath);
  const passwordRows = await readPasswordResetPlan(passwordsPath);

  const planLooksFresh = detectFreshPlan(planRows);
  const fresh = freshFlag || planLooksFresh;
  if (freshFlag && !planLooksFresh) {
    fail("--fresh requires a plan where every row has action=create (clean-slate plan)");
  }

  const cardChangeRows = fresh
    ? options.cards
      ? await readCardChangePlan(options.cards)
      : []
    : await readCardChangePlan(options.cards ?? DEFAULT_CARDS);
  const cardItems = buildCardItems(planRows, cardChangeRows);

  const roomRows = options.rooms ? await readRoomPlan(options.rooms) : null;
  const specialRows = options.special ? await readSpecialUserPlan(options.special) : null;
  const masterCardRows = options["master-cards"] ? await readMasterCardPlan(options["master-cards"]) : null;

  const findings = new Findings();

  const client = new Client({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    application_name: "360booking-preflight",
  });

  await client.connect();

  let databaseName;
  try {
    databaseName = (await client.query("SELECT current_database() AS name")).rows[0].name;
    assertDatabaseNameAllowed(databaseName);

    const rehearsal = options.rehearsal === true;
    if (rehearsal && !DISPOSABLE_DATABASE_PATTERN.test(databaseName)) {
      fail("--rehearsal is only allowed on a database named *_test, *_check, or *_scratch");
    }

    runOfflineChecks(findings, {
      planRows,
      passwordRows,
      cardChangeRows,
      cardItems,
      defaultPassword,
      rehearsal,
      fresh,
      roomRows,
      specialRows,
      masterCardRows,
    });

    const expectedTarget = String(process.env.IMPORT_TARGET_DB ?? "").trim();
    if (expectedTarget && expectedTarget !== databaseName) {
      findings.warning(
        "target-db-differs",
        `connected to "${databaseName}" but IMPORT_TARGET_DB is "${expectedTarget}"`,
      );
    }
    if (isForbiddenDatabase(databaseName)) {
      findings.error("forbidden-database", `database "${databaseName}" must never be imported`);
    }

    // Trusted target: no accidental writes from this session.
    await client.query("SET default_transaction_read_only = on");

    const schema = await checkSchema(client, findings);
    let roles = new Set();
    if (schema.tablesOk) {
      roles = await checkRoles(client, findings);
      await checkRooms(client, findings, planRows, {
        fresh,
        plannedFloors: new Set((roomRows ?? []).map((row) => row.floor)),
      });
    } else {
      findings.warning("schema-checks-skipped", "role/room checks skipped because tables are missing");
    }

    if (schema.tablesOk && schema.columnsOk) {
      const userIndex = await loadUserIndex(client);
      const cardIndex = await loadCardIndex(client);
      checkConflicts(findings, { planRows, passwordRows, cardItems, userIndex, cardIndex, fresh });
      if (roomRows || specialRows || masterCardRows) {
        const masterCardIndex = masterCardRows ? await loadMasterCardIndex(client) : null;
        checkAssetConflicts(findings, {
          roomRows,
          specialRows,
          masterCardRows,
          userIndex,
          roles,
          masterCardIndex,
        });
      }
      findings.info(
        "target-users",
        `${userIndex.byEmail.size} users and ${cardIndex.byCardNumber.size} cards exist in the target`,
      );
    } else {
      findings.warning("conflict-checks-skipped", "user/card conflict checks skipped because the schema is incomplete");
    }
  } finally {
    await client.end();
  }

  console.log("Pre-flight import 360 Scheduler");
  console.log(`Database: ${databaseName} (mode=${fresh ? "fresh" : "legacy"})`);
  console.log(
    `Plan: ${planRows.length} rows, passwords: ${passwordRows.length} rows, cards: ${cardItems.length} changes`,
  );

  for (const finding of findings.items) {
    const label = finding.severity.toUpperCase().padEnd(7);
    console.log(`${label} ${finding.code}: ${finding.message}`);
  }

  const errors = findings.count("error");
  const warnings = findings.count("warning");
  console.log(`Summary: errors=${errors} warnings=${warnings}`);

  if (options.report) {
    const report = {
      generated_at: new Date().toISOString(),
      database: databaseName,
      plan_mode: fresh ? "fresh" : "legacy",
      plan_rows: planRows.length,
      password_rows: passwordRows.length,
      card_changes: cardItems.length,
      room_rows: roomRows?.length ?? null,
      special_user_rows: specialRows?.length ?? null,
      master_card_rows: masterCardRows?.length ?? null,
      errors,
      warnings,
      findings: findings.items,
    };
    await writeFile(path.resolve(options.report), `${JSON.stringify(report, null, 2)}\n`, {
      mode: 0o600,
    });
    console.log(`Report: ${path.resolve(options.report)}`);
  }

  return errors > 0 ? 1 : 0;
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
