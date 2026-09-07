import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to migrate the guided prompt monitor schema");
}

const migrationUrl = new URL("../migrations/0001_guided_prompt_monitor.sql", import.meta.url);
const sql = await readFile(fileURLToPath(migrationUrl), "utf8");
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();
try {
  await client.query(sql);
} finally {
  await client.end();
}