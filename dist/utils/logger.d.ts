import winston from 'winston';
export interface LoggerOptions {
    level?: string;
    name: string;
    logFile?: string;
}
export declare function createLogger(options: LoggerOptions): winston.Logger;
export declare function createWorkerLogger(workerId: string): winston.Logger;
export declare function createScannerWorkerLogger(workerId: string): winston.Logger;
//# sourceMappingURL=logger.d.ts.map