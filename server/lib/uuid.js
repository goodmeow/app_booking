// PostgreSQL uuid columns throw 22P02 on malformed input, which would become a
// 500. Validate identifiers at the edge and treat them as missing instead.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value) => UUID_PATTERN.test(String(value ?? ""));
