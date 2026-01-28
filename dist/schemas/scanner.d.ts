import { z } from 'zod';
export declare const PortStateSchema: z.ZodEnum<["open", "closed", "filtered", "timeout"]>;
export declare const ScanProfileSchema: z.ZodEnum<["quick", "standard", "full", "crypto"]>;
export declare const ScanQueueStatusSchema: z.ZodEnum<["pending", "processing", "completed", "failed"]>;
export declare const ScanQueueItemSchema: z.ZodObject<{
    id: z.ZodNumber;
    domain_id: z.ZodNullable<z.ZodNumber>;
    domain: z.ZodString;
    profile: z.ZodEnum<["quick", "standard", "full", "crypto"]>;
    ports: z.ZodNullable<z.ZodArray<z.ZodNumber, "many">>;
    priority: z.ZodNumber;
    attempts: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    domain: string;
    domain_id: number | null;
    priority: number;
    attempts: number;
    profile: "quick" | "standard" | "full" | "crypto";
    ports: number[] | null;
}, {
    id: number;
    domain: string;
    domain_id: number | null;
    priority: number;
    attempts: number;
    profile: "quick" | "standard" | "full" | "crypto";
    ports: number[] | null;
}>;
export declare const PortScanRowSchema: z.ZodObject<{
    id: z.ZodNumber;
    domain_id: z.ZodNullable<z.ZodNumber>;
    domain: z.ZodString;
    port: z.ZodNumber;
    state: z.ZodEnum<["open", "closed", "filtered", "timeout"]>;
    response_time_ms: z.ZodNullable<z.ZodNumber>;
    banner: z.ZodNullable<z.ZodString>;
    scanned_at: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    port: number;
    id: number;
    domain: string;
    domain_id: number | null;
    state: "timeout" | "open" | "closed" | "filtered";
    response_time_ms: number | null;
    banner: string | null;
    scanned_at: Date;
}, {
    port: number;
    id: number;
    domain: string;
    domain_id: number | null;
    state: "timeout" | "open" | "closed" | "filtered";
    response_time_ms: number | null;
    banner: string | null;
    scanned_at: Date;
}>;
export declare const DetectedServiceRowSchema: z.ZodObject<{
    id: z.ZodNumber;
    port_scan_id: z.ZodNumber;
    domain: z.ZodString;
    port: z.ZodNumber;
    service_name: z.ZodNullable<z.ZodString>;
    service_version: z.ZodNullable<z.ZodString>;
    confidence: z.ZodNullable<z.ZodNumber>;
    raw_banner: z.ZodNullable<z.ZodString>;
    first_seen: z.ZodDate;
    last_seen: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    port: number;
    id: number;
    domain: string;
    first_seen: Date;
    port_scan_id: number;
    service_name: string | null;
    service_version: string | null;
    confidence: number | null;
    raw_banner: string | null;
    last_seen: Date;
}, {
    port: number;
    id: number;
    domain: string;
    first_seen: Date;
    port_scan_id: number;
    service_name: string | null;
    service_version: string | null;
    confidence: number | null;
    raw_banner: string | null;
    last_seen: Date;
}>;
export declare const ScanLockResultSchema: z.ZodObject<{
    acquired: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    acquired: boolean;
}, {
    acquired: boolean;
}>;
export declare const ScanReleaseResultSchema: z.ZodObject<{
    released: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    released: boolean;
}, {
    released: boolean;
}>;
export declare const ScanExtendResultSchema: z.ZodObject<{
    extended: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    extended: boolean;
}, {
    extended: boolean;
}>;
export declare const ScannerStatisticsRowSchema: z.ZodObject<{
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    count: number;
}, {
    count: number;
}>;
export declare const PortScanSummarySchema: z.ZodObject<{
    domain: z.ZodString;
    totalPorts: z.ZodNumber;
    openPorts: z.ZodNumber;
    lastScanned: z.ZodNullable<z.ZodDate>;
    services: z.ZodArray<z.ZodObject<{
        port: z.ZodNumber;
        serviceName: z.ZodNullable<z.ZodString>;
        serviceVersion: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        port: number;
        serviceName: string | null;
        serviceVersion: string | null;
    }, {
        port: number;
        serviceName: string | null;
        serviceVersion: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    domain: string;
    totalPorts: number;
    openPorts: number;
    lastScanned: Date | null;
    services: {
        port: number;
        serviceName: string | null;
        serviceVersion: string | null;
    }[];
}, {
    domain: string;
    totalPorts: number;
    openPorts: number;
    lastScanned: Date | null;
    services: {
        port: number;
        serviceName: string | null;
        serviceVersion: string | null;
    }[];
}>;
export type ScanQueueItemRow = z.infer<typeof ScanQueueItemSchema>;
export type PortScanRow = z.infer<typeof PortScanRowSchema>;
export type DetectedServiceRow = z.infer<typeof DetectedServiceRowSchema>;
export type PortScanSummary = z.infer<typeof PortScanSummarySchema>;
//# sourceMappingURL=scanner.d.ts.map