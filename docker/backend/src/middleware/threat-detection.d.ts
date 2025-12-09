/**
 * Threat Detection Middleware
 *
 * Real-time threat detection and behavioral analysis for security monitoring.
 *
 * Features:
 * - SQL injection pattern detection
 * - XSS (Cross-Site Scripting) detection
 * - Command injection detection
 * - Path traversal detection
 * - Behavioral analysis
 * - Threat scoring
 * - Automatic blocking of high-risk requests
 *
 * Threat Patterns:
 * - SQL injection: UNION, SELECT, DROP, etc.
 * - XSS: Script tags, event handlers, iframes
 * - Command injection: System commands, shell execution
 * - Path traversal: Directory traversal attempts
 *
 * Behavioral Analysis:
 * - Request frequency analysis
 * - Unusual pattern detection
 * - Geographic anomaly detection
 * - Device fingerprinting integration
 *
 * Security:
 * - Real-time threat detection
 * - Automatic request blocking
 * - Threat logging for analysis
 * - Integration with security monitoring
 */
import { Request, Response, NextFunction } from 'express';
export declare const threatDetection: (req: Request, res: Response, next: NextFunction) => void;
export declare const behavioralAnalysis: (req: Request, res: Response, next: NextFunction) => void;
export declare const getThreatIntelligence: () => {
    suspiciousIPs: string[];
    blockedIPs: string[];
    suspiciousUserAgents: string[];
    recentAttackCount: number;
};
export declare const clearThreatIntelligence: () => void;
//# sourceMappingURL=threat-detection.d.ts.map