import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var __panelflowPgPool: Pool | undefined;
  var __panelflowSchemaPromise: Promise<void> | undefined;
}

function getPool(): Pool {
  if (!globalThis.__panelflowPgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not configured");
    }
    globalThis.__panelflowPgPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalThis.__panelflowPgPool;
}

export const SCHEMA_SQL = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    provider VARCHAR(50) DEFAULT 'email',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    favorite_part_ids JSONB DEFAULT '[]'::jsonb,
    recent_part_ids JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    thumbnail TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS custom_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    format VARCHAR(10) NOT NULL,
    bounding_box JSONB NOT NULL,
    pins JSONB NOT NULL,
    cad_data TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_projects_user_updated
    ON projects (user_id, updated_at DESC);

  CREATE INDEX IF NOT EXISTS idx_custom_parts_user_created
    ON custom_parts (user_id, created_at DESC);
`;

export async function ensureSchema(): Promise<void> {
  if (!globalThis.__panelflowSchemaPromise) {
    globalThis.__panelflowSchemaPromise = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        globalThis.__panelflowSchemaPromise = undefined;
        throw err;
      });
  }
  return globalThis.__panelflowSchemaPromise;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  await ensureSchema();
  return getPool().query<T>(text, params);
}
