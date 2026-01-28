import { z } from 'zod';
export declare const SearchQuerySchema: z.ZodObject<{
    q: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    offset: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    offset: number;
    q?: string | undefined;
}, {
    q?: string | undefined;
    limit?: string | undefined;
    offset?: string | undefined;
}>;
export declare const DomainParamsSchema: z.ZodObject<{
    domain: z.ZodString;
}, "strip", z.ZodTypeAny, {
    domain: string;
}, {
    domain: string;
}>;
export declare const DomainQuerySchema: z.ZodObject<{
    incomingPage: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    outgoingPage: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    incomingPage: number;
    outgoingPage: number;
}, {
    limit?: string | undefined;
    incomingPage?: string | undefined;
    outgoingPage?: string | undefined;
}>;
export declare const ParsedQuerySchema: z.ZodObject<{
    text: z.ZodNullable<z.ZodString>;
    header: z.ZodNullable<z.ZodString>;
    value: z.ZodNullable<z.ZodString>;
    title: z.ZodNullable<z.ZodString>;
    port: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    port: number | null;
    value: string | null;
    title: string | null;
    text: string | null;
    header: string | null;
}, {
    port: number | null;
    value: string | null;
    title: string | null;
    text: string | null;
    header: string | null;
}>;
export declare const StatsResponseSchema: z.ZodObject<{
    totalDomains: z.ZodNumber;
    totalPages: z.ZodNumber;
    totalLinks: z.ZodNumber;
    queueSize: z.ZodNumber;
    activeCrawlers: z.ZodNumber;
    recentCrawls: z.ZodNumber;
    lockedDomains: z.ZodNumber;
    domainStatus: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    totalDomains: number;
    totalPages: number;
    totalLinks: number;
    queueSize: number;
    activeCrawlers: number;
    recentCrawls: number;
    lockedDomains: number;
    domainStatus: Record<string, number>;
}, {
    totalDomains: number;
    totalPages: number;
    totalLinks: number;
    queueSize: number;
    activeCrawlers: number;
    recentCrawls: number;
    lockedDomains: number;
    domainStatus: Record<string, number>;
}>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type DomainParams = z.infer<typeof DomainParamsSchema>;
export type DomainQuery = z.infer<typeof DomainQuerySchema>;
export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;
export type StatsResponse = z.infer<typeof StatsResponseSchema>;
//# sourceMappingURL=api.d.ts.map