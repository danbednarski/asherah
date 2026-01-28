import { z } from 'zod';

export const SearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('50'),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default('0'),
});

export const DomainParamsSchema = z.object({
  domain: z.string().regex(/^[a-z2-7]{56}\.onion$/, 'Invalid onion domain'),
});

export const DomainQuerySchema = z.object({
  incomingPage: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  outgoingPage: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('10'),
});

export const ParsedQuerySchema = z.object({
  text: z.string().nullable(),
  header: z.string().nullable(),
  value: z.string().nullable(),
  title: z.string().nullable(),
  port: z.number().nullable(),
});

export const StatsResponseSchema = z.object({
  totalDomains: z.number(),
  totalPages: z.number(),
  totalLinks: z.number(),
  queueSize: z.number(),
  activeCrawlers: z.number(),
  recentCrawls: z.number(),
  lockedDomains: z.number(),
  domainStatus: z.record(z.number()),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type DomainParams = z.infer<typeof DomainParamsSchema>;
export type DomainQuery = z.infer<typeof DomainQuerySchema>;
export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
