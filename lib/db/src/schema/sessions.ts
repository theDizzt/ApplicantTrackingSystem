import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

// express-session store table (connect-pg-simple)
export const userSessionsTable = pgTable(
  "user_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6, mode: "date" }).notNull(),
  },
  (table) => [index("IDX_user_sessions_expire").on(table.expire)],
);
