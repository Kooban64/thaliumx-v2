'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBrokerCompliance } from '@/lib/api/hooks/useBroker';
import { Loader2, Shield, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * BrokerComplianceDashboard - Compliance overview with full functionality
 */
export function BrokerComplianceDashboard() {
  const { data, isLoading, error } = useBrokerCompliance();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-destructive mb-4">Failed to load compliance status</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border rounded-md hover:bg-muted"
            >
              Retry
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const compliance = data || {
    overall: 'review',
    kycCompliance: 0,
    transactionCompliance: 0,
    riskScore: 0,
    alerts: 0,
    lastReview: new Date().toISOString(),
  };

  const getOverallBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: LucideIcon }> = {
      compliant: { variant: 'default', icon: CheckCircle2 },
      'non-compliant': { variant: 'destructive', icon: XCircle },
      review: { variant: 'secondary', icon: AlertTriangle },
    };

    const config = variants[status] || variants.review!;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 text-lg px-3 py-1">
        <Icon className="h-4 w-4" />
        {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
      </Badge>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Compliance Dashboard</h1>
        <p className="text-muted-foreground">Monitor compliance status and requirements</p>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Overall Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              {getOverallBadge(compliance.overall)}
            </div>
            <div className="text-sm text-muted-foreground">
              Last Review: {formatDate(compliance.lastReview)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">KYC Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{compliance.kycCompliance}%</div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${compliance.kycCompliance}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Transaction Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{compliance.transactionCompliance}%</div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${compliance.transactionCompliance}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{compliance.riskScore}/100</div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  compliance.riskScore < 30
                    ? 'bg-green-500'
                    : compliance.riskScore < 70
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${compliance.riskScore}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{compliance.alerts}</div>
            <div className="text-sm text-muted-foreground mt-1">Requires attention</div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {compliance.kycCompliance >= 95 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span>KYC Verification</span>
              </div>
              <Badge variant={compliance.kycCompliance >= 95 ? 'default' : 'destructive'}>
                {compliance.kycCompliance >= 95 ? 'Compliant' : 'Non-Compliant'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {compliance.transactionCompliance >= 95 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span>Transaction Monitoring</span>
              </div>
              <Badge variant={compliance.transactionCompliance >= 95 ? 'default' : 'destructive'}>
                {compliance.transactionCompliance >= 95 ? 'Compliant' : 'Non-Compliant'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {compliance.riskScore < 50 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <span>Risk Management</span>
              </div>
              <Badge variant={compliance.riskScore < 50 ? 'default' : 'destructive'}>
                {compliance.riskScore < 50 ? 'Low Risk' : 'High Risk'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                {compliance.alerts === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                )}
                <span>Active Alerts</span>
              </div>
              <Badge variant={compliance.alerts === 0 ? 'default' : 'secondary'}>
                {compliance.alerts === 0 ? 'No Alerts' : `${compliance.alerts} Alerts`}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
