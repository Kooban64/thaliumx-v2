/**
 * Workflow Status Card Component
 * 
 * Displays workflow status with progress indicator and quick actions
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WorkflowState, WorkflowStatus, WorkflowType } from '@/lib/api/types/workflows';
import { useWorkflowActions } from '@/lib/api/hooks/workflows';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
}

interface WorkflowStatusCardProps {
  workflow: WorkflowState;
  showActions?: boolean;
  onRetry?: () => void;
  onCancel?: () => void;
  onViewDetails?: () => void;
  className?: string;
}

const getStatusIcon = (status: WorkflowStatus) => {
  switch (status) {
    case WorkflowStatus.COMPLETED:
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    case WorkflowStatus.FAILED:
      return <XCircle className="h-5 w-5 text-red-600" />;
    case WorkflowStatus.CANCELLED:
      return <X className="h-5 w-5 text-gray-600" />;
    case WorkflowStatus.RUNNING:
      return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    case WorkflowStatus.PENDING:
      return <Clock className="h-5 w-5 text-yellow-600" />;
    default:
      return <AlertCircle className="h-5 w-5 text-gray-600" />;
  }
};

const getStatusColor = (status: WorkflowStatus) => {
  switch (status) {
    case WorkflowStatus.COMPLETED:
      return 'text-green-600 bg-green-50 border-green-200';
    case WorkflowStatus.FAILED:
      return 'text-red-600 bg-red-50 border-red-200';
    case WorkflowStatus.CANCELLED:
      return 'text-gray-600 bg-gray-50 border-gray-200';
    case WorkflowStatus.RUNNING:
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case WorkflowStatus.PENDING:
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

const formatWorkflowType = (type: WorkflowType): string => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function WorkflowStatusCard({
  workflow,
  showActions = true,
  onRetry,
  onCancel,
  onViewDetails,
  className
}: WorkflowStatusCardProps) {
  const { retry, cancel, retryLoading, cancelLoading } = useWorkflowActions();

  const handleRetry = async () => {
    if (onRetry) {
      onRetry();
    } else {
      await retry(workflow.workflowId);
    }
  };

  const handleCancel = async () => {
    if (onCancel) {
      onCancel();
    } else {
      await cancel(workflow.workflowId, 'Cancelled by user');
    }
  };

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails();
    }
  };

  const updatedAt = workflow.updatedAt instanceof Date 
    ? workflow.updatedAt 
    : new Date(workflow.updatedAt);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon(workflow.status)}
            <CardTitle className="text-lg">
              {formatWorkflowType(workflow.workflowType)}
            </CardTitle>
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(workflow.status)}`}>
            {workflow.status}
          </span>
        </div>
        <CardDescription>
          {workflow.currentStep && (
            <span>Current step: {workflow.currentStep}</span>
          )}
          {!workflow.currentStep && (
            <span>Workflow ID: {workflow.workflowId.slice(0, 8)}...</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress indicator */}
        {workflow.status === WorkflowStatus.RUNNING && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-muted-foreground">Step {workflow.stepIndex + 1}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((workflow.stepIndex / 10) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {workflow.status === WorkflowStatus.FAILED && workflow.errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{workflow.errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* Metadata */}
        <div className="text-sm text-muted-foreground space-y-1">
          <div>Updated {formatTimeAgo(updatedAt)}</div>
          {workflow.retryCount > 0 && (
            <div>Retries: {workflow.retryCount}/{workflow.maxRetries}</div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2">
            {workflow.status === WorkflowStatus.FAILED && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                disabled={retryLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${retryLoading ? 'animate-spin' : ''}`} />
                Retry
              </Button>
            )}
            {(workflow.status === WorkflowStatus.RUNNING || workflow.status === WorkflowStatus.PENDING) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={cancelLoading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleViewDetails}
              asChild
            >
              <Link href={`/workflows/${workflow.workflowId}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Details
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
