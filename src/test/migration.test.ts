import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("database migration", () => {
  it("creates the V1 relational model on PostgreSQL-compatible storage", async () => {
    const database = new PGlite();
    const migration = await readFile(
      join(process.cwd(), "db", "migrations", "001_initial.sql"),
      "utf8",
    );

    await database.exec(migration);
    const result = await database.query<{ table_name: string }>(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = 'public'
    `);
    const tables = new Set(result.rows.map((row) => row.table_name));

    for (const required of [
      "users",
      "sessions",
      "posts",
      "comments",
      "favorites",
      "reports",
      "moderation_events",
      "point_events",
      "badges",
    ]) {
      expect(tables.has(required)).toBe(true);
    }
    await database.close();
  });
});
