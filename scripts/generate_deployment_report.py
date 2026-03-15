#!/usr/bin/env python3
"""
Deployment Report Generation Script
Generates a comprehensive deployment report
"""

import json
import os
import sys
from datetime import datetime

def generate_report():
    """Generate deployment report"""
    report = {
        "timestamp": datetime.utcnow().isoformat(),
        "deployment_type": "production",
        "auth_provider": "Authentik",
        "services": [
            "vault", "postgres", "redis", "citus-coordinator", "citus-worker-1", "citus-worker-2",
            "timescaledb", "mongodb", "backend", "frontend", "kafka", "kafka-init", "kafka-ui",
            "schema-registry", "opa", "apisix", "apisix-init", "apisix-dashboard", "etcd",
            "prometheus", "grafana", "loki", "tempo", "promtail", "alertmanager", "otel-collector",
            "blackbox-exporter", "cadvisor", "postgres-exporter", "redis-exporter", "typesense",
            "dingir-matchengine", "dingir-restapi", "liquibook", "quantlib", "ballerine-postgres",
            "ballerine-workflow", "ballerine-backoffice", "blnkfinance-migrate", "blnkfinance",
            "compliance-cex", "compliance-dex", "compliance-nft", "compliance-token",
            "compliance-coordinator", "Authentik-postgres", "Authentik", "wazuh-manager",
            "wazuh-indexer", "wazuh-dashboard"
        ],
        "verification_results": {
            "infrastructure_health": "pending",
            "migration_status": "pending",
            "authentication_flow": "pending",
            "api_gateway": "pending",
            "integration_tests": "pending",
            "performance_baseline": "pending",
            "security_checks": "pending"
        },
        "recommendations": [
            "Monitor service logs for errors",
            "Verify backup configurations",
            "Test failover scenarios",
            "Review security policies",
            "Set up monitoring alerts"
        ]
    }

    return report

def save_report(report, filename="deployment-report.json"):
    """Save report to file"""
    try:
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"✅ Report saved to {filename}")
        return True
    except Exception as e:
        print(f"❌ Failed to save report: {e}")
        return False

def generate_html_report(json_report, html_filename="deployment-report.html"):
    """Generate HTML version of the report"""
    try:
        html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>ThaliumX Production Deployment Report</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 40px; }}
        .header {{ background: #f0f0f0; padding: 20px; border-radius: 5px; }}
        .services {{ margin: 20px 0; }}
        .service {{ display: inline-block; background: #e0e0e0; padding: 5px 10px; margin: 2px; border-radius: 3px; }}
        .status {{ padding: 10px; margin: 10px 0; border-left: 4px solid #ccc; }}
        .status.good {{ border-left-color: #4CAF50; background: #f0fff0; }}
        .status.warning {{ border-left-color: #FF9800; background: #fff8e1; }}
        .recommendations {{ background: #fff3cd; padding: 15px; border-radius: 5px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 ThaliumX Production Deployment Report</h1>
        <p><strong>Generated:</strong> {json_report['timestamp']}</p>
        <p><strong>Auth Provider:</strong> {json_report['auth_provider']}</p>
        <p><strong>Services Deployed:</strong> {len(json_report['services'])}</p>
    </div>

    <h2>📋 Deployed Services</h2>
    <div class="services">
        {"".join(f'<span class="service">{service}</span>' for service in json_report['services'])}
    </div>

    <h2>🔍 Verification Results</h2>
    {"".join(f'<div class="status good"><strong>{k.replace("_", " ").title()}:</strong> {v}</div>' for k, v in json_report['verification_results'].items())}

    <h2>💡 Recommendations</h2>
    <div class="recommendations">
        <ul>
            {"".join(f"<li>{rec}</li>" for rec in json_report['recommendations'])}
        </ul>
    </div>
</body>
</html>
"""

        with open(html_filename, 'w') as f:
            f.write(html_content)
        print(f"✅ HTML report saved to {html_filename}")
        return True
    except Exception as e:
        print(f"❌ Failed to generate HTML report: {e}")
        return False

def main():
    print("📊 Generating Deployment Report")
    print("=" * 35)

    # Generate the report
    report = generate_report()

    # Save JSON report
    json_saved = save_report(report)

    # Generate HTML report
    html_saved = generate_html_report(report)

    if json_saved and html_saved:
        print("✅ Deployment report generation complete!")
        print("📄 Check deployment-report.json and deployment-report.html")
        return 0
    else:
        print("⚠️  Report generation had issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())