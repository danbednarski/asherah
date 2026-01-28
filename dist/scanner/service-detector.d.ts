import type { DetectedService, ServiceSignature } from '../types/scanner.js';
export declare class ServiceDetector {
    private signatures;
    constructor(customSignatures?: ServiceSignature[]);
    detect(port: number, banner: string | null): DetectedService | null;
    private calculateConfidence;
    private extractVersion;
    detectAll(results: Array<{
        port: number;
        banner: string | null;
    }>): DetectedService[];
    getProbeString(port: number): string | null;
}
//# sourceMappingURL=service-detector.d.ts.map