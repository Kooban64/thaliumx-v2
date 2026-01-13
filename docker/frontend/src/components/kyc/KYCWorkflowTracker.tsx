'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { useKYC } from '@/lib/api/hooks/useKYC';
import { cn } from '@/lib/utils';

interface KYCWorkflowTrackerProps {
  workflowId?: string;
  className?: string;
}

type WorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'requires_action';

interface WorkflowStep {
  id: string;
  name: string;
  status: WorkflowStatus;
  completedAt?: string;
  estimatedTime?: string;
}

/**
 * KYCWorkflowTracker - Tracks Ballerine workflow progress
 * Shows workflow steps and current status
 */
export function KYCWorkflowTracker({ className }: KYCWorkflowTrackerProps) {
  const { status, isLoading } = useKYC();

  // Mock workflow steps - in production, fetch from API
  const workflowSteps: WorkflowStep[] = [
    {
      id: 'document_collection',
      name: 'Document Collection',
      status: status === 'approved' ? 'completed' : status === 'pending' ? 'in_progress' : 'pending',
      completedAt: status === 'approved' ? new Date().toISOString() : undefined,
    },
    {
      id: 'document_verification',
      name: 'Document Verification',
      status: status === 'approved' ? 'completed' : status === 'pending' ? 'pending' : 'pending',
      completedAt: status === 'approved' ? new Date().toISOString() : undefined,
    },
    {
      id: 'sanctions_check',
      name: 'Sanctions Check',
      status: status === 'approved' ? 'completed' : status === 'pending' ? 'pending' : 'pending',
      completedAt: status === 'approved' ? new Date().toISOString() : undefined,
    },
    {
      id: 'pep_check',
      name: 'PEP Check',
      status: status === 'approved' ? 'completed' : status === 'pending' ? 'pending' : 'pending',
      completedAt: status === 'approved' ? new Date().toISOString() : undefined,
    },
    {
      id: 'face_verification',
      name: 'Face Verification',
      status: status === 'approved' ? 'completed' : status === 'pending' ? 'pending' : 'pending',
      completedAt: status === 'approved' ? new Date().toISOString() : undefined,
    },
    {
      id: 'final_review',
      name: 'Final Review',
      status: status === 'approved' ? 'completed' : status === 'pending' ? 'in_progress' : 'pending',
      completedAt: status === 'approved' ? new Date().toISOString() : undefined,
    },
  ];

  const getStepIcon = (stepStatus: WorkflowStatus) => {
    switch (stepStatus) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600 animate-pulse" />;
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'requires_action':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStepBadge = (stepStatus: WorkflowStatus) => {
    switch (stepStatus) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'in_progress':
        return <Badge variant="default" className="bg-blue-600">In Progress</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'requires_action':
        return <Badge variant="outline" className="border-yellow-600 text-yellow-600">Action Required</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const completedSteps = workflowSteps.filter((step) => step.status === 'completed').length;
  const progress = (completedSteps / workflowSteps.length) * 100;
  const currentStep = workflowSteps.find((step) => step.status === 'in_progress');

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Workflow Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-2 bg-muted rounded"></div>
            <div className="h-2 bg-muted rounded w-3/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Workflow Progress</CardTitle>
        <CardDescription>
          {currentStep
            ? `Currently: ${currentStep.name}`
            : status === 'approved'
            ? 'All steps completed'
            : 'Workflow in progress'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">
              {completedSteps} / {workflowSteps.length} steps
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Workflow Steps */}
        <div className="space-y-3">
          {workflowSteps.map((step) => {
            const isActive = step.status === 'in_progress';
            const isCompleted = step.status === 'completed';
            const isPending = step.status === 'pending';

            return (
              <div
                key={step.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                  isActive && 'bg-blue-50 border-blue-200',
                  isCompleted && 'bg-green-50 border-green-200',
                  isPending && 'bg-muted/50'
                )}
              >
                <div className="flex-shrink-0 mt-0.5">{getStepIcon(step.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isActive && 'text-blue-900',
                        isCompleted && 'text-green-900',
                        isPending && 'text-muted-foreground'
                      )}
                    >
                      {step.name}
                    </span>
                    {getStepBadge(step.status)}
                  </div>
                  {step.completedAt && (
                    <p className="text-xs text-muted-foreground">
                      Completed {new Date(step.completedAt).toLocaleDateString()}
                    </p>
                  )}
                  {isActive && step.estimatedTime && (
                    <p className="text-xs text-blue-600">Estimated: {step.estimatedTime}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status Summary */}
        {status && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Status</span>
              <Badge
                variant={
                  status === 'approved'
                    ? 'default'
                    : status === 'rejected'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {status === 'approved'
                  ? 'Approved'
                  : status === 'rejected'
                  ? 'Rejected'
                  : status === 'pending'
                  ? 'Pending Review'
                  : status === 'in_review'
                  ? 'In Review'
                  : 'Unknown'}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
