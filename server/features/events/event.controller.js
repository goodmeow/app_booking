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
import { findDetailEventId, findEventAudience, findMutationAudience } from "./event.repository.js";
import { emitEventInvalidation, mergeEventAudiences } from "../../socket/event-invalidation.js";

const eventIdsFrom = (result) => {
  if (Array.isArray(result)) return [...new Set(result.map((item) => item?.event_id || item?.id || item?._id).filter(Boolean))];
  if (Array.isArray(result?.occurrences)) return result.occurrences.map((item) => item.id).filter(Boolean);
  return [result?.event_id || result?.id || result?._id].filter(Boolean);
};

const notify = (req, audiences) => emitEventInvalidation(req.io, audiences);

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const list = run(async (req, res) => res.json(await listEvents(req.query, req.auth)));
export const details = run(async (req, res) => res.json(await getEventDetails(req.query.event_id, req.auth)));
export const preview = run(async (req, res) => res.json(await previewEvents(req.body, req.auth)));
export const create = run(async (req, res) => {
  const result = await createEvents(req.body, req.auth);
  notify(req, await findEventAudience(eventIdsFrom(result)));
  res.status(200).json(result);
});
export const update = run(async (req, res) => {
  const eventId = req.body.id || req.body.eventId || req.params.eventId;
  const before = await findMutationAudience(eventId, req.body.scope || "occurrence");
  const result = await updateEvents(req.body, req.auth);
  notify(req, mergeEventAudiences(before, await findEventAudience(eventIdsFrom(result))));
  res.json(result);
});
export const add = run(async (req, res) => {
  const result = await addAttendee(req.body, req.auth);
  notify(req, await findEventAudience(eventIdsFrom(result)));
  res.json(result);
});
export const removeAttendee = run(async (req, res) => {
  const eventId = await findDetailEventId(req.query.event_detail_id);
  const before = await findEventAudience([eventId]);
  const result = await deleteAttendee(req.query.event_detail_id, req.auth);
  notify(req, before);
  res.json(result);
});
export const cancel = run(async (req, res) => {
  const eventId = req.query.event_id || req.params.eventId;
  const scope = req.body?.scope || req.query.scope || "occurrence";
  const before = await findMutationAudience(eventId, scope);
  const result = await cancelEvent(eventId, scope, req.auth);
  notify(req, before);
  res.json(result);
});
export const checkIn = run(async (req, res) => {
  const result = await checkInEvent(req.body, req.auth);
  notify(req, await findEventAudience(eventIdsFrom(result)));
  res.json(result);
});
export const earlyFinish = run(async (req, res) => {
  const result = await earlyFinishEvent(req.body.event_id, req.auth);
  notify(req, await findEventAudience(eventIdsFrom(result)));
  res.json(result);
});
