#!/usr/bin/env ts-node

/**
 * Monitoring Setup Script
 * Configures monitoring, alerting, and observability for ThaliumX
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from '../src/services/logger';

class MonitoringSetup {
  private static readonly MONITORING_DIR = './monitoring';
  private static readonly PROMETHEUS_DIR = './deploy/prometheus';
  private static readonly GRAFANA_DIR = './deploy/grafana';
  private static readonly ALERTMANAGER_DIR = './deploy/alertmanager';

  static async setup(): Promise<void> {
    LoggerService.info('📊 Setting up monitoring infrastructure...');

    try {
      // Create monitoring directories
      this.createDirectories();

      // Setup Prometheus configuration
      await this.setupPrometheus();

      // Setup Grafana dashboards
      await this.setupGrafana();

      // Setup AlertManager
      await this.setupAlertManager();

      // Setup custom metrics
      await this.setupCustomMetrics();

      LoggerService.info('✅ Monitoring setup completed successfully');

    } catch (error) {
      LoggerService.error('❌ Monitoring setup failed:', error);
      throw error;
    }
  }

  private static createDirectories(): void {
    const dirs = [
      this.MONITORING_DIR,
      path.join(this.MONITORING_DIR, 'dashboards'),
      path.join(this.MONITORING_DIR, 'alerts'),
      path.join(this.MONITORING_DIR, 'rules')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        LoggerService.info(`Created directory: ${dir}`);
      }
    }
  }

  private static async setupPrometheus(): Promise<void> {
    LoggerService.info('Setting up Prometheus configuration...');

    const prometheusConfig = {
      global: {
        scrape_interval: '15s',
        evaluation_interval: '15s'
      },
      rule_files: [
        'thaliumx_alerts.yml'
      ],
      alerting: {
        alertmanagers: [
          {
            static_configs: [
              {
                targets: ['alertmanager:9093']
              }
            ]
          }
        ]
      },
      scrape_configs: [
        {
          job_name: 'thaliumx-backend',
          static_configs: [
            {
              targets: ['thaliumx-backend:3002']
            }
          ],
          metrics_path: '/metrics',
          scrape_interval: '15s'
        },
        {
          job_name: 'thaliumx-quantlib',
          static_configs: [
            {
              targets: ['thaliumx-quantlib-svc:3010']
            }
          ],
          metrics_path: '/metrics',
          scrape_interval: '30s'
        },
        {
          job_name: 'thaliumx-ballerine',
          static_configs: [
            {
              targets: ['thaliumx-ballerine-workflow:4000']
            }
          ],
          metrics_path: '/metrics',
          scrape_interval: '30s'
        },
        {
          job_name: 'thaliumx-blnkfinance',
          static_configs: [
            {
              targets: ['thaliumx-blnk-finance:5001']
            }
          ],
          metrics_path: '/metrics',
          scrape_interval: '30s'
        },
        {
          job_name: 'node-exporter',
          static_configs: [
            {
              targets: ['node-exporter:9100']
            }
          ]
        },
        {
          job_name: 'postgres-exporter',
          static_configs: [
            {
              targets: ['postgres-exporter:9187']
            }
          ]
        },
        {
          job_name: 'redis-exporter',
          static_configs: [
            {
              targets: ['redis-exporter:9121']
            }
          ]
        }
      ]
    };

    const configPath = path.join(this.PROMETHEUS_DIR, 'prometheus.yml');
    fs.writeFileSync(configPath, JSON.stringify(prometheusConfig, null, 2));
    LoggerService.info(`✅ Prometheus configuration written to: ${configPath}`);
  }

  private static async setupGrafana(): Promise<void> {
    LoggerService.info('Setting up Grafana dashboards...');

    // Backend Performance Dashboard
    const backendDashboard = {
      dashboard: {
        title: 'ThaliumX Backend Performance',
        tags: ['thaliumx', 'backend'],
        timezone: 'UTC',
        panels: [
          {
            title: 'HTTP Request Rate',
            type: 'graph',
            targets: [
              {
                expr: 'rate(http_requests_total[5m])',
                legendFormat: '{{method}} {{route}}'
              }
            ]
          },
          {
            title: 'HTTP Request Duration',
            type: 'graph',
            targets: [
              {
                expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
                legendFormat: '95th percentile'
              }
            ]
          },
          {
            title: 'Database Query Performance',
            type: 'graph',
            targets: [
              {
                expr: 'rate(database_queries_total[5m])',
                legendFormat: '{{operation}} {{table}}'
              }
            ]
          },
          {
            title: 'Redis Operations',
            type: 'graph',
            targets: [
              {
                expr: 'rate(redis_operations_total[5m])',
                legendFormat: '{{operation}}'
              }
            ]
          },
          {
            title: 'Active Users',
            type: 'graph',
            targets: [
              {
                expr: 'active_users',
                legendFormat: '{{broker_id}}'
              }
            ]
          },
          {
            title: 'System Resources',
            type: 'graph',
            targets: [
              {
                expr: 'process_resident_memory_bytes / 1024 / 1024',
                legendFormat: 'Memory Usage (MB)'
              },
              {
                expr: 'rate(process_cpu_user_seconds_total[5m]) * 100',
                legendFormat: 'CPU Usage (%)'
              }
            ]
          }
        ]
      }
    };

    const dashboardPath = path.join(this.GRAFANA_DIR, 'dashboards', 'thaliumx-backend-performance.json');
    fs.writeFileSync(dashboardPath, JSON.stringify(backendDashboard, null, 2));
    LoggerService.info(`✅ Backend performance dashboard created: ${dashboardPath}`);

    // Compliance Dashboard
    const complianceDashboard = {
      dashboard: {
        title: 'ThaliumX Compliance Monitoring',
        tags: ['thaliumx', 'compliance'],
        timezone: 'UTC',
        panels: [
          {
            title: 'KYC Verifications',
            type: 'stat',
            targets: [
              {
                expr: 'sum(kyc_verifications_total)',
                legendFormat: 'Total Verifications'
              }
            ]
          },
          {
            title: 'AML Alerts',
            type: 'table',
            targets: [
              {
                expr: 'aml_alerts_total',
                legendFormat: 'AML Alerts'
              }
            ]
          },
          {
            title: 'Travel Rule Messages',
            type: 'graph',
            targets: [
              {
                expr: 'travel_rule_messages_total',
                legendFormat: '{{status}}'
              }
            ]
          },
          {
            title: 'CARF Reports',
            type: 'graph',
            targets: [
              {
                expr: 'carf_reports_total',
                legendFormat: '{{status}}'
              }
            ]
          }
        ]
      }
    };

    const compliancePath = path.join(this.GRAFANA_DIR, 'dashboards', 'thaliumx-compliance.json');
    fs.writeFileSync(compliancePath, JSON.stringify(complianceDashboard, null, 2));
    LoggerService.info(`✅ Compliance dashboard created: ${compliancePath}`);
  }

  private static async setupAlertManager(): Promise<void> {
    LoggerService.info('Setting up AlertManager configuration...');

    const alertManagerConfig = {
      global: {
        smtp_smarthost: 'smtp.gmail.com:587',
        smtp_from: process.env.ALERT_EMAIL_FROM || 'alerts@thaliumx.com',
        smtp_auth_username: process.env.ALERT_EMAIL_USER,
        smtp_auth_password: process.env.ALERT_EMAIL_PASS
      },
      route: {
        group_by: ['alertname'],
        group_wait: '10s',
        group_interval: '10s',
        repeat_interval: '1h',
        receiver: 'thaliumx-team',
        routes: [
          {
            match: {
              severity: 'critical'
            },
            receiver: 'thaliumx-critical'
          },
          {
            match: {
              team: 'security'
            },
            receiver: 'thaliumx-security'
          }
        ]
      },
      receivers: [
        {
          name: 'thaliumx-team',
          email_configs: [
            {
              to: process.env.ALERT_EMAIL_TO || 'team@thaliumx.com',
              subject: '{{ .GroupLabels.alertname }}: {{ .GroupLabels.instance }}',
              body: `
                {{ range .Alerts }}
                Alert: {{ .Annotations.summary }}
                Description: {{ .Annotations.description }}
                Severity: {{ .Labels.severity }}
                Instance: {{ .Labels.instance }}
                {{ end }}
              `
            }
          ]
        },
        {
          name: 'thaliumx-critical',
          email_configs: [
            {
              to: process.env.CRITICAL_ALERT_EMAIL || 'critical@thaliumx.com'
            }
          ],
          slack_configs: [
            {
              api_url: process.env.SLACK_WEBHOOK_URL,
              channel: '#critical-alerts',
              title: '🚨 CRITICAL ALERT',
              text: '{{ .CommonAnnotations.summary }}'
            }
          ]
        },
        {
          name: 'thaliumx-security',
          email_configs: [
            {
              to: process.env.SECURITY_ALERT_EMAIL || 'security@thaliumx.com'
            }
          ]
        }
      ]
    };

    const configPath = path.join(this.ALERTMANAGER_DIR, 'alertmanager.yml');
    fs.writeFileSync(configPath, JSON.stringify(alertManagerConfig, null, 2));
    LoggerService.info(`✅ AlertManager configuration written to: ${configPath}`);
  }

  private static async setupCustomMetrics(): Promise<void> {
    LoggerService.info('Setting up custom metrics and alerts...');

    const alertsConfig = {
      groups: [
        {
          name: 'thaliumx-backend.alerts',
          rules: [
            {
              alert: 'HighErrorRate',
              expr: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05',
              for: '5m',
              labels: {
                severity: 'warning',
                team: 'backend'
              },
              annotations: {
                summary: 'High error rate detected',
                description: 'Error rate is {{ $value }}% which is above 5%'
              }
            },
            {
              alert: 'HighLatency',
              expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2',
              for: '5m',
              labels: {
                severity: 'warning',
                team: 'backend'
              },
              annotations: {
                summary: 'High request latency detected',
                description: '95th percentile latency is {{ $value }}s'
              }
            },
            {
              alert: 'DatabaseConnectionIssues',
              expr: 'up{job="thaliumx-backend"} == 0',
              for: '1m',
              labels: {
                severity: 'critical',
                team: 'backend'
              },
              annotations: {
                summary: 'Backend service is down',
                description: 'ThaliumX backend service has been down for more than 1 minute'
              }
            },
            {
              alert: 'HighMemoryUsage',
              expr: 'process_resident_memory_bytes / 1024 / 1024 > 1024',
              for: '5m',
              labels: {
                severity: 'warning',
                team: 'backend'
              },
              annotations: {
                summary: 'High memory usage detected',
                description: 'Memory usage is {{ $value }}MB'
              }
            }
          ]
        },
        {
          name: 'thaliumx-security.alerts',
          rules: [
            {
              alert: 'FailedLoginAttempts',
              expr: 'increase(failed_login_attempts_total[5m]) > 10',
              for: '5m',
              labels: {
                severity: 'warning',
                team: 'security'
              },
              annotations: {
                summary: 'Multiple failed login attempts',
                description: '{{ $value }} failed login attempts in 5 minutes'
              }
            },
            {
              alert: 'SuspiciousTransaction',
              expr: 'increase(suspicious_transactions_total[5m]) > 5',
              for: '2m',
              labels: {
                severity: 'critical',
                team: 'security'
              },
              annotations: {
                summary: 'Suspicious transactions detected',
                description: '{{ $value }} suspicious transactions flagged'
              }
            }
          ]
        },
        {
          name: 'thaliumx-compliance.alerts',
          rules: [
            {
              alert: 'KYCVerificationDelay',
              expr: 'increase(kyc_pending_verifications_total[1h]) > 50',
              for: '30m',
              labels: {
                severity: 'warning',
                team: 'compliance'
              },
              annotations: {
                summary: 'KYC verification backlog',
                description: '{{ $value }} KYC verifications pending for over 1 hour'
              }
            },
            {
              alert: 'TravelRuleCompliance',
              expr: 'travel_rule_compliance_rate < 0.95',
              for: '15m',
              labels: {
                severity: 'critical',
                team: 'compliance'
              },
              annotations: {
                summary: 'Travel Rule compliance below threshold',
                description: 'Travel Rule compliance rate is {{ $value }}%'
              }
            }
          ]
        }
      ]
    };

    const alertsPath = path.join(this.PROMETHEUS_DIR, 'thaliumx_alerts.yml');
    fs.writeFileSync(alertsPath, JSON.stringify(alertsConfig, null, 2));
    LoggerService.info(`✅ Custom alerts configuration written to: ${alertsPath}`);
  }

  static async validate(): Promise<void> {
    LoggerService.info('🔍 Validating monitoring setup...');

    try {
      // Check if configuration files exist
      const files = [
        path.join(this.PROMETHEUS_DIR, 'prometheus.yml'),
        path.join(this.PROMETHEUS_DIR, 'thaliumx_alerts.yml'),
        path.join(this.ALERTMANAGER_DIR, 'alertmanager.yml'),
        path.join(this.GRAFANA_DIR, 'dashboards', 'thaliumx-backend-performance.json'),
        path.join(this.GRAFANA_DIR, 'dashboards', 'thaliumx-compliance.json')
      ];

      for (const file of files) {
        if (!fs.existsSync(file)) {
          throw new Error(`Configuration file missing: ${file}`);
        }

        // Validate JSON syntax
        const content = fs.readFileSync(file, 'utf8');
        try {
          JSON.parse(content);
        } catch (error) {
          throw new Error(`Invalid JSON in ${file}: ${error.message}`);
        }
      }

      LoggerService.info('✅ Monitoring configuration validation passed');

    } catch (error) {
      LoggerService.error('❌ Monitoring configuration validation failed:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];

  try {
    if (command === 'setup') {
      await MonitoringSetup.setup();
    } else if (command === 'validate') {
      await MonitoringSetup.validate();
    } else if (command === 'all') {
      await MonitoringSetup.setup();
      await MonitoringSetup.validate();
    } else {
      console.log('Usage: ts-node monitoring-setup.ts [setup|validate|all]');
      console.log('Commands:');
      console.log('  setup     Configure monitoring infrastructure');
      console.log('  validate  Validate monitoring configuration');
      console.log('  all       Setup and validate monitoring');
      process.exit(1);
    }

  } catch (error) {
    console.error('Command failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { MonitoringSetup };