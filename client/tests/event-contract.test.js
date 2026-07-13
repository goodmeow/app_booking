import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAddAttendeePayload,
  buildCreateEventPayload,
  buildUpdateEventPayload,
  encodeEventDescription,
  isRoomAttendee,
  validateEventDraft,
} from "../domain/events/event-contract.js";

const startDate = new Date("2030-01-15T09:00:00");
const endDate = new Date("2030-01-15T10:00:00");
const now = new Date("2030-01-15T08:00:00");
const attendees = [
  { attendee_email: "guest@example.test" },
  { attendee_email: "any-room-identifier@example.test", type: "room" },
];

test("recognizes rooms by explicit identity type", () => {
  assert.equal(isRoomAttendee({ attendee_email: "anything@example.test", type: "room" }), true);
  assert.equal(isRoomAttendee({ attendee_email: "meeting@room.com", type: "employee" }), false);
});

test("validates recovered event time and room rules", () => {
  assert.equal(validateEventDraft({ startDate, endDate, attendees }, { now }), null);
  assert.equal(
    validateEventDraft({ startDate: endDate, endDate: startDate, attendees }, { now }),
    "Waktu selesai harus setelah waktu mulai"
  );
  assert.equal(
    validateEventDraft({ startDate, endDate: new Date("2030-01-16T10:00:00"), attendees }, { now }),
    null
  );
  assert.equal(
    validateEventDraft({ startDate, endDate, attendees: [] }, { now }),
    "Anda harus memilih lokasi ruangan"
  );
  assert.equal(
    validateEventDraft({ startDate, endDate, attendees }, { now: new Date("2030-01-15T11:00:00"), editing: true }),
    "Tidak dapat melakukan perubahan meeting (Waktu telah berlalu)"
  );
});

test("builds recovered create and update payload shapes with encoded description state", () => {
  const description = encodeEventDescription("Quarterly plan + notes");
  const draft = { id: "event-1", organizer: "owner@example.test", subject: "Planning", description, startDate, endDate, attendees };
  const create = buildCreateEventPayload(draft);
  assert.equal(create.length, 2);
  assert.equal(create[0].attendee_email, "guest@example.test");
  assert.equal(create[0].organizer, draft.organizer);
  assert.equal(create[0].start_date, startDate);
  assert.equal(create[0].description, "Quarterly%20plan%20%2B%20notes");

  const update = buildUpdateEventPayload(draft);
  assert.equal(update.id, "event-1");
  assert.deepEqual(update.attendees, attendees.map(({ attendee_email }) => ({ attendee_email })));
  assert.equal(update.end_date, endDate);
  assert.equal(update.description, "Quarterly%20plan%20%2B%20notes");
});

test("builds array payload required by add-attendee endpoint", () => {
  assert.deepEqual(
    buildAddAttendeePayload({ eventId: "event-1", attendeeEmail: "guest@example.test" }),
    [{ event_id: "event-1", attendee_email: "guest@example.test" }]
  );
});
