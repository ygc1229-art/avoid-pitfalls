import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("database migration", () => {
  it("creates the V1 relational model on PostgreSQL-compatible storage", async () => {
    const database = new PGlite();
    const migrationDirectory = join(process.cwd(), "db", "migrations");
    const migrations = (await readdir(migrationDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();

    for (const filename of migrations) {
      await database.exec(
        await readFile(join(migrationDirectory, filename), "utf8"),
      );
    }
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
