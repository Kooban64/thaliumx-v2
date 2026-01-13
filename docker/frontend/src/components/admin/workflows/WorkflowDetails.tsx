'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWorkflowStatus, useWorkflowActions } from '@/lib/api/hooks/workflows';
import { Loader2, ArrowLeft, Workflow, CheckCircle2, XCircle, Clock, Play, X } from 'lucide-react';
import { toast } from '@/components/shared/Toast';
import { WorkflowStatus } from '@/lib/api/types/workflows';

interface WorkflowDetailsProps {
  workflowId: string;
}

/**
 * WorkflowDetails - Display workflow details and steps with full functionality
 */
export function WorkflowDetails({ workflowId }: WorkflowDetailsProps) {
  const router = useRouter();
  const { data: workflow, loading: isLoading, error } = useWorkflowStatus(workflowId, {
    enabled: !!workflowId,
  });
  const { retry, cancel, retryLoading, cancelLoading } = useWorkflowActions();

  const handleRetry = async () => {
    try {
      await retry(workflowId);
      toast({
        type: 'success',
        title: 'Workflow retried',
        description: 'The workflow step has been retried',
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to retry workflow',
        description: err instanceof Error ? err.message : 'Failed to retry workflow step',
      });
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this workflow?')) {
      return;
    }

    try {
      await cancel(workflowId, 'Cancelled by admin');
      toast({
        type: 'success',
        title: 'Workflow cancelled',
        description: 'The workflow has been cancelled',
      });
      router.push('/admin/workflows');
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to cancel workflow',
        description: err instanceof Error ? err.message : 'Failed to cancel workflow',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      [WorkflowStatus.RUNNING]: { variant: 'secondary', icon: Clock },
      [WorkflowStatus.COMPLETED]: { variant: 'default', icon: CheckCircle2 },
      [WorkflowStatus.FAILED]: { variant: 'destructive', icon: XCircle },
      [WorkflowStatus.CANCELLED]: { variant: 'outline', icon: X },
    };

    const config = variants[status] || variants[WorkflowStatus.RUNNING]!;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">
          {error || 'Workflow not found'}
        </p>
        <Button variant="outline" onClick={() => router.push('/admin/workflows')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Workflows
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" onClick={() => router.push('/admin/workflows')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workflows
          </Button>
          <h1 className="text-3xl font-bold">Workflow Details</h1>
          <p className="text-muted-foreground">
            View workflow steps and status
          </p>
        </div>
        <div className="flex gap-2">
          {workflow.status === WorkflowStatus.FAILED && (
            <Button
              variant="outline"
              onClick={handleRetry}
              disabled={retryLoading}
            >
              {retryLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Retry
                </>
              )}
            </Button>
          )}
          {workflow.status === WorkflowStatus.RUNNING && (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelLoading}
            >
              {cancelLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Workflow Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Workflow Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Workflow ID</p>
              <p className="text-lg font-semibold">{workflow.workflowId}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Type</p>
              <p className="text-lg font-semibold">{workflow.workflowType || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="mt-1">{getStatusBadge(workflow.status)}</div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p className="text-lg">
                {workflow.createdAt ? formatDateTime(String(workflow.createdAt)) : 'Unknown'}
              </p>
            </div>
            {workflow.completedAt && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-lg">{formatDateTime(String(workflow.completedAt))}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workflow Steps */}
      {(workflow.metadata?.steps && Array.isArray(workflow.metadata.steps) && workflow.metadata.steps.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workflow.metadata.steps.map((step: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{step.name || `Step ${index + 1}`}</p>
                      {step.description && (
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      )}
                      {step.error && (
                        <p className="text-sm text-destructive mt-1">Error: {step.error}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    {getStatusBadge(step.status || 'pending')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow Data */}
      {workflow.data && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow Data</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="p-4 bg-muted rounded-lg text-sm overflow-auto">
              {JSON.stringify(workflow.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
