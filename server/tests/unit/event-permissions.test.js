import assert from "node:assert/strict";
import { test } from "node:test";
import { canMutate, canView } from "../../features/events/event.service.js";

const organizer = { _id: "account-organizer", role: "USER" };
const receptionist = { _id: "account-receptionist", role: "RECEPTIONIST", floor: "2" };
const otherReceptionist = { _id: "account-receptionist-2", role: "RECEPTIONIST", floor: "2" };
const attendee = { _id: "account-attendee", role: "USER" };
const admin = { _id: "account-admin", role: "ADMIN" };
const floorReceptionist = { _id: "account-receptionist", role: "RECEPTIONIST", floor: "2" };
const otherFloorReceptionist = { _id: "account-receptionist-3", role: "RECEPTIONIST", floor: "3" };

// Created by a receptionist for somebody else: the organizer owns the meeting,
// booked_by remembers who typed it in.
const onBehalfEvent = {
  organizer_id: organizer._id,
  booked_by: receptionist._id,
  is_attendee: false,
};

// A normal self booking: nobody except the organizer was involved.
const selfEvent = {
  organizer_id: organizer._id,
  booked_by: null,
  is_attendee: false,
};

test("a booking made for somebody else stays readable by organizer, booked_by, and admin", () => {
  assert.equal(canView(onBehalfEvent, organizer), true);
  assert.equal(canView(onBehalfEvent, receptionist), true);
  assert.equal(canView(onBehalfEvent, admin), true);
});

test("a different receptionist on the same floor has no access", () => {
  assert.equal(canView(onBehalfEvent, otherReceptionist), false);
  assert.equal(canMutate(onBehalfEvent, otherReceptionist), false);
});

test("booked_by may edit and cancel the booking they created", () => {
  assert.equal(canMutate(onBehalfEvent, receptionist), true);
});

test("a receptionist cannot touch a booking made by the employee themselves", () => {
  assert.equal(canView(selfEvent, receptionist), false);
  assert.equal(canMutate(selfEvent, receptionist), false);
});

test("an attendee may read the details but may not mutate the booking", () => {
  assert.equal(canView({ ...selfEvent, is_attendee: true }, attendee), true);
  assert.equal(canMutate({ ...selfEvent, is_attendee: true }, attendee), false);
});

test("the organizer keeps full access to a booking made for them", () => {
  assert.equal(canMutate(onBehalfEvent, admin), true);
  assert.equal(canMutate(onBehalfEvent, organizer), true);
  assert.equal(canMutate(selfEvent, organizer), true);
});

test("booked_by is compared as a string so a UUID object still matches", () => {
  const event = { organizer_id: organizer._id, booked_by: { toString: () => receptionist._id } };
  assert.equal(canView(event, receptionist), true);
});

test("a receptionist covers meetings in every room on their floor", () => {
  const event = { ...selfEvent, room_floors: ["2"] };
  assert.equal(canView(event, floorReceptionist), true);
  assert.equal(canMutate(event, floorReceptionist), true);
  assert.equal(canView(event, otherFloorReceptionist), false);
  assert.equal(canMutate(event, otherFloorReceptionist), false);
});

test("a multi-floor receptionist covers any of their floors", () => {
  const multi = { _id: "account-receptionist-multi", role: "RECEPTIONIST", floors: ["5", "6"] };
  const event = { ...selfEvent, room_floors: ["6"] };
  assert.equal(canView(event, multi), true);
  assert.equal(canMutate(event, multi), true);
});
