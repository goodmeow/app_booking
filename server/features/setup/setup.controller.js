import { completeSetup, readSetupStatus } from "./setup.service.js";

const run = (handler) => async (req, res, next) => {
  try { await handler(req, res); } catch (error) { next(error); }
};

export const status = run(async (req, res) => res.json(await readSetupStatus()));

export const create = run(async (req, res) => {
  const user = await completeSetup(req.body || {});
  res.status(201).json({ message: "Initial setup completed", user });
});
