import winston from 'winston';

export interface LoggerOptions {
  level?: string;
  name: string;
  logFile?: string;
}

export function createLogger(options: LoggerOptions): winston.Logger {
  const { level = 'info', name, logFile } = options;

  const transports: winston.transport[] = [
    new winston.transports.Console(),
  ];

  if (logFile) {
    transports.push(
      new winston.transports.File({
        filename: logFile,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );
  }

  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level.toUpperCase()} [${name}] ${message}${metaStr}`;
      })
    ),
    transports,
  });
}

export function createWorkerLogger(workerId: string): winston.Logger {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, url, error }) => {
        const urlTag = url ? ` [${url}]` : '';
        const errorTag = error ? ` ERROR: ${error}` : '';
        return `${timestamp} ${level.toUpperCase()} [${workerId}]${urlTag} ${message}${errorTag}`;
      })
    ),
    defaultMeta: { workerId },
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: `logs/crawler-${workerId}.log`,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),
    ],
  });
}

export function createScannerWorkerLogger(workerId: string): winston.Logger {
  return winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, domain, error }) => {
        const domainTag = domain ? ` [${domain}]` : '';
        const errorTag = error ? ` ERROR: ${error}` : '';
        return `${timestamp} ${level.toUpperCase()} [${workerId}]${domainTag} ${message}${errorTag}`;
      })
    ),
    defaultMeta: { workerId },
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({
        filename: `logs/scanner-${workerId}.log`,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),
    ],
  });
}
