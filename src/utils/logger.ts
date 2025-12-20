import pino from "pino";

const transport = pino.transport({
  target: "pino-pretty",
  options: {
    colorize: true,
    translateTime: "HH:MM:ss",
    ignore: "pid,hostname",
    messageFormat: "{msg}",
  },
});

const baseLogger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
  },
  transport
);

export function createLogger(module: string) {
  return baseLogger.child({ module });
}

// Pre-created loggers for main modules
export const logger = {
  server: createLogger("server"),
  session: createLogger("session"),
  queue: createLogger("queue"),
  daemon: createLogger("daemon"),
};
