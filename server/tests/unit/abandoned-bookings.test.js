import assert from "node:assert/strict";
import { test } from "node:test";
import { releaseAbandonedRoomBookings } from "../../features/events/event.repository.js";

const abandonedEventId = "60000000-0000-4000-8000-000000000001";

// Releasing a room and marking the meeting details must share one connection:
// a split leaves the room freed while the details stay active, and the
// phase9_sync_event_room trigger then reactivates the room on the next update.
test("abandoned room release runs both statements on one transaction client", async () => {
  const statements = [];
  const client = {
    query: async (text, values) => {
      statements.push({ text, values });
      if (statements.length === 1) {
        return { rows: [{ event_id: abandonedEventId }] };
      }
      return { rows: [] };
    },
  };

  const releasedIds = await releaseAbandonedRoomBookings(async (work) => work(client));

  assert.deepEqual(releasedIds, [abandonedEventId]);
  assert.equal(statements.length, 3);
  assert.match(statements[0].text, /UPDATE tbl_event_rooms/);
  assert.match(statements[1].text, /UPDATE tbl_event_details/);
  assert.deepEqual(statements[1].values, [[abandonedEventId]]);
  assert.match(statements[2].text, /INSERT INTO tbl_audit_log/);
  assert.equal(statements[2].values[1], "auto-release");
  assert.equal(statements[2].values[2], "event.room_auto_release");
  assert.equal(statements[2].values[4], abandonedEventId);
});

test("no details update is sent when no room booking expired", async () => {
  const statements = [];
  const client = {
    query: async (text, values) => {
      statements.push({ text, values });
      return { rows: [] };
    },
  };

  const releasedIds = await releaseAbandonedRoomBookings(async (work) => work(client));

  assert.deepEqual(releasedIds, []);
  assert.equal(statements.length, 1);
});
