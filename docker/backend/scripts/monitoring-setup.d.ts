#!/usr/bin/env ts-node
/**
 * Monitoring Setup Script
 * Configures monitoring, alerting, and observability for ThaliumX
 */
declare class MonitoringSetup {
    private static readonly MONITORING_DIR;
    private static readonly PROMETHEUS_DIR;
    private static readonly GRAFANA_DIR;
    private static readonly ALERTMANAGER_DIR;
    static setup(): Promise<void>;
    private static createDirectories;
    private static setupPrometheus;
    private static setupGrafana;
    private static setupAlertManager;
    private static setupCustomMetrics;
    static validate(): Promise<void>;
}
export { MonitoringSetup };
//# sourceMappingURL=monitoring-setup.d.ts.map