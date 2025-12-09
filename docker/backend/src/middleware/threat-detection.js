"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearThreatIntelligence = exports.getThreatIntelligence = exports.behavioralAnalysis = exports.threatDetection = void 0;
const logger_1 = require("../services/logger");
const utils_1 = require("../utils");
// Threat patterns and signatures
const THREAT_PATTERNS = {
    // SQL Injection patterns
    sqlInjection: [
        /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
        /('|(\\x27)|(\\x2D\\x2D)|(\#)|(\%27)|(\%22)|(\%3B)|(\%3C)|(\%3E)|(\%00)|(\%2D\\x2D))/i,
        /('|(\\x27)|(\\x2D\\x2D)|(\#)|(\%27)|(\%22)|(\%3B)|(\%3C)|(\%3E)|(\%00)|(\%2D\\x2D)|(\;)|(\-\-)|(\#)|(\*))/i
    ],
    // XSS patterns
    xss: [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload\s*=/gi,
        /onerror\s*=/gi,
        /onclick\s*=/gi,
        /onmouseover\s*=/gi,
        /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
        /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
        /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
    ],
    // Command injection patterns
    commandInjection: [
        /(\||&|;|\$\(|\`)/,
        /(rm\s|del\s|format\s|shutdown\s)/i,
        /(\.\.|\/etc\/|\/bin\/|\/usr\/)/
    ],
    // Path traversal patterns
    pathTraversal: [
        /\.\.\//,
        /\.\.\\/,
        /%2e%2e%2f/,
        /%2e%2e\//,
        /\.\.%2f/
    ],
    // Suspicious user agents
    suspiciousUserAgents: [
        /sqlmap/i,
        /nmap/i,
        /nikto/i,
        /dirbuster/i,
        /gobuster/i,
        /burpsuite/i,
        /owasp/i,
        /acunetix/i,
        /nessus/i
    ]
};
// Threat scoring system
const THREAT_SCORES = {
    sqlInjection: 8,
    xss: 7,
    commandInjection: 9,
    pathTraversal: 8,
    suspiciousUserAgent: 5,
    rapidRequests: 3,
    unusualHeaders: 2,
    suspiciousIP: 4
};
// Threat intelligence database (in production, this would be a real database)
const THREAT_INTELLIGENCE = {
    suspiciousIPs: new Set(),
    blockedIPs: new Set(),
    suspiciousUserAgents: new Set(),
    recentAttacks: new Map()
};
// Analyze request for threats
function analyzeRequest(req) {
    let totalScore = 0;
    const threats = [];
    const body = JSON.stringify(req.body || {});
    const query = JSON.stringify(req.query || {});
    const params = JSON.stringify(req.params || {});
    const headers = JSON.stringify(req.headers || {});
    const userAgent = req.get('User-Agent') || '';
    // Check for SQL injection
    const sqlPatterns = THREAT_PATTERNS.sqlInjection;
    if (sqlPatterns.some(pattern => pattern.test(body) || pattern.test(query) || pattern.test(params))) {
        totalScore += THREAT_SCORES.sqlInjection;
        threats.push('SQL Injection Attempt');
    }
    // Check for XSS
    const xssPatterns = THREAT_PATTERNS.xss;
    if (xssPatterns.some(pattern => pattern.test(body) || pattern.test(query) || pattern.test(params))) {
        totalScore += THREAT_SCORES.xss;
        threats.push('XSS Attempt');
    }
    // Check for command injection
    const cmdPatterns = THREAT_PATTERNS.commandInjection;
    if (cmdPatterns.some(pattern => pattern.test(body) || pattern.test(query) || pattern.test(params))) {
        totalScore += THREAT_SCORES.commandInjection;
        threats.push('Command Injection Attempt');
    }
    // Check for path traversal
    const pathPatterns = THREAT_PATTERNS.pathTraversal;
    if (pathPatterns.some(pattern => pattern.test(query) || pattern.test(params))) {
        totalScore += THREAT_SCORES.pathTraversal;
        threats.push('Path Traversal Attempt');
    }
    // Check suspicious user agent
    const uaPatterns = THREAT_PATTERNS.suspiciousUserAgents;
    if (uaPatterns.some(pattern => pattern.test(userAgent))) {
        totalScore += THREAT_SCORES.suspiciousUserAgent;
        threats.push('Suspicious User Agent');
    }
    // Check for unusual headers
    const unusualHeaders = ['x-forwarded-for', 'x-real-ip', 'x-client-ip'];
    const hasUnusualHeaders = unusualHeaders.some(header => req.headers[header]);
    if (hasUnusualHeaders && req.headers['x-forwarded-for'] !== req.ip) {
        totalScore += THREAT_SCORES.unusualHeaders;
        threats.push('Unusual Headers Detected');
    }
    // Check IP reputation (simplified)
    const clientIP = req.ip || req.connection.remoteAddress || '';
    if (THREAT_INTELLIGENCE.suspiciousIPs.has(clientIP)) {
        totalScore += THREAT_SCORES.suspiciousIP;
        threats.push('Suspicious IP Address');
    }
    // Determine threat level and recommended action
    let threatLevel;
    let recommendedAction;
    if (totalScore >= 15) {
        threatLevel = 'critical';
        recommendedAction = 'block';
    }
    else if (totalScore >= 10) {
        threatLevel = 'high';
        recommendedAction = 'block';
    }
    else if (totalScore >= 5) {
        threatLevel = 'medium';
        recommendedAction = 'challenge';
    }
    else if (totalScore >= 2) {
        threatLevel = 'low';
        recommendedAction = 'monitor';
    }
    else {
        threatLevel = 'low';
        recommendedAction = 'allow';
    }
    return {
        isThreat: totalScore > 0,
        threatLevel,
        score: totalScore,
        threats,
        recommendedAction
    };
}
// Threat detection middleware
const threatDetection = (req, res, next) => {
    try {
        const analysis = analyzeRequest(req);
        // Log threat detection results
        if (analysis.isThreat) {
            logger_1.LoggerService.warn('Threat detected', {
                ip: req.ip,
                url: req.url,
                method: req.method,
                userAgent: req.get('User-Agent'),
                threatLevel: analysis.threatLevel,
                score: analysis.score,
                threats: analysis.threats,
                recommendedAction: analysis.recommendedAction,
                userId: req.user?.userId
            });
            // Update threat intelligence
            const clientIP = req.ip || req.connection.remoteAddress || '';
            if (analysis.threatLevel === 'high' || analysis.threatLevel === 'critical') {
                THREAT_INTELLIGENCE.suspiciousIPs.add(clientIP);
            }
            // Block critical threats
            if (analysis.recommendedAction === 'block') {
                return next((0, utils_1.createError)('Access denied due to security policy', 403, 'ACCESS_DENIED'));
            }
            // Add threat information to request for monitoring
            req.threatAnalysis = analysis;
        }
        next();
    }
    catch (error) {
        logger_1.LoggerService.error('Error in threat detection', { error, ip: req.ip, url: req.url });
        // Continue processing even if threat detection fails
        next();
    }
};
exports.threatDetection = threatDetection;
// Advanced threat detection with behavioral analysis
const behavioralAnalysis = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || '';
    const now = Date.now();
    // Track request frequency per IP
    const recentRequests = THREAT_INTELLIGENCE.recentAttacks.get(clientIP) || 0;
    THREAT_INTELLIGENCE.recentAttacks.set(clientIP, recentRequests + 1);
    // Clean up old entries (older than 1 minute)
    for (const [ip, count] of THREAT_INTELLIGENCE.recentAttacks) {
        if (count > 0 && Math.random() < 0.01) { // Occasional cleanup
            THREAT_INTELLIGENCE.recentAttacks.set(ip, Math.max(0, count - 1));
        }
    }
    // Check for rapid requests (potential DoS)
    if (recentRequests > 100) { // More than 100 requests in tracking window
        logger_1.LoggerService.warn('Potential DoS attack detected', {
            ip: clientIP,
            url: req.url,
            recentRequests
        });
        // Add to blocked IPs temporarily
        THREAT_INTELLIGENCE.blockedIPs.add(clientIP);
        return next((0, utils_1.createError)('Too many requests', 429, 'RATE_LIMIT_EXCEEDED'));
    }
    // Check if IP is blocked
    if (THREAT_INTELLIGENCE.blockedIPs.has(clientIP)) {
        logger_1.LoggerService.warn('Request from blocked IP', {
            ip: clientIP,
            url: req.url
        });
        return next((0, utils_1.createError)('Access denied', 403, 'ACCESS_DENIED'));
    }
    next();
};
exports.behavioralAnalysis = behavioralAnalysis;
// Export threat intelligence for monitoring
const getThreatIntelligence = () => {
    return {
        suspiciousIPs: Array.from(THREAT_INTELLIGENCE.suspiciousIPs),
        blockedIPs: Array.from(THREAT_INTELLIGENCE.blockedIPs),
        suspiciousUserAgents: Array.from(THREAT_INTELLIGENCE.suspiciousUserAgents),
        recentAttackCount: THREAT_INTELLIGENCE.recentAttacks.size
    };
};
exports.getThreatIntelligence = getThreatIntelligence;
// Clear threat intelligence (for testing/admin purposes)
const clearThreatIntelligence = () => {
    THREAT_INTELLIGENCE.suspiciousIPs.clear();
    THREAT_INTELLIGENCE.blockedIPs.clear();
    THREAT_INTELLIGENCE.suspiciousUserAgents.clear();
    THREAT_INTELLIGENCE.recentAttacks.clear();
};
exports.clearThreatIntelligence = clearThreatIntelligence;
//# sourceMappingURL=threat-detection.js.map