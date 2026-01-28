import { z } from 'zod';
// Port state enum
export const PortStateSchema = z.enum(['open', 'closed', 'filtered', 'timeout']);
// Scan profile enum
export const ScanProfileSchema = z.enum(['quick', 'standard', 'full', 'crypto']);
// Scan queue status enum
export const ScanQueueStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
// Scan queue item from database
export const ScanQueueItemSchema = z.object({
    id: z.number(),
    domain_id: z.number().nullable(),
    domain: z.string(),
    profile: ScanProfileSchema,
    ports: z.array(z.number()).nullable(),
    priority: z.number(),
    attempts: z.number(),
});
// Port scan result from database
export const PortScanRowSchema = z.object({
    id: z.number(),
    domain_id: z.number().nullable(),
    domain: z.string(),
    port: z.number(),
    state: PortStateSchema,
    response_time_ms: z.number().nullable(),
    banner: z.string().nullable(),
    scanned_at: z.coerce.date(),
});
// Detected service from database
export const DetectedServiceRowSchema = z.object({
    id: z.number(),
    port_scan_id: z.number(),
    domain: z.string(),
    port: z.number(),
    service_name: z.string().nullable(),
    service_version: z.string().nullable(),
    confidence: z.number().nullable(),
    raw_banner: z.string().nullable(),
    first_seen: z.coerce.date(),
    last_seen: z.coerce.date(),
});
// Scan lock result
export const ScanLockResultSchema = z.object({
    acquired: z.boolean(),
});
export const ScanReleaseResultSchema = z.object({
    released: z.boolean(),
});
export const ScanExtendResultSchema = z.object({
    extended: z.boolean(),
});
// Scanner statistics
export const ScannerStatisticsRowSchema = z.object({
    count: z.coerce.number(),
});
// Port scan summary for API responses
export const PortScanSummarySchema = z.object({
    domain: z.string(),
    totalPorts: z.number(),
    openPorts: z.number(),
    lastScanned: z.coerce.date().nullable(),
    services: z.array(z.object({
        port: z.number(),
        serviceName: z.string().nullable(),
        serviceVersion: z.string().nullable(),
    })),
});
//# sourceMappingURL=scanner.js.map