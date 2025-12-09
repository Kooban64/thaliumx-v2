export type DeviceFingerprint = {
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
};
export declare function collectDeviceFingerprint(): DeviceFingerprint;
export declare function submitDeviceFingerprint(endpoint?: string): Promise<Response | undefined>;
//# sourceMappingURL=fingerprint.d.ts.map