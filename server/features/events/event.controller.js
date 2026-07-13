import {
  addAttendee,
  cancelEvent,
  checkInEvent,
  createEvents,
  deleteAttendee,
  earlyFinishEvent,
  getEventDetails,
  listEvents,
  previewEvents,
  updateEvents,
} from "./event.service.js";

const notify = (req) => req.io?.emit("response:event", { type: "events:changed" });

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const list = run(async (req, res) => res.json(await listEvents(req.query, req.auth)));
export const details = run(async (req, res) => res.json(await getEventDetails(req.query.event_id, req.auth)));
export const preview = run(async (req, res) => res.json(await previewEvents(req.body)));
export const create = run(async (req, res) => {
  const result = await createEvents(req.body, req.auth);
  notify(req);
  res.status(200).json(result);
});
export const update = run(async (req, res) => {
  const result = await updateEvents(req.body, req.auth);
  notify(req);
  res.json(result);
});
export const add = run(async (req, res) => {
  const result = await addAttendee(req.body, req.auth);
  notify(req);
  res.json(result);
});
export const removeAttendee = run(async (req, res) => {
  const result = await deleteAttendee(req.query.event_detail_id, req.auth);
  notify(req);
  res.json(result);
});
export const cancel = run(async (req, res) => {
  const result = await cancelEvent(req.query.event_id || req.params.eventId, req.body?.scope || req.query.scope, req.auth);
  notify(req);
  res.json(result);
});
export const checkIn = run(async (req, res) => {
  const result = await checkInEvent(req.body, req.auth);
  notify(req);
  res.json(result);
});
export const earlyFinish = run(async (req, res) => {
  const result = await earlyFinishEvent(req.body.event_id, req.auth);
  notify(req);
  res.json(result);
});
