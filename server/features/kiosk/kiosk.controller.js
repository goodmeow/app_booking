import {
  checkInKioskEvent,
  deprovisionKioskDevice,
  finishKioskEvent,
  getKioskContext,
  getKioskSchedule,
  getManagedKioskDevices,
  provisionKioskDevice,
  refreshKioskDeviceSession,
  revokeManagedKioskDevice,
} from "./kiosk.service.js";
import { findEventAudience } from "../events/event.repository.js";
import { emitEventInvalidation } from "../../socket/event-invalidation.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const signin = run(async (req, res) => {
  res.json(await provisionKioskDevice({
    login: req.body.email || req.body.username,
    password: req.body.password,
    deviceName: req.body.deviceName,
  }));
});

const disconnectDevice = (req, deviceId) => req.io?.of("/").in(`device:${deviceId}`).disconnectSockets(true);

export const refresh = run(async (req, res) => {
  const session = await refreshKioskDeviceSession(req.body.refreshToken);
  disconnectDevice(req, session.device.id);
  res.json(session);
});

export const devices = run(async (req, res) => res.json(await getManagedKioskDevices(req.query.roomId)));
export const revokeDevice = run(async (req, res) => {
  const device = await revokeManagedKioskDevice(req.params.deviceId, req.auth._id);
  disconnectDevice(req, device.device_id);
  res.json({ id: device.device_id, status: "revoked" });
});

export const context = run(async (req, res) => res.json(await getKioskContext(req.kiosk)));
export const schedule = run(async (req, res) => res.json(await getKioskSchedule(req.query, req.kiosk)));
export const deprovision = run(async (req, res) => {
  const device = await deprovisionKioskDevice(req.kiosk.deviceId);
  disconnectDevice(req, device.device_id);
  res.json({ id: device.device_id, status: "revoked" });
});
export const checkIn = run(async (req, res) => {
  const result = await checkInKioskEvent(req.body, req.kiosk);
  emitEventInvalidation(req.io, await findEventAudience([result?._id]));
  res.json(result);
});
export const earlyFinish = run(async (req, res) => {
  const result = await finishKioskEvent(req.body, req.kiosk);
  emitEventInvalidation(req.io, await findEventAudience([result?._id]));
  res.json(result);
});
