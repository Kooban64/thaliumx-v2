/**
 * Telemetry Service (OpenTelemetry)
 *
 * Distributed tracing and metrics collection using OpenTelemetry.
 *
 * Features:
 * - Automatic instrumentation of Express, HTTP, PostgreSQL, Redis, MongoDB
 * - Distributed tracing across services
 * - Metrics collection and export
 * - OTLP (OpenTelemetry Protocol) export to collector
 * - gRPC-based export for better performance
 *
 * Auto-Instrumentation:
 * - Express.js: HTTP request/response tracing
 * - HTTP/HTTPS: Outbound HTTP calls
 * - PostgreSQL: Database query tracing
 * - Redis: Cache operation tracing
 * - MongoDB: Database operation tracing
 * - Socket.IO: WebSocket connection tracing
 * - DNS: DNS lookup tracing
 * - Net: Network operation tracing
 *
 * Configuration:
 * - OTEL_EXPORTER_OTLP_ENDPOINT: Collector endpoint (default: http://otel-collector:4317)
 * - OTEL_ENABLED: Enable/disable telemetry (default: true)
 * - Service name and version from package.json
 *
 * Metrics:
 * - Exported every 60 seconds
 * - Includes system metrics and custom application metrics
 *
 * Note: Must be initialized BEFORE any other imports to ensure proper instrumentation.
 * This is done in index.ts at the top level.
 */
export declare class TelemetryService {
    private static sdk;
    static initialize(): void;
    static shutdown(): void;
}
//# sourceMappingURL=telemetry.d.ts.map