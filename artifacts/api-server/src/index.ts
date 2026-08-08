import app from "./app";
import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { startScheduler } from "./scheduler";

/**
 * Idempotent bootstrap: ensure the express-session store table exists.
 * Production databases provisioned before this feature won't have it,
 * and connect-pg-simple does not create it on its own here.
 */
async function ensureSessionTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid" varchar PRIMARY KEY,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");`,
  );
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureSessionTable()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
      startScheduler();
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure session table");
    process.exit(1);
  });
