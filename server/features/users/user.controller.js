import { changeUserPassword, createUser, deleteUser, editUser, getUser, getUsers } from "./user.service.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const list = run(async (req, res) => res.json(await getUsers(req.auth, req.query)));
export const read = run(async (req, res) => res.json(await getUser(req.params.userId)));
export const create = run(async (req, res) => res.status(201).json(await createUser(req.body, req.auth)));
export const update = run(async (req, res) => res.json(await editUser(req.params.userId, req.body, req.auth)));
export const remove = run(async (req, res) => res.json(await deleteUser(req.params.userId, req.auth)));
export const changePassword = run(async (req, res) => {
  const revokedDevices = await changeUserPassword(req.body, req.auth);
  for (const device of revokedDevices) {
    req.io?.of("/").in(`device:${device.device_id}`).disconnectSockets(true);
  }
  res.json({ message: "Password successfully changed" });
});
