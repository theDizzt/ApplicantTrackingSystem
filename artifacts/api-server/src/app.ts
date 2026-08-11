import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes";
import { logger } from "./lib/logger";

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required");
}

const app: Express = express();

const isProduction = process.env.NODE_ENV === "production";

// Behind Replit's HTTPS proxy in production; needed so express-session
// can see the original protocol and set secure cookies correctly.
if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

const PgSession = connectPgSimple(session);

const sessionStore = new PgSession({
  pool,
  tableName: "user_sessions",
  // Prune expired session rows every 15 minutes so the table stays
  // close to the number of actually active sessions.
  pruneSessionInterval: 60 * 15, // seconds
});

// connect-pg-simple only starts its prune timer lazily (on the first session
// operation) and fires after a randomized delay. Prune once at startup so
// expired rows are cleared immediately, even on servers with little traffic.
sessionStore.pruneSessions((err?: Error) => {
  if (err) {
    logger.error({ err }, "Failed to prune expired sessions at startup");
  } else {
    logger.info("Pruned expired sessions at startup");
  }
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    // "auto": set the Secure flag only when the request actually arrived over
    // HTTPS (via trust proxy + X-Forwarded-Proto). This keeps login working on
    // plain-HTTP local/on-prem installs while staying secure behind HTTPS.
    secure: "auto",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
