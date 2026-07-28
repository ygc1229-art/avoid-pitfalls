import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { DatabaseUnavailableError } from "./errors";

declare global {
  var __avoidPitfallsPool: Pool | undefined;
}

const RETRY_COOLDOWN_MS = 10_000;
let unavailableUntil = 0;
let lastFailure = "";

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return undefined;

  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
    ssl:
      process.env.PGSSL === "require"
        ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== "false" }
        : undefined,
  });

  pool.on("error", (error) => markUnavailable(error));
  return pool;
}

export function getPool() {
  globalThis.__avoidPitfallsPool ??= createPool();
  return globalThis.__avoidPitfallsPool;
}

function markUnavailable(error: unknown) {
  unavailableUntil = Date.now() + RETRY_COOLDOWN_MS;
  lastFailure = error instanceof Error ? error.message : String(error);
  console.error("[db] temporarily unavailable", lastFailure);
}

function ensureAvailable() {
  if (!process.env.DATABASE_URL) {
    throw new DatabaseUnavailableError(
      "未配置 DATABASE_URL；当前仅支持公开样本只读浏览，写入未保存。",
    );
  }
  if (Date.now() < unavailableUntil) {
    throw new DatabaseUnavailableError();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<QueryResult<T>> {
  ensureAvailable();
  const pool = getPool();
  if (!pool) throw new DatabaseUnavailableError();

  try {
    const result = await pool.query<T>(text, values);
    unavailableUntil = 0;
    return result;
  } catch (error) {
    markUnavailable(error);
    throw new DatabaseUnavailableError();
  }
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  ensureAvailable();
  const pool = getPool();
  if (!pool) throw new DatabaseUnavailableError();

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const value = await callback(client);
    await client.query("COMMIT");
    unavailableUntil = 0;
    return value;
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof DatabaseUnavailableError) throw error;
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    if (code.startsWith("23")) throw error;
    markUnavailable(error);
    throw new DatabaseUnavailableError();
  } finally {
    client?.release();
  }
}

export async function databaseHealth() {
  if (!process.env.DATABASE_URL) {
    return {
      available: false,
      mode: "file-fallback" as const,
      reason: "DATABASE_URL is not configured",
    };
  }
  try {
    await query("SELECT 1");
    return { available: true, mode: "postgres" as const };
  } catch {
    return {
      available: false,
      mode: "file-fallback" as const,
      reason: lastFailure || "connection failed",
    };
  }
}
