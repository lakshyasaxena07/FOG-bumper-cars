// Winston logger: console + daily rotating file in <dataRoot>/logs.
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

let base: winston.Logger | null = null;

export function initLogging(dir: string) {
  base = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf((i) => `${i.timestamp} ${String(i.level).toUpperCase().padEnd(5)} ${i.scope}: ${i.message}`),
    ),
    transports: [
      new winston.transports.Console(),
      new DailyRotateFile({ dirname: dir, filename: 'bumper-car-%DATE%.log', datePattern: 'YYYY-MM-DD', maxFiles: '14d' }),
    ],
  });
}

function emit(level: 'info' | 'warn' | 'error', scope: string, msg: string, err?: unknown) {
  const text = err ? `${msg}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}` : msg;
  if (base) base.log(level, text, { scope });
  else console[level](`${scope}: ${text}`); // before init / in tests
}

export const getLogger = (scope: string) => ({
  info: (msg: string) => emit('info', scope, msg),
  warn: (msg: string, err?: unknown) => emit('warn', scope, msg, err),
  error: (msg: string, err?: unknown) => emit('error', scope, msg, err),
});
