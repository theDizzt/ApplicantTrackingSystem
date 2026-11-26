import pino from "pino";
import pretty from "pino-pretty";

const isProduction = process.env.NODE_ENV === "production";

const options: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
};

// 개발 모드에서는 pino-pretty를 워커 스레드(transport)가 아니라 메인 스레드에서 돌리고
// process.stdout으로 출력한다. 워커는 fd 1에 UTF-8 바이트를 그대로 써서,
// Windows 콘솔(CP949)에서 한글·이모지가 깨지기 때문이다.
export const logger = isProduction
  ? pino(options)
  : pino(options, pretty({ colorize: true, destination: process.stdout }));
