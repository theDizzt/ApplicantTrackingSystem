import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

// migrations/ 안의 .sql 파일을 파일명 순서대로 모두 적용한다.
// 각 마이그레이션은 재실행해도 안전하도록(IF NOT EXISTS 등) 작성해야 한다.

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run database migrations");
}

const migrationsDir = fileURLToPath(new URL("../migrations/", import.meta.url));
const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();
try {
  for (const file of files) {
    const sql = await readFile(new URL(file, new URL("../migrations/", import.meta.url)), "utf8");
    await client.query(sql);
  }
} finally {
  await client.end();
}
