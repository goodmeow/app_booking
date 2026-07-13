import pg from "pg";
import config from "../../config/config.js";
import { log } from "../observability/logger.js";

const { Pool } = pg;
let pool;

export const getPool = () => {
  if (pool) return pool;
  pool = new Pool(config.pgConn);
  pool.on("error", (error) => {
    log("error", "database_pool_error", { error_code: error.code || "PG_POOL_ERROR" });
  });
  return pool;
};

export const closePool = async () => {
  if (!pool) return;
  const activePool = pool;
  pool = undefined;
  await activePool.end();
};

export const query = (text, values = []) => getPool().query(text, values);

export const withTransaction = async (work) => {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
