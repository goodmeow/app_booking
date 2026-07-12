import assert from "node:assert/strict";
import test from "node:test";
import { queryString, withQuery } from "../redux/query-string.js";

test("removes empty query values and encodes retained values", () => {
  assert.equal(
    queryString({ event_id: "event/id + one", empty: "", missing: null }),
    "event_id=event%2Fid+%2B+one"
  );
});

test("does not append empty question mark", () => {
  assert.equal(withQuery("events", {}), "events");
  assert.equal(withQuery("events/delete", { event_id: "event-1" }), "events/delete?event_id=event-1");
});

test("encodes available-room contract keys", () => {
  assert.equal(
    withQuery("rooms/available", {
      start_dates: "2030-01-15 09:00:00",
      end_dates: "2030-01-15 10:00:00",
      rooms: "meeting+one@room.com",
    }),
    "rooms/available?start_dates=2030-01-15+09%3A00%3A00&end_dates=2030-01-15+10%3A00%3A00&rooms=meeting%2Bone%40room.com"
  );
});
