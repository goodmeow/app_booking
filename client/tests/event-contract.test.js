import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAddAttendeePayload,
  buildCreateEventPayload,
  buildModernEventPayload,
  buildUpdateEventPayload,
  encodeEventDescription,
  isRoomAttendee,
  organizerEmailField,
  validateEventDraft,
} from "../domain/events/event-contract.js";

const startDate = new Date("2030-01-15T09:00:00");
const endDate = new Date("2030-01-15T10:00:00");
const now = new Date("2030-01-15T08:00:00");
const attendees = [
  { attendee_email: "guest@example.test" },
  { attendee_email: "any-room-identifier@example.test", type: "room" },
];
const validDraft = { subject: "Planning", startDate, endDate, attendees };

test("recognizes rooms by explicit identity type", () => {
  assert.equal(isRoomAttendee({ attendee_email: "anything@example.test", type: "room" }), true);
  assert.equal(isRoomAttendee({ attendee_email: "meeting@room.com", type: "employee" }), false);
});

test("returns semantic meeting validation keys", () => {
  assert.equal(validateEventDraft(validDraft, { now }), null);
  assert.equal(validateEventDraft({ ...validDraft, subject: "" }, { now }), "validation.subjectRequired");
  assert.equal(
    validateEventDraft({ ...validDraft, startDate: endDate, endDate: startDate }, { now }),
    "validation.endBeforeStart"
  );
  assert.equal(
    validateEventDraft({ ...validDraft, endDate: new Date("2030-01-16T10:00:00") }, { now }),
    null
  );
  assert.equal(
    validateEventDraft({ ...validDraft, attendees: [] }, { now }),
    "validation.roomRequired"
  );
  assert.equal(
    validateEventDraft({ ...validDraft, attendees: [...attendees, { attendee_email: "harun" }] }, { now }),
    "validation.guestEmail"
  );
  assert.equal(
    validateEventDraft({ ...validDraft, attendees: [...attendees, { attendee_email: "harun@contoh.id" }] }, { now }),
    null
  );
  assert.equal(
    validateEventDraft(validDraft, { now: new Date("2030-01-15T11:00:00"), editing: true }),
    "validation.pastEdit"
  );
  assert.equal(
    validateEventDraft({ ...validDraft, bookingKind: "recurring", recurrence: { cadence: "weekly", endDate: "2030-02-01", weekdays: [] } }, { now }),
    "validation.recurrenceWeekday"
  );
  assert.equal(
    validateEventDraft({ ...validDraft, bookingKind: "recurring", recurrence: { cadence: "monthly", endDate: "2030-02-15", monthlyPattern: "yearly" } }, { now }),
    "validation.recurrenceMonthly"
  );
  assert.equal(
    validateEventDraft({
      ...validDraft,
      bookingKind: "recurring",
      recurrence: { cadence: "monthly", endDate: "2030-02-15", monthlyPattern: "weekday", monthWeekIndex: 2, monthWeekday: 1 },
    }, { now }),
    null
  );
  assert.equal(
    validateEventDraft({
      ...validDraft,
      bookingKind: "recurring",
      recurrence: { cadence: "monthly", endDate: "2030-02-15", monthlyPattern: "date" },
    }, { now }),
    null
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

test("builds modern recurrence payload for preview and create", () => {
  const draft = {
    subject: "Planning",
    description: "Notes",
    startDate,
    endDate,
    timezone: "Asia/Jakarta",
    bookingKind: "recurring",
    recurrence: { cadence: "daily", interval: 1, endDate: "2030-01-17" },
    attendees: [
      { attendee_email: "room@example.test", type: "room", room_id: "room-1" },
      { attendee_email: "employee@example.test", attendee_user_id: "user-1" },
      { attendee_email: "visitor@example.test" },
    ],
  };
  assert.deepEqual(buildModernEventPayload(draft), {
    bookingKind: "recurring",
    subject: "Planning",
    description: "Notes",
    start: startDate,
    end: endDate,
    timezone: "Asia/Jakarta",
    roomIds: ["room-1"],
    attendeeIds: ["user-1"],
    visitorEmails: ["visitor@example.test"],
    recurrence: { cadence: "daily", interval: 1, endDate: "2030-01-17" },
  });
  assert.equal(buildCreateEventPayload(draft).bookingKind, "recurring");
});

test("builds array payload required by add-attendee endpoint", () => {
  assert.deepEqual(
    buildAddAttendeePayload({ eventId: "event-1", attendeeEmail: "guest@example.test" }),
    [{ event_id: "event-1", attendee_email: "guest@example.test" }]
  );
});

test("on-behalf organizer email is sent on create only", () => {
  assert.deepEqual(organizerEmailField({}), {});
  assert.deepEqual(organizerEmailField({ organizerEmail: "   " }), {});
  assert.deepEqual(
    organizerEmailField({ organizerEmail: " budi@contoh.id " }),
    { organizer_email: "budi@contoh.id" }
  );

  const single = {
    id: "event-1",
    organizer: "resepsionis@contoh.id",
    organizerEmail: "budi@contoh.id",
    subject: "Planning",
    description: "",
    startDate,
    endDate,
    attendees,
  };
  const create = buildCreateEventPayload(single);
  assert.equal(create.length, 2);
  // The booker stays the organizer of the request; the employee is named
  // separately so the server can record booked_by = the receptionist.
  assert.equal(create[0].organizer, "resepsionis@contoh.id");
  assert.equal(create[0].organizer_email, "budi@contoh.id");
  assert.equal(create[1].organizer_email, "budi@contoh.id");

  const update = buildUpdateEventPayload(single);
  assert.equal(Object.hasOwn(update, "organizer_email"), false);

  const recurring = buildCreateEventPayload({
    ...single,
    bookingKind: "recurring",
    recurrence: { cadence: "daily", interval: 1, endDate: "2030-01-17" },
  });
  assert.equal(recurring.bookingKind, "recurring");
  assert.equal(recurring.organizer_email, "budi@contoh.id");
  // The preview payload stays free of the create-only field.
  assert.equal(Object.hasOwn(buildModernEventPayload(single), "organizer_email"), false);
});

test("a booking without an on-behalf employee sends no organizer email", () => {
  const draft = {
    organizer: "budi@contoh.id",
    subject: "Planning",
    startDate,
    endDate,
    attendees,
  };
  assert.equal(Object.hasOwn(buildCreateEventPayload(draft)[0], "organizer_email"), false);
  assert.equal(
    Object.hasOwn(
      buildCreateEventPayload({ ...draft, bookingKind: "recurring", recurrence: { cadence: "daily", endDate: "2030-01-17" } }),
      "organizer_email"
    ),
    false
  );
});
