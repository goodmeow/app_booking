import { authenticateKioskCredentials, checkInKioskEvent, finishKioskEvent, getKioskContext, getKioskSchedule, publicKioskRoom, signKioskToken } from "./kiosk.service.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const signin = run(async (req, res) => {
  const room = await authenticateKioskCredentials(req.body.email || req.body.username, req.body.password);
  res.json({ token: signKioskToken(room), room: publicKioskRoom(room) });
});

export const context = run(async (req, res) => res.json(await getKioskContext(req.kiosk)));
export const schedule = run(async (req, res) => res.json(await getKioskSchedule(req.query, req.kiosk)));
export const checkIn = run(async (req, res) => {
  const result = await checkInKioskEvent(req.body, req.kiosk);
  req.io?.emit("response:event", { type: "events:changed" });
  res.json(result);
});
export const earlyFinish = run(async (req, res) => {
  const result = await finishKioskEvent(req.body, req.kiosk);
  req.io?.emit("response:event", { type: "events:changed" });
  res.json(result);
});
