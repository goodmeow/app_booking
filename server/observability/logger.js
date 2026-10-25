const allowedFields = new Set([
  "request_id",
  "method",
  "path",
  "status",
  "duration_ms",
  "error_code",
  "operation",
  "count",
]);

const safeFields = (fields = {}) => Object.fromEntries(
  Object.entries(fields).filter(([key, value]) => allowedFields.has(key) && value !== undefined)
);

export const log = (severity, event, fields) => {
  const entry = {
    timestamp: new Date().toISOString(),
    severity,
    event,
    ...safeFields(fields),
  };
  const output = JSON.stringify(entry);
  if (severity === "error") console.error(output);
  else console.log(output);
};
