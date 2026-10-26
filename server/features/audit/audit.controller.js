import { listAudit } from "./audit.repository.js";

const run = (handler) => async (req, res, next) => {
  try {
    await handler(req, res);
  } catch (error) {
    next(error);
  }
};

export const readAudit = run(async (req, res) => {
  res.json(await listAudit({
    limit: req.query.limit,
    entityType: req.query.entity_type || null,
    entityId: req.query.entity_id || null,
  }));
});
