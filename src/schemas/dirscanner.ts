import { z } from 'zod';

// Dir scan profile enum
export const DirScanProfileSchema = z.enum(['quick', 'standard', 'full']);

// Dir scan queue status enum
export const DirScanQueueStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

// Interest category enum
export const InterestCategorySchema = z.enum([
  'credentials_file',
  'backup_file',
  'source_control',
  'admin_panel',
  'server_info',
  'sensitive_directory',
  'configuration_file',
  'log_file',
  'database_file',
  'robots_sitemap',
  'other',
]);

// Dir scan queue item from database
export const DirScanQueueItemSchema = z.object({
  id: z.number(),
  domain_id: z.number().nullable(),
  domain: z.string(),
  profile: DirScanProfileSchema,
  priority: z.number(),
  attempts: z.number(),
});

// Dir scan result row from database
export const DirScanResultRowSchema = z.object({
  id: z.number(),
  domain_id: z.number().nullable(),
  domain: z.string(),
  path: z.string(),
  status_code: z.number(),
  content_length: z.number().nullable(),
  content_type: z.string().nullable(),
  response_time_ms: z.number().nullable(),
  server_header: z.string().nullable(),
  redirect_url: z.string().nullable(),
  body_snippet: z.string().nullable(),
  is_interesting: z.boolean(),
  interest_reason: z.string().nullable(),
  scanned_at: z.coerce.date(),
});

// Dir scan lock result
export const DirScanLockResultSchema = z.object({
  acquired: z.boolean(),
});

export const DirScanReleaseResultSchema = z.object({
  released: z.boolean(),
});

export const DirScanExtendResultSchema = z.object({
  extended: z.boolean(),
});

// Dir scanner statistics
export const DirScannerStatisticsRowSchema = z.object({
  count: z.coerce.number(),
});

// Infer types from schemas
export type DirScanQueueItemRow = z.infer<typeof DirScanQueueItemSchema>;
export type DirScanResultRow = z.infer<typeof DirScanResultRowSchema>;
