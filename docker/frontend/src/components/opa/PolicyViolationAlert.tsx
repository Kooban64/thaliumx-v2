'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, AlertTriangle, Shield } from 'lucide-react';
import apiClient from '@/lib/api/client';

interface PolicyViolation {
  id: string;
  timestamp: string;
  policy: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  userId?: string;
  transactionId?: string;
  action?: string;
}

interface PolicyDecision {
  id: string;
  timestamp: string;
  policy: string;
  ruleId?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  reason?: string;
  userId?: string;
  transactionId?: string;
  action?: string;
}

interface PolicyDecisionsResponse {
  data: PolicyDecision[];
}

interface PolicyViolationAlertProps {
  userId?: string;
  autoDismiss?: boolean;
  dismissAfter?: number;
  onDismiss?: (violationId: string) => void;
  className?: string;
}

export function PolicyViolationAlert({
  userId,
  autoDismiss = false,
  dismissAfter = 10000,
  onDismiss,
  className
}: PolicyViolationAlertProps) {
  const [violations, setViolations] = useState<PolicyViolation[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const handleDismiss = useCallback(
    (violationId: string) => {
      setDismissed(prev => new Set([...prev, violationId]));
      setViolations(prev => prev.filter(v => v.id !== violationId));
      onDismiss?.(violationId);
    },
    [onDismiss],
  );

  useEffect(() => {
    if (!userId) return;

    const dismissTimeouts: Map<string, NodeJS.Timeout> = new Map();

    const fetchViolations = async () => {
      try {
        const params = new URLSearchParams({
          userId: userId || '',
          severity: 'critical,high',
          limit: '5',
          allowed: 'false'
        });
        const res = await apiClient.get<PolicyDecisionsResponse>(`/api/admin/policies/decisions?${params.toString()}`);

        if (res.success && res.data) {
          const newViolations: PolicyViolation[] = res.data.data
            .filter((d) => 
              !dismissed.has(d.id) && 
              (d.severity === 'critical' || d.severity === 'high')
            )
            .map((d) => ({
              id: d.id,
              timestamp: d.timestamp,
              policy: d.policy,
              ruleId: d.ruleId || 'unknown',
              severity: d.severity || 'medium',
              reason: d.reason || 'Policy violation detected',
              userId: d.userId,
              transactionId: d.transactionId,
              action: d.action
            }));

          setViolations(prev => {
            const existingIds = new Set(prev.map(v => v.id));
            const toAdd = newViolations.filter(v => !existingIds.has(v.id));
            
            toAdd.forEach(violation => {
              if (autoDismiss) {
                const timeout = setTimeout(() => {
                  handleDismiss(violation.id);
                }, dismissAfter);
                dismissTimeouts.set(violation.id, timeout);
              }
            });
            
            return [...prev, ...toAdd];
          });
        }
      } catch (err) {
        console.debug('Failed to fetch policy violations', err);
      }
    };

    fetchViolations();
    const pollInterval = setInterval(fetchViolations, 30000);

    return () => {
      clearInterval(pollInterval);
      dismissTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [userId, autoDismiss, dismissAfter, dismissed, handleDismiss]);

  const getSeverityColor = (severity: string): 'default' | 'destructive' => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  if (violations.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {violations.map((violation) => (
        <Alert
          key={violation.id}
          variant={getSeverityColor(violation.severity)}
          className="relative"
        >
          <div className="flex items-start gap-2">
            {getSeverityIcon(violation.severity)}
            <div className="flex-1">
              <AlertTitle className="flex items-center gap-2">
                Policy Violation Detected
                <Badge variant="outline" className="text-xs">
                  {violation.severity}
                </Badge>
              </AlertTitle>
              <AlertDescription className="mt-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{violation.reason}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Policy: {violation.policy}</span>
                    <span>Rule: {violation.ruleId}</span>
                    {violation.action && <span>Action: {violation.action}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = '/admin/compliance'}
                    >
                      View Details
                    </Button>
                    {violation.transactionId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.location.href = `/admin/compliance?transactionId=${violation.transactionId}`}
                      >
                        View Transaction
                      </Button>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-6 w-6 p-0"
              onClick={() => handleDismiss(violation.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
}
