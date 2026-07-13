import { createRoom, deleteRoom, editRoom, getAvailableRooms, getRoom, getRooms, getRoomUsage } from "./room.service.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const list = run(async (req, res) => res.json(await getRooms(req.query, req.auth)));
export const available = run(async (req, res) => res.json(await getAvailableRooms(req.query)));
export const read = run(async (req, res) => res.json(await getRoom(req.params.roomId, req.auth)));
export const create = run(async (req, res) => res.status(201).json(await createRoom(req.body)));
export const update = run(async (req, res) => res.json(await editRoom(req.params.roomId, req.body)));
export const remove = run(async (req, res) => res.json(await deleteRoom(req.params.roomId)));
export const usage = run(async (req, res) => res.json(await getRoomUsage(req.query)));
