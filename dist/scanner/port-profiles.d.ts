import type { ScanProfile } from '../types/scanner.js';
export declare const PORT_PROFILES: Record<ScanProfile, number[]>;
export declare function getPortsForProfile(profile: ScanProfile): number[];
export declare function isValidProfile(profile: string): profile is ScanProfile;
export declare function getAvailableProfiles(): ScanProfile[];
export declare function getProfilePortCount(profile: ScanProfile): number;
//# sourceMappingURL=port-profiles.d.ts.map