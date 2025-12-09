/**
 * Device Fingerprint Service
 *
 * Device identification and risk assessment using browser fingerprinting.
 *
 * Features:
 * - Browser fingerprint generation from multiple signals
 * - Device identification and tracking
 * - Risk scoring based on device characteristics
 * - Trusted device management
 * - Suspicious activity detection
 * - Device change alerts
 *
 * Fingerprint Components:
 * - User agent, language, platform, timezone
 * - Screen resolution and pixel ratio
 * - Hardware information (memory, CPU cores)
 * - Browser plugins hash
 * - Canvas fingerprint
 * - WebGL fingerprint
 *
 * Security:
 * - Fingerprints hashed before storage
 * - Risk scores calculated from device characteristics
 * - Trusted devices tracked per user
 * - Suspicious activity flagged and logged
 *
 * Use Cases:
 * - Fraud detection
 * - Account security monitoring
 * - Device-based authentication
 * - Risk assessment for transactions
 */
export interface DeviceFingerprintData {
    userAgent: string;
    language: string;
    platform: string;
    timezone: string;
    screen: {
        width: number;
        height: number;
        pixelRatio: number;
    };
    hardware: {
        memory?: number;
        cores?: number;
    };
    pluginsHash: string;
    canvasHash?: string;
    webglHash?: string;
    timestamp: number;
}
export interface DeviceFingerprintRecord {
    id: string;
    userId?: string;
    tenantId?: string;
    brokerId?: string;
    fingerprint: string;
    fingerprintHash: string;
    deviceInfo: DeviceFingerprintData;
    ipAddress?: string;
    riskScore: number;
    isTrusted: boolean;
    lastSeen: Date;
    firstSeen: Date;
    usageCount: number;
    suspiciousActivity: string[];
    createdAt: Date;
    updatedAt: Date;
}
export declare class DeviceFingerprintService {
    private static deviceCache;
    private static initialized;
    static initialize(): void;
    static isHealthy(): boolean;
    /**
     * Generate a deterministic fingerprint hash from device data
     */
    static generateFingerprint(deviceData: DeviceFingerprintData, ipAddress?: string): string;
    /**
     * Calculate risk score based on device characteristics
     */
    static calculateRiskScore(deviceData: DeviceFingerprintData, existingDevice?: DeviceFingerprintRecord): number;
    /**
     * Analyze device and store/update fingerprint record
     */
    static analyzeDevice(deviceData: DeviceFingerprintData, userId?: string, tenantId?: string, brokerId?: string, ipAddress?: string): Promise<DeviceFingerprintRecord>;
    /**
     * Get device by fingerprint hash
     */
    static getDeviceByFingerprint(fingerprintHash: string): DeviceFingerprintRecord | undefined;
    /**
     * Get all devices for a user
     */
    static getUserDevices(userId: string): DeviceFingerprintRecord[];
    /**
     * Check if device is trusted
     */
    static isDeviceTrusted(fingerprintHash: string): boolean;
}
//# sourceMappingURL=device-fingerprint.d.ts.map