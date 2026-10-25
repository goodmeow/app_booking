import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { apiRequest, queryParityDatabase, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";

// The setup routes are the only public write path that creates an admin. The
// parity seed already ships an admin, so this suite uses it twice: once as an
// "already installed" database and once with the admin hidden to act as a
// fresh installation.
const SEED_ADMIN_ID = "20000000-0000-4000-8000-000000000001";
const BOOTSTRAP_EMAIL = "bootstrap.admin@example.test";
const BOOTSTRAP_PASSWORD = "Bootstrap123!";
const BOOTSTRAP_EMPLOYEE_ID = "ADMIN-001";

let server;

before(async () => {
  await resetParityDatabase();
  server = await startServer(targets.reconstructed);
});

after(() => stopServer(server));

const readStatus = () => apiRequest(targets.reconstructed, "/api/setup/status");

const postSetup = (body) => apiRequest(targets.reconstructed, "/api/setup", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test("a database that already has an admin never shows the setup form", async () => {
  const response = await readStatus();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { required: false });

  const blocked = await postSetup({
    name: "Second Admin",
    email: BOOTSTRAP_EMAIL,
    password: BOOTSTRAP_PASSWORD,
  });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, "SETUP_COMPLETED");
  assert.equal(
    await queryParityDatabase(`SELECT count(*) FROM tbl_users WHERE email = '${BOOTSTRAP_EMAIL}';`),
    "0"
  );
});

test("a fresh database creates the first admin once and then locks setup", async () => {
  await queryParityDatabase(`
    UPDATE tbl_users SET is_deleted = true WHERE _id = '${SEED_ADMIN_ID}';
    DELETE FROM tbl_app_settings;
  `);
  try {
    assert.deepEqual((await readStatus()).body, { required: true });

    const invalid = await postSetup({ name: "Bootstrap Admin", email: "not-an-email", password: BOOTSTRAP_PASSWORD });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, "INVALID_EMAIL");

    const created = await postSetup({
      name: "Bootstrap Admin",
      email: BOOTSTRAP_EMAIL,
      password: BOOTSTRAP_PASSWORD,
    });
    assert.equal(created.status, 201);
    assert.deepEqual(Object.keys(created.body.user).sort(), ["_id", "email", "name", "role"]);
    assert.equal(created.body.user.email, BOOTSTRAP_EMAIL);
    assert.equal(created.body.user.role, "ADMIN");

    const account = await queryParityDatabase(`
      SELECT
        u.type,
        u.employee_id,
        u.floor,
        u.must_change_password,
        u.is_deleted,
        r.role_name
      FROM tbl_users u
      JOIN tbl_role r ON r._id = u.role_id
      WHERE u.email = '${BOOTSTRAP_EMAIL}';
    `);
    assert.equal(account, `employee|${BOOTSTRAP_EMPLOYEE_ID}||f|f|admin`);

    // No password or hash leaves the API, and the database stores a bcrypt hash.
    assert.equal(created.body.user.password, undefined);
    assert.equal(
      await queryParityDatabase(`
        SELECT password LIKE '$2%' FROM tbl_users WHERE email = '${BOOTSTRAP_EMAIL}';
      `),
      "t"
    );

    const settings = await queryParityDatabase(`
      SELECT
        count(*),
        bool_and(setup_completed),
        bool_and(lock_timer = 5 AND led_timer = 5 AND table_input AND not_checked_in_time_limit = 15),
        bool_and(time_of_event_start_soon = 10 AND available_color = '05' AND will_start_color = '08' AND on_meeting_color = '04')
      FROM tbl_app_settings;
    `);
    assert.equal(settings, "1|t|t|t");

    assert.deepEqual((await readStatus()).body, { required: false });

    const repeated = await postSetup({
      name: "Another Admin",
      email: "another.admin@example.test",
      password: BOOTSTRAP_PASSWORD,
    });
    assert.equal(repeated.status, 409);
    assert.equal(repeated.body.code, "SETUP_COMPLETED");
  } finally {
    // Put the seed admin back and delete the account created above, so the
    // database is usable by a later run of this suite. Every other regression
    // file resets the parity database in its own `before` hook.
    await queryParityDatabase(`
      DELETE FROM tbl_users WHERE email = '${BOOTSTRAP_EMAIL}';
      UPDATE tbl_users SET is_deleted = false WHERE _id = '${SEED_ADMIN_ID}';
    `);
  }
});
