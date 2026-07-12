import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAddAttendeePayload,
  buildCreateEventPayload,
  buildUpdateEventPayload,
  isRoomAttendee,
  validateEventDraft,
} from "../domain/events/event-contract.js";

const startDate = new Date("2030-01-15T09:00:00");
const endDate = new Date("2030-01-15T10:00:00");
const now = new Date("2030-01-15T08:00:00");
const attendees = [
  { attendee_email: "guest@example.test" },
  { attendee_email: "meeting-one@room.com" },
];

test("recognizes room attendee case-insensitively", () => {
  assert.equal(isRoomAttendee({ attendee_email: "MEETING@ROOM.COM" }), true);
  assert.equal(isRoomAttendee({ attendee_email: "user@example.test" }), false);
});

test("validates recovered event time and room rules", () => {
  assert.equal(validateEventDraft({ startDate, endDate, attendees }, { now }), null);
  assert.equal(
    validateEventDraft({ startDate: endDate, endDate: startDate, attendees }, { now }),
    "Waktu mulai tidak dapat lebih dari waktu selesai"
  );
  assert.equal(
    validateEventDraft({ startDate, endDate: new Date("2030-01-16T10:00:00"), attendees }, { now }),
    "Tidak dapat melakukan reserve meeting (Hari berbeda)"
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

test("builds recovered create and update payload shapes", () => {
  const draft = { id: "event-1", organizer: "owner@example.test", subject: "Planning", description: "Quarterly", startDate, endDate, attendees };
  const create = buildCreateEventPayload(draft);
  assert.equal(create.length, 2);
  assert.equal(create[0].attendee_email, "guest@example.test");
  assert.equal(create[0].organizer, draft.organizer);
  assert.equal(create[0].start_date, startDate);

  const update = buildUpdateEventPayload(draft);
  assert.equal(update.id, "event-1");
  assert.deepEqual(update.attendees, attendees);
  assert.equal(update.end_date, endDate);
});

test("builds array payload required by add-attendee endpoint", () => {
  assert.deepEqual(
    buildAddAttendeePayload({ eventId: "event-1", attendeeEmail: "guest@example.test" }),
    [{ event_id: "event-1", attendee_email: "guest@example.test" }]
  );
});
