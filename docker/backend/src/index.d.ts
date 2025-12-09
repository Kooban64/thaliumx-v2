#!/usr/bin/env node
/**
 * ThaliumX Backend Server
 * Production-ready financial application backend
 *
 * Security Features:
 * - Comprehensive input validation
 * - Rate limiting and DDoS protection
 * - JWT authentication with secure tokens
 * - CORS and security headers
 * - Request logging and monitoring
 * - Error handling with proper logging
 *
 * Financial Compliance:
 * - Audit logging for all transactions
 * - Secure data handling
 * - Input sanitization
 * - SQL injection prevention
 * - XSS protection
 */
import express from 'express';
declare class ThaliumXBackend {
    private app;
    private server;
    private io;
    private config;
    private isShuttingDown;
    constructor();
    private initializeServices;
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    private initializeSocketIO;
    private setupGracefulShutdown;
    private setupPeriodicTasks;
    start(): void;
    getApp(): express.Application;
}
export { ThaliumXBackend };
//# sourceMappingURL=index.d.ts.map