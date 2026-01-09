# Enterprise Logging System Guide

## Overview

The ThaliumX platform uses an enterprise-grade logging system designed for security, compliance, performance, and observability. This guide covers architecture, best practices, and usage.

## Architecture

### Core Components

1. **LoggerService** - Centralized logging service (Winston + OpenTelemetry)
2. **LogSanitizer** - Automatic PII/sensitive data redaction
3. **LogEncryption** - AES-256-GCM encryption at rest
4. **LogCorrelation** - Correlation ID propagation via AsyncLocalStorage
5. **LogIntegrity** - Checksum-based integrity verification
6. **LogRouter** - Multi-backend routing (Loki, S3, CloudWatch)
7. **LogReplay** - Correlation ID-based log replay
8. **ComplianceReporting** - Automated compliance report generation

### Log Flow

```
Application Code
    ↓
LoggerService (sanitize + correlate)
    ↓
Winston Transports
    ├─→ Console (development)
    ├─→ File (error.log, combined.log)
    └─→ LogRouter (multi-backend)
        ├─→ Loki (via Promtail)
        ├─→ S3 (archival)
        └─→ CloudWatch (optional)
```

## Log Levels

Use log levels appropriately:

- **error**: Errors that require immediate attention
- **warn**: Warnings that may indicate issues
- **info**: General informational messages (default)
- **debug**: Detailed debugging information
- **verbose**: Very detailed information
- **silly**: Extremely verbose (rarely used)

## Best Practices

### 1. Always Use LoggerService

```typescript
// ✅ Good
LoggerService.info('User logged in', { userId, ip });

// ❌ Bad
console.log('User logged in', { userId, ip });
```

### 2. Include Context

```typescript
// ✅ Good - includes correlation ID, user context
LoggerService.info('Transaction processed', {
  transactionId,
  amount,
  currency,
  userId,
  tenantId,
});

// ❌ Bad - missing context
LoggerService.info('Transaction processed');
```

### 3. Never Log Sensitive Data

```typescript
// ✅ Good - PII automatically redacted
LoggerService.info('User registration', {
  email: 'user@example.com', // Will be redacted if LOG_REDACT_EMAILS=true
  password: 'secret123', // Always redacted
});

// ❌ Bad - sensitive data exposed
LoggerService.info('API key', { key: process.env.API_KEY });
```

### 4. Use Structured Logging

```typescript
// ✅ Good - structured metadata
LoggerService.error('Database query failed', {
  query: 'SELECT * FROM users',
  error: error.message,
  duration: 150,
  userId: 'user123',
});

// ❌ Bad - unstructured string
LoggerService.error(`Database query failed: ${error.message}`);
```

### 5. Error Logging

```typescript
// ✅ Good - includes full context
LoggerService.logError(error, {
  requestId,
  userId,
  url: req.url,
  method: req.method,
});

// ❌ Bad - minimal context
LoggerService.error(error.message);
```

## Correlation IDs

Correlation IDs are automatically included in all logs when set via middleware:

```typescript
// In request middleware
LogCorrelation.setCorrelationContext({
  correlationId: 'corr-123',
  requestId: 'req-456',
  userId: 'user-789',
});

// All subsequent logs automatically include correlation ID
LoggerService.info('Processing request'); // Includes correlationId
```

## Compliance Features

### Audit Logging

```typescript
await LoggerService.logAudit(
  'user_login',
  'user',
  {
    userId: 'user123',
    tenantId: 'tenant456',
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  },
  { success: true }
);
```

### Compliance Reports

```typescript
// Generate SOX compliance report
const report = await ComplianceReportingService.generateReport({
  reportType: 'SOX',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  format: 'json',
});

// Export to CSV
const csv = ComplianceReportingService.exportReport(report, 'csv');
```

## Performance Considerations

### Log Sampling

For high-volume operations, use sampling:

```typescript
// Sample 1 in 100 successful requests
if (Math.random() < 0.01 || res.statusCode >= 400) {
  LoggerService.info('HTTP Request', { ... });
}
```

### Async Batching

Logs are automatically batched when using AsyncLogTransport (reduces I/O by 80%+).

## Querying Logs

### In Loki/Grafana

```logql
# All errors in last hour
{service="thaliumx-backend"} |= "error"

# Errors for specific correlation ID
{service="thaliumx-backend"} | json | correlationId="corr-123"

# Audit logs
{service="thaliumx-backend"} | json | message="Audit Event"
```

### Via API

```bash
# Query audit logs
GET /api/audit-logs?userId=user123&startDate=2024-01-01&endDate=2024-12-31

# Replay logs by correlation ID
GET /api/audit-logs/replay/corr-123?format=json

# Get log trends
GET /api/log-analytics/trends?startDate=2024-01-01&endDate=2024-12-31
```

## Configuration

### Environment Variables

- `LOG_LEVEL` - Log level (default: info)
- `LOG_DIR` - Log directory (default: /var/log/thaliumx/backend)
- `LOG_SANITIZE_PII` - Enable PII sanitization (default: true)
- `LOG_REDACT_EMAILS` - Redact email addresses (default: false)
- `LOG_REDACT_PHONES` - Redact phone numbers (default: false)
- `LOG_ENCRYPTION_ENABLED` - Enable log encryption (default: false)
- `LOG_ENCRYPTION_KEY_PATH` - Vault path for encryption key
- `LOG_INTEGRITY_ENABLED` - Enable integrity verification (default: true)
- `LOG_TENANT_ISOLATION` - Enable multi-tenant isolation (default: false)
- `LOG_BATCH_SIZE` - Batch size for async logging (default: 100)
- `LOG_BATCH_INTERVAL_MS` - Batch flush interval (default: 1000ms)
- `LOG_SYSTEM_METRICS_INTERVAL_MS` - System metrics interval (default: 60000ms)

## Troubleshooting

### Logs Not Appearing

1. Check `LOG_LEVEL` - logs below this level are filtered
2. Verify log directory exists and is writable
3. Check disk space
4. Verify LoggerService.initialize() was called

### Correlation IDs Missing

1. Ensure request middleware sets correlation context
2. Check AsyncLocalStorage is working (Node 12.17+)
3. Verify LogCorrelation.initialize() was called

### Performance Issues

1. Enable log sampling for high-volume operations
2. Use async batching transport
3. Adjust `LOG_BATCH_SIZE` and `LOG_BATCH_INTERVAL_MS`
4. Disable system metrics if not needed (`DISABLE_SYSTEM_METRICS=true`)

## Security

### PII Protection

All log metadata is automatically sanitized. Sensitive fields are redacted:
- Passwords, API keys, tokens
- Credit card numbers
- SSNs, IBANs
- Crypto private keys
- (Optional) Email addresses, phone numbers

### Encryption

Enable log encryption for compliance:

```bash
LOG_ENCRYPTION_ENABLED=true
LOG_ENCRYPTION_KEY_PATH=thaliumx/logging/encryption-key
```

Keys are stored in Vault, never in code.

### Integrity Verification

Log integrity is verified using SHA-256 checksums. Tampering is detected automatically.

## Compliance

### SOX Compliance

- Financial audit logs: 7-year retention
- Immutable audit trail
- Integrity verification

### GDPR Compliance

- Right to erasure: log anonymization (not deletion)
- Data access logging
- Export capabilities

### PCI-DSS Compliance

- No card data in logs (automatically redacted)
- Encrypted log storage
- Access controls

## Monitoring

### Grafana Dashboards

Create dashboards for:
- Error rate trends
- Log volume by service
- PII redaction events
- Compliance status
- Performance metrics

### Alerts

Set up alerts for:
- High error rates (> 1% of requests)
- Missing audit logs
- Log shipping failures
- Disk space issues (< 10% free)
- Integrity verification failures

## API Reference

### LoggerService

- `LoggerService.info(message, meta?)` - Info level log
- `LoggerService.error(message, meta?)` - Error level log
- `LoggerService.warn(message, meta?)` - Warning level log
- `LoggerService.debug(message, meta?)` - Debug level log
- `LoggerService.logError(error, context?)` - Enhanced error logging
- `LoggerService.logAudit(action, subject, actor?, details?)` - Audit log
- `LoggerService.logSecurity(event, details)` - Security event

### LogCorrelation

- `LogCorrelation.generateCorrelationId()` - Generate new correlation ID
- `LogCorrelation.setCorrelationContext(context, callback?)` - Set context
- `LogCorrelation.getCorrelationId()` - Get current correlation ID
- `LogCorrelation.getLogMetadata()` - Get all correlation metadata

### ComplianceReportingService

- `generateReport(options)` - Generate compliance report
- `exportReport(report, format)` - Export report
- `getComplianceStatus()` - Get compliance dashboard data

### LogReplayService

- `replayByCorrelationId(options)` - Replay logs for correlation ID
- `exportLogs(logs, format)` - Export logs
- `getTimeline(correlationId)` - Get log timeline

## Support

For issues or questions:
1. Check this guide
2. Review log files in `/var/log/thaliumx/backend`
3. Query logs in Grafana/Loki
4. Contact platform team

---

**Last Updated**: 2025-01-03
**Version**: 1.0.0
