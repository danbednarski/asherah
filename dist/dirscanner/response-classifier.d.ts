import type { BaselineResponse, DirScanResult } from '../types/dirscanner.js';
interface ProbeResponse {
    path: string;
    statusCode: number;
    contentLength: number;
    contentType: string | null;
    responseTimeMs: number;
    serverHeader: string | null;
    redirectUrl: string | null;
    body: string | null;
}
export declare class ResponseClassifier {
    private baseline;
    setBaseline(baseline: BaselineResponse): void;
    classify(response: ProbeResponse): DirScanResult;
    private isSoft404;
    private hasSoft404Indicators;
    private looksLikeGenericPage;
    private getCategoryForPath;
    private calculateSimilarity;
}
export declare function generateBaselinePath(): string;
export {};
//# sourceMappingURL=response-classifier.d.ts.map