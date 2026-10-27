import { createRoom, deleteRoom, editRoom, getAvailableRooms, getRoom, getRooms, getRoomStatus, getRoomUsage } from "./room.service.js";
import { revokeRoomKioskDevices } from "../kiosk/kiosk.repository.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const list = run(async (req, res) => res.json(await getRooms(req.query, req.auth)));
export const available = run(async (req, res) => res.json(await getAvailableRooms(req.query)));
export const read = run(async (req, res) => res.json(await getRoom(req.params.roomId, req.auth)));
export const create = run(async (req, res) => res.status(201).json(await createRoom(req.body)));
export const update = run(async (req, res) => res.json(await editRoom(req.params.roomId, req.body)));
export const remove = run(async (req, res) => {
  const room = await deleteRoom(req.params.roomId);
  const revokedDevices = await revokeRoomKioskDevices(room._id, req.auth._id);
  for (const device of revokedDevices) {
    req.io?.of("/").in(`device:${device.device_id}`).disconnectSockets(true);
  }
  res.json(room);
});
export const usage = run(async (req, res) => res.json(await getRoomUsage(req.query)));
export const status = run(async (req, res) => res.json(await getRoomStatus(req.auth)));
