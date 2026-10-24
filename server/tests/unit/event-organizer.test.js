import assert from "node:assert/strict";
import { test } from "node:test";
import { requestedOrganizer, resolveOrganizer } from "../../features/events/event.service.js";

const receptionist = {
  _id: "principal-receptionist",
  email: "frontdesk@example.test",
  role: "RECEPTIONIST",
  floor: "2",
};

const employeeAccount = {
  _id: "account-employee",
  name: "Floor One Employee",
  email: "employee.one@example.test",
};

// Stands in for tbl_users so the decision itself is tested without a database.
const findEmployeeReturning = (account) => async (email) => {
  assert.equal(typeof email, "string");
  return account;
};

test("an empty organizer_email keeps the booking on the principal", async () => {
  const requested = requestedOrganizer(undefined, receptionist);
  assert.deepEqual(requested, { email: null, onBehalf: false });

  const organizer = await resolveOrganizer(requested, receptionist, findEmployeeReturning(null));
  assert.deepEqual(organizer, {
    organizerId: receptionist._id,
    organizerEmail: receptionist.email,
    bookedBy: null,
  });
});

test("a blank organizer_email is treated as a self booking", () => {
  assert.deepEqual(requestedOrganizer("   ", receptionist), { email: null, onBehalf: false });
  assert.deepEqual(requestedOrganizer(null, receptionist), { email: null, onBehalf: false });
});

test("a receptionist may book for another employee and is recorded as booked_by", async () => {
  const requested = requestedOrganizer("  Employee.One@Example.Test  ", receptionist);
  assert.deepEqual(requested, { email: "employee.one@example.test", onBehalf: true });

  const organizer = await resolveOrganizer(requested, receptionist, findEmployeeReturning(employeeAccount));
  assert.deepEqual(organizer, {
    organizerId: employeeAccount._id,
    organizerEmail: employeeAccount.email,
    bookedBy: receptionist._id,
  });
});

test("an admin may also book for another employee", async () => {
  const admin = { _id: "principal-admin", email: "admin@example.test", role: "ADMIN" };
  const organizer = await resolveOrganizer(
    requestedOrganizer("employee.one@example.test", admin),
    admin,
    findEmployeeReturning(employeeAccount)
  );
  assert.equal(organizer.organizerId, employeeAccount._id);
  assert.equal(organizer.bookedBy, admin._id);
});

test("naming your own email stays a self booking without booked_by", async () => {
  const ownAccount = { _id: receptionist._id, name: "Front Desk", email: receptionist.email };
  const organizer = await resolveOrganizer(
    requestedOrganizer(receptionist.email, receptionist),
    receptionist,
    findEmployeeReturning(ownAccount)
  );
  assert.equal(organizer.organizerId, receptionist._id);
  assert.equal(organizer.bookedBy, null);
});

test("a plain employee may not name another organizer", () => {
  const employee = { _id: "principal-employee", email: "employee.two@example.test", role: "USER" };
  assert.throws(
    () => requestedOrganizer("employee.one@example.test", employee),
    (error) => error.status === 403 && error.code === "FORBIDDEN"
  );
});

test("a malformed organizer email is rejected before the role check", () => {
  assert.throws(
    () => requestedOrganizer("not-an-email", receptionist),
    (error) => error.status === 400 && error.code === "INVALID_ORGANIZER"
  );
});

test("an unknown or non-employee organizer is a 400 INVALID_ORGANIZER", async () => {
  const requested = requestedOrganizer("nobody@example.test", receptionist);
  await assert.rejects(
    resolveOrganizer(requested, receptionist, findEmployeeReturning(null)),
    (error) => error.status === 400 && error.code === "INVALID_ORGANIZER"
  );
});
