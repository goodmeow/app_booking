import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  MIN_DIRECTORY_QUERY_LENGTH,
  directoryEmails,
  directoryQuery,
  directoryUrl,
  mergeUserIndex,
  userIndexByEmail,
} from "../domain/users/attendee-directory.js";

test("directory URL only adds ?q= when a search term exists", () => {
  assert.equal(directoryUrl(), "users/");
  assert.equal(directoryUrl(undefined), "users/");
  assert.equal(directoryUrl("   "), "users/");
  assert.equal(directoryUrl({ q: "" }), "users/");
  assert.equal(directoryUrl("harun"), "users/?q=harun");
  assert.equal(directoryUrl({ q: " harun@prasada.id " }), "users/?q=harun%40prasada.id");
  assert.equal(directoryUrl({ q: "budi santoso" }), "users/?q=budi%20santoso");
});

test("directory query trims string and object arguments alike", () => {
  assert.equal(MIN_DIRECTORY_QUERY_LENGTH, 2);
  assert.equal(directoryQuery(" a "), "a");
  assert.equal(directoryQuery({ q: " a " }), "a");
  assert.equal(directoryQuery(undefined), "");
});

test("user index maps e-mail to user and lists unique option addresses", () => {
  const users = [
    { _id: "u1", name: "Harun", email: "harun@prasada.id" },
    { _id: "u2", name: "Budi", email: "BUDI@prasada.id" },
    { _id: "u3", name: "No Mail", email: "" },
  ];
  assert.equal(userIndexByEmail(users).get("harun@prasada.id")._id, "u1");
  assert.equal(userIndexByEmail(users).size, 2);
  assert.deepEqual(directoryEmails(users), ["harun@prasada.id", "BUDI@prasada.id"]);
});

test("merged index keeps earlier users so selected attendees keep their id", () => {
  const first = mergeUserIndex(new Map(), [{ _id: "u1", name: "Harun", email: "harun@prasada.id" }]);
  const second = mergeUserIndex(first, [{ _id: "u2", name: "Budi", email: "budi@prasada.id" }]);
  assert.equal(second.get("harun@prasada.id")._id, "u1");
  assert.equal(second.get("budi@prasada.id")._id, "u2");
  // Unchanged input returns the same map so the effect does not loop.
  assert.equal(mergeUserIndex(second, [{ _id: "u2", name: "Budi", email: "budi@prasada.id" }]), second);
});

test("listUser forwards the search argument and keeps the users tag", () => {
  const service = fs.readFileSync(new URL("../redux/services/users.js", import.meta.url), "utf8");
  assert.match(service, /listUser: builder\.query\(\{ query: \(argument\) => directoryUrl\(argument\), providesTags: \["users"\] \}\)/);
});

test("attendee picker searches on demand with a debounce instead of loading the directory", () => {
  const picker = fs.readFileSync(new URL("../calendar/AttendeePicker.js", import.meta.url), "utf8");
  const calendar = fs.readFileSync(new URL("../calendar/MeetingCalendar.js", import.meta.url), "utf8");
  assert.match(picker, /useListUserQuery\(\{ q: searchTerm \}, \{ skip: isAdmin \|\| !searchTerm \}\)/);
  assert.match(picker, /SEARCH_DEBOUNCE_MS = 300/);
  assert.match(picker, /MIN_DIRECTORY_QUERY_LENGTH/);
  // The calendar only asks for the full list as an admin.
  assert.match(calendar, /useListUserQuery\(undefined, \{ skip: !isAdmin \}\)/);
  assert.match(calendar, /isAdmin=\{isAdmin\}/);
});
