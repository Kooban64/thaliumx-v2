/**
 * Workflow Details Component
 * 
 * Detailed view of a single workflow with full information
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WorkflowProgress } from './WorkflowProgress';
import { useWorkflowStatus, useWorkflowActions } from '@/lib/api/hooks/workflows';
import { WorkflowStatus, WorkflowType } from '@/lib/api/types/workflows';
import { 
  CheckCircle2, 
  Clock, 
  Loader2, 
  AlertCircle,
  RefreshCw,
  X,
  ArrowLeft,
  Copy,
  Calendar
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface WorkflowDetailsProps {
  workflowId: string;
  className?: string;
}

const formatWorkflowType = (type: WorkflowType): string => {
  return type
    .split('_')
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatDate = (date: Date | string): string => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleString();
};

export function WorkflowDetails({ workflowId, className }: WorkflowDetailsProps) {
  const router = useRouter();
  const { data: workflow, loading, error, refetch } = useWorkflowStatus(workflowId, { pollInterval: 3000 });
  const { retry, cancel, retryLoading, cancelLoading } = useWorkflowActions();
  const [copied, setCopied] = useState(false);

  const handleRetry = async () => {
    if (workflow) {
      await retry(workflow.workflowId);
      refetch();
    }
  };

  const handleCancel = async () => {
    if (workflow) {
      await cancel(workflow.workflowId, 'Cancelled by user');
      refetch();
    }
  };

  const copyWorkflowId = () => {
    if (workflow) {
      navigator.clipboard.writeText(workflow.workflowId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading && !workflow) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !workflow) {
    return (
      <Card className={className}>
        <CardContent className="py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <p className="text-red-600 mb-4">Error loading workflow: {error || 'Workflow not found'}</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.back()}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <div>
                  <CardTitle className="text-2xl">
                    {formatWorkflowType(workflow.workflowType)}
                  </CardTitle>
                  <CardDescription className="flex items-center space-x-2 mt-2">
                    <span>ID: {workflow.workflowId}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyWorkflowId}
                      className="h-6 px-2"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {copied && <span className="text-xs text-green-600">Copied!</span>}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {workflow.status === WorkflowStatus.FAILED && (
                  <Button
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
                    variant="outline"
                    onClick={handleCancel}
                    disabled={cancelLoading}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
            <CardDescription>Workflow execution steps</CardDescription>
          </CardHeader>
          <CardContent>
            <WorkflowProgress workflow={workflow} />
          </CardContent>
        </Card>

        {/* Status and Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Status Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Status</div>
                <div className="text-lg font-semibold capitalize">{workflow.status}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Current Step</div>
                <div className="text-lg">{workflow.currentStep || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Step Index</div>
                <div className="text-lg">{workflow.stepIndex}</div>
              </div>
              {workflow.retryCount > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Retries</div>
                  <div className="text-lg">{workflow.retryCount} / {workflow.maxRetries}</div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Created</div>
                  <div className="text-sm">{formatDate(workflow.createdAt)}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                  <div className="text-sm">{formatDate(workflow.updatedAt)}</div>
                </div>
              </div>
              {workflow.completedAt && (
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Completed</div>
                    <div className="text-sm">{formatDate(workflow.completedAt)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Error Details */}
        {workflow.status === WorkflowStatus.FAILED && workflow.errorMessage && (
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Error Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{workflow.errorMessage}</AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Workflow Data */}
        <Card>
          <CardHeader>
            <CardTitle>Workflow Data</CardTitle>
            <CardDescription>Additional workflow information</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
              {JSON.stringify(workflow.data, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {/* Metadata */}
        {workflow.metadata && Object.keys(workflow.metadata).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                {JSON.stringify(workflow.metadata, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
