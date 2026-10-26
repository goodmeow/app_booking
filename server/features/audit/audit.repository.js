import { query } from "../../db/pool.js";

const actorFrom = (principal) => ({
  id: principal?._id || null,
  name: principal?.name || null,
});

export const writeAudit = async ({
  principal,
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
}, execute = query) => {
  const actor = actorFrom(principal);
  await execute(
    `INSERT INTO tbl_audit_log
       (actor_id, actor_name, action, entity_type, entity_id, old_values, new_values)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [
      actor.id,
      actor.name,
      action,
      entityType,
      entityId == null ? null : String(entityId),
      oldValues == null ? null : JSON.stringify(oldValues),
      newValues == null ? null : JSON.stringify(newValues),
    ]
  );
};

export const listAudit = async ({ limit = 100, entityType = null, entityId = null } = {}) => (await query(
  `SELECT _id, actor_id, actor_name, action, entity_type, entity_id,
          old_values, new_values, created_at
   FROM tbl_audit_log
   WHERE ($1::text IS NULL OR entity_type = $1)
     AND ($2::text IS NULL OR entity_id = $2)
   ORDER BY created_at DESC, _id DESC
   LIMIT $3`,
  [entityType, entityId == null ? null : String(entityId), Math.min(Math.max(Number(limit) || 100, 1), 500)]
)).rows;
