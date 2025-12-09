"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const exporter_trace_otlp_grpc_1 = require("@opentelemetry/exporter-trace-otlp-grpc");
const exporter_metrics_otlp_grpc_1 = require("@opentelemetry/exporter-metrics-otlp-grpc");
const sdk_metrics_1 = require("@opentelemetry/sdk-metrics");
const logger_1 = require("./logger");
class TelemetryService {
    static sdk;
    static initialize() {
        try {
            // OTEL Collector endpoint (defaults to container name if not set)
            const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
                process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
                'http://otel-collector:4317';
            logger_1.LoggerService.info('Initializing OpenTelemetry SDK', {
                endpoint: otelEndpoint,
                protocol: 'gRPC',
                service: 'thaliumx-backend'
            });
            // Create OTLP exporters (gRPC for better performance)
            const traceExporter = new exporter_trace_otlp_grpc_1.OTLPTraceExporter({
                url: otelEndpoint,
            });
            const metricExporter = new exporter_metrics_otlp_grpc_1.OTLPMetricExporter({
                url: otelEndpoint,
            });
            // Create metric reader
            // Note: Type assertion needed due to OpenTelemetry SDK version compatibility
            // PeriodicExportingMetricReader from @opentelemetry/sdk-metrics is compatible
            // but TypeScript sees type mismatch due to multiple sdk-metrics versions in dependencies
            const metricReader = new sdk_metrics_1.PeriodicExportingMetricReader({
                exporter: metricExporter,
                exportIntervalMillis: 60000, // Export metrics every 60 seconds
            });
            // Initialize OpenTelemetry SDK with exporters
            // Note: Logs are handled by Winston (LoggerService) which can export to Loki
            // OTEL SDK logs support requires additional packages and can be added later
            this.sdk = new sdk_node_1.NodeSDK({
                resource: new resources_1.Resource({
                    [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: 'thaliumx-backend',
                    [semantic_conventions_1.SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
                    [semantic_conventions_1.SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
                }),
                traceExporter: traceExporter,
                metricReader: metricReader, // Type assertion for OpenTelemetry SDK version compatibility
                instrumentations: [
                    (0, auto_instrumentations_node_1.getNodeAutoInstrumentations)({
                        // Disable some instrumentations that might conflict
                        '@opentelemetry/instrumentation-fs': {
                            enabled: false,
                        },
                    }),
                ],
            });
            // Start the SDK
            this.sdk.start();
            logger_1.LoggerService.info('OpenTelemetry SDK initialized successfully', {
                service: 'thaliumx-backend',
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                endpoint: otelEndpoint,
                traces: 'enabled',
                metrics: 'enabled',
                logs: 'handled-by-winston' // Logs exported via Winston to Loki
            });
            // Graceful shutdown
            process.on('SIGTERM', () => {
                this.shutdown();
            });
            process.on('SIGINT', () => {
                this.shutdown();
            });
        }
        catch (error) {
            logger_1.LoggerService.error('Failed to initialize OpenTelemetry', { error: error instanceof Error ? error.message : String(error) });
            // Don't throw error, continue without telemetry
        }
    }
    static shutdown() {
        if (this.sdk) {
            this.sdk.shutdown();
            logger_1.LoggerService.info('OpenTelemetry SDK shutdown');
        }
    }
}
exports.TelemetryService = TelemetryService;
//# sourceMappingURL=telemetry.js.map