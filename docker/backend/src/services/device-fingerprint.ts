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

import crypto from 'crypto';
import { LoggerService } from './logger';
import { createError } from '../utils';

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

export class DeviceFingerprintService {
  private static deviceCache: Map<string, DeviceFingerprintRecord> = new Map();
  private static initialized = false;

  public static initialize(): void {
    if (this.initialized) return;
    
    LoggerService.info('Device Fingerprint Service initialized');
    this.initialized = true;
  }

  public static isHealthy(): boolean {
    return this.initialized;
  }

  /**
   * Generate a deterministic fingerprint hash from device data
   */
  public static generateFingerprint(deviceData: DeviceFingerprintData, ipAddress?: string): string {
    const fingerprintData = {
      userAgent: deviceData.userAgent || '',
      language: deviceData.language || '',
      platform: deviceData.platform || '',
      timezone: deviceData.timezone || '',
      screenResolution: `${deviceData.screen.width}x${deviceData.screen.height}`,
      pixelRatio: deviceData.screen.pixelRatio || 1,
      hardwareConcurrency: deviceData.hardware.cores || 0,
      deviceMemory: deviceData.hardware.memory || 0,
      pluginsHash: deviceData.pluginsHash || '',
      canvasHash: deviceData.canvasHash || '',
      webglHash: deviceData.webglHash || '',
      ipAddress: ipAddress || ''
    };

    const fingerprintString = JSON.stringify(fingerprintData);
    const fingerprint = crypto.createHash('sha256').update(fingerprintString).digest('hex');
    
    return fingerprint;
  }

  /**
   * Calculate risk score based on device characteristics
   */
  public static calculateRiskScore(
    deviceData: DeviceFingerprintData,
    existingDevice?: DeviceFingerprintRecord
  ): number {
    let riskScore = 0;

    // New device = higher initial risk
    if (!existingDevice) {
      riskScore += 10;
    }

    // Missing critical device info = suspicious
    if (!deviceData.canvasHash || !deviceData.webglHash) {
      riskScore += 15;
    }

    // Unusual screen resolution
    if (deviceData.screen.width < 320 || deviceData.screen.height < 240) {
      riskScore += 10;
    }

    // Missing hardware info (could be bot)
    if (!deviceData.hardware.cores || !deviceData.hardware.memory) {
      riskScore += 10;
    }

    // Very old timestamp (stale data)
    const age = Date.now() - deviceData.timestamp;
    if (age > 60000) { // More than 1 minute old
      riskScore += 5;
    }

    // If device was previously flagged
    if (existingDevice?.suspiciousActivity && existingDevice.suspiciousActivity.length > 0) {
      riskScore += existingDevice.suspiciousActivity.length * 5;
    }

    return Math.min(riskScore, 100);
  }

  /**
   * Analyze device and store/update fingerprint record
   */
  public static async analyzeDevice(
    deviceData: DeviceFingerprintData,
    userId?: string,
    tenantId?: string,
    brokerId?: string,
    ipAddress?: string
  ): Promise<DeviceFingerprintRecord> {
    try {
      // Generate fingerprint
      const fingerprint = this.generateFingerprint(deviceData, ipAddress);
      const fingerprintHash = crypto.createHash('sha256').update(fingerprint).digest('hex');

      // Check for existing device
      const existingDevice = this.deviceCache.get(fingerprintHash) || 
        (userId ? Array.from(this.deviceCache.values()).find(d => 
          d.userId === userId && d.fingerprint === fingerprint
        ) : undefined);

      // Calculate risk score
      const riskScore = this.calculateRiskScore(deviceData, existingDevice);

      // Detect suspicious activity
      const suspiciousActivity: string[] = [];
      if (riskScore > 50) {
        suspiciousActivity.push('HIGH_RISK_SCORE');
      }
      if (!deviceData.canvasHash) {
        suspiciousActivity.push('MISSING_CANVAS_FP');
      }
      if (!deviceData.webglHash) {
        suspiciousActivity.push('MISSING_WEBGL_FP');
      }

      if (existingDevice) {
        // Update existing device
        existingDevice.deviceInfo = deviceData;
        existingDevice.lastSeen = new Date();
        existingDevice.usageCount += 1;
        existingDevice.riskScore = Math.max(existingDevice.riskScore, riskScore);
        existingDevice.suspiciousActivity = [...new Set([...existingDevice.suspiciousActivity, ...suspiciousActivity])];
        existingDevice.updatedAt = new Date();
        
        if (ipAddress && !existingDevice.ipAddress) {
          existingDevice.ipAddress = ipAddress;
        }

        this.deviceCache.set(fingerprintHash, existingDevice);
        
        LoggerService.info('Device fingerprint updated', {
          fingerprint: fingerprint.substring(0, 16) + '...',
          userId,
          riskScore,
          usageCount: existingDevice.usageCount
        });

        return existingDevice;
      } else {
        // Create new device record
        const newDevice: DeviceFingerprintRecord = {
          id: crypto.randomUUID(),
          userId,
          tenantId,
          brokerId,
          fingerprint,
          fingerprintHash,
          deviceInfo: deviceData,
          ipAddress,
          riskScore,
          isTrusted: riskScore < 30,
          lastSeen: new Date(),
          firstSeen: new Date(),
          usageCount: 1,
          suspiciousActivity,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        this.deviceCache.set(fingerprintHash, newDevice);

        LoggerService.info('New device fingerprint created', {
          fingerprint: fingerprint.substring(0, 16) + '...',
          userId,
          riskScore,
          isTrusted: newDevice.isTrusted
        });

        return newDevice;
      }
    } catch (error: any) {
      LoggerService.error('Device fingerprint analysis failed', { error: error.message });
      throw createError('Device fingerprint analysis failed', 500, 'FINGERPRINT_ANALYSIS_FAILED');
    }
  }

  /**
   * Get device by fingerprint hash
   */
  public static getDeviceByFingerprint(fingerprintHash: string): DeviceFingerprintRecord | undefined {
    return this.deviceCache.get(fingerprintHash);
  }

  /**
   * Get all devices for a user
   */
  public static getUserDevices(userId: string): DeviceFingerprintRecord[] {
    return Array.from(this.deviceCache.values()).filter(d => d.userId === userId);
  }

  /**
   * Check if device is trusted
   */
  public static isDeviceTrusted(fingerprintHash: string): boolean {
    const device = this.deviceCache.get(fingerprintHash);
    return device ? device.isTrusted && device.riskScore < 50 : false;
  }
}
