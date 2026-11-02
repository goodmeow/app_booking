import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { apiRequest, resetParityDatabase, startServer, stopServer, targets } from "../parity/harness.js";
import { bearer, identities } from "../parity/fixtures.js";

// Face-unlock forwards kiosk frames to an internal face service. The real one is
// a FastAPI + ONNX stack that never runs in tests, so this suite points
// FACE_SERVICE_URL at a tiny stub whose response the test controls per case.
let server;
let stub;
let stubUrl;
let stubMode = "ok";
let stubPayload = {};

const kioskHeaders = () => ({ Authorization: `Bearer ${kioskToken}`, "Content-Type": "application/json" });
let kioskToken;

before(async () => {
  await resetParityDatabase();

  stub = http.createServer((req, res) => {
    if (stubMode === "reset") {
      // Simulate an unreachable face service: the socket dies mid-request, so
      // app_booking's fetch rejects and the kiosk gets a clean 503.
      req.socket.destroy();
      return;
    }
    if (stubMode === "error") {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end('{"detail":"boom"}');
      return;
    }
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(stubPayload));
    });
  });
  await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
  stubUrl = `http://127.0.0.1:${stub.address().port}`;

  // startServer spreads process.env into the child, and dotenv does not override
  // variables already present, so the server picks this up without harness changes.
  process.env.FACE_SERVICE_URL = stubUrl;
  server = await startServer(targets.reconstructed);

  const authenticated = await apiRequest(targets.reconstructed, "/api/kiosk/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: identities.room.email,
      password: "RoomTablet123!",
      deviceName: "Face Unlock Tablet",
    }),
  });
  assert.equal(authenticated.status, 200);
  kioskToken = authenticated.body.token;
});

after(async () => {
  delete process.env.FACE_SERVICE_URL;
  await stopServer(server);
  if (stub) await new Promise((resolve) => stub.close(resolve));
});

const createMeeting = async ({ room, subject, start, end }) => apiRequest(targets.reconstructed, "/api/events", {
  method: "POST",
  headers: bearer("admin"),
  body: JSON.stringify([
    { organizer: identities.admin.email, subject, description: "private", start_date: start, end_date: end, attendee_email: identities.admin.email },
    { organizer: identities.admin.email, subject, description: "private", start_date: start, end_date: end, attendee_email: room },
  ]),
});

const faceUnlock = (frames) => apiRequest(targets.reconstructed, "/api/kiosk/face-unlock", {
  method: "POST",
  headers: kioskHeaders(),
  body: JSON.stringify({ frames }),
});

const frame = "aGVsbG8td29ybGQ="; // arbitrary base64; the stub never decodes it

test("face-unlock requires a kiosk session and rejects malformed frames", async () => {
  const unauthenticated = await apiRequest(targets.reconstructed, "/api/kiosk/face-unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frames: [frame] }),
  });
  assert.equal(unauthenticated.status, 401);

  const empty = await faceUnlock([]);
  assert.equal(empty.status, 400);
  assert.equal(empty.body.code, "INVALID_FRAMES");

  const nonString = await faceUnlock([123]);
  assert.equal(nonString.status, 400);
  assert.equal(nonString.body.code, "INVALID_FRAMES");
});

test("an active booking in this room lets a matched face in", async () => {
  const now = Date.now();
  const meeting = await createMeeting({
    room: identities.room.email,
    subject: "Face unlock meeting",
    start: new Date(now - 60_000).toISOString(),
    end: new Date(now + 20 * 60_000).toISOString(),
  });
  assert.equal(meeting.status, 200);

  stubMode = "ok";
  stubPayload = {
    result: "match",
    score: 0.72,
    margin: 0.3,
    face_group: "EMP-ADMIN",
    candidates: [{ employee_id: "EMP-ADMIN", score: 0.72 }],
  };

  const allowed = await faceUnlock([frame, frame, frame]);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.allowed, true);
  assert.equal(allowed.body.result, "match");
  assert.equal(allowed.body.employeeId, "EMP-ADMIN");
  assert.equal(allowed.body.eventId, meeting.body[0].id);

  await apiRequest(targets.reconstructed, `/api/events/${meeting.body[0].id}`, {
    method: "DELETE",
    headers: bearer("admin"),
  });
});

test("a match without an active booking in this room is refused", async () => {
  // EMP-USER is a real employee but has no running booking in room one, so a
  // face that identifies as them must not open this room.
  stubMode = "ok";
  stubPayload = {
    result: "match",
    score: 0.7,
    margin: 0.25,
    face_group: "EMP-USER",
    candidates: [{ employee_id: "EMP-USER", score: 0.7 }],
  };

  const refused = await faceUnlock([frame]);
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, "NOT_AUTHORIZED_FOR_ROOM");
});

test("a recognition miss falls back to the card instead of failing", async () => {
  stubMode = "ok";

  for (const payload of [
    { result: "no_match", score: 0.4, margin: 0.1, face_group: null, candidates: [] },
    { result: "no_face", score: null, margin: null, face_group: null, candidates: [] },
    { result: "ambiguous", score: 0.61, margin: 0.02, face_group: null, candidates: [] },
  ]) {
    stubPayload = payload;
    const missed = await faceUnlock([frame]);
    assert.equal(missed.status, 200);
    assert.equal(missed.body.allowed, false);
    assert.equal(missed.body.result, payload.result);
  }
});

test("an unreachable face service degrades to a 503, not a crash", async () => {
  stubMode = "reset";
  const down = await faceUnlock([frame]);
  assert.equal(down.status, 503);
  assert.equal(down.body.code, "FACE_SERVICE_UNAVAILABLE");

  stubMode = "error";
  const broken = await faceUnlock([frame]);
  assert.equal(broken.status, 502);
  assert.equal(broken.body.code, "FACE_SERVICE_ERROR");
});
