/**
 * Onboarding Progress Component
 * 
 * Shows onboarding workflow progress during user registration
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WorkflowProgress } from '../workflows/WorkflowProgress';
import { useUserWorkflows } from '@/lib/api/hooks/workflows';
import { WorkflowType, WorkflowStatus } from '@/lib/api/types/workflows';
import { Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface OnboardingProgressProps {
  userId: string;
  onComplete?: () => void;
  className?: string;
}

const onboardingSteps = [
  { name: 'Validate User Data', description: 'Validating your information' },
  { name: 'KYC Verification', description: 'Verifying your identity with Ballerine' },
  { name: 'Wait for KYC', description: 'Waiting for KYC approval' },
  { name: 'Create Account', description: 'Creating your user account' },
  { name: 'Create Trading Account', description: 'Setting up your trading account' },
  { name: 'Setup Wallet', description: 'Creating your wallet infrastructure' },
  { name: 'Send Welcome Email', description: 'Sending welcome email' },
  { name: 'Complete', description: 'Onboarding complete!' }
];

export function OnboardingProgress({
  userId,
  onComplete,
  className
}: OnboardingProgressProps) {
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const { data, loading, refetch } = useUserWorkflows(userId, {
    workflowType: WorkflowType.USER_ONBOARDING,
    status: undefined // Get all statuses
  });

  useEffect(() => {
    // Find the most recent onboarding workflow
    if (data?.workflows && data.workflows.length > 0) {
      const onboardingWorkflow = data.workflows.find(
        w => w.workflowType === WorkflowType.USER_ONBOARDING
      );
      if (onboardingWorkflow) {
        setWorkflowId(onboardingWorkflow.workflowId);
      }
    }
  }, [data]);

  // Poll for updates
  useEffect(() => {
    if (workflowId) {
      const interval = setInterval(() => {
        refetch();
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [workflowId, refetch]);

  // Check if onboarding is complete
  useEffect(() => {
    if (data?.workflows) {
      const completed = data.workflows.find(
        w => w.workflowType === WorkflowType.USER_ONBOARDING &&
        w.status === WorkflowStatus.COMPLETED
      );
      if (completed && onComplete) {
        onComplete();
      }
    }
  }, [data, onComplete]);

  const workflow = data?.workflows?.find(
    w => w.workflowType === WorkflowType.USER_ONBOARDING
  );

  if (loading && !workflow) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!workflow) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Onboarding</CardTitle>
          <CardDescription>Setting up your account...</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your onboarding workflow is being initialized. Please wait...
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Onboarding Progress</CardTitle>
            <CardDescription>
              {workflow.status === WorkflowStatus.COMPLETED
                ? 'Your account setup is complete!'
                : "We&apos;re setting up your account. This may take a few minutes."}
            </CardDescription>
          </div>
          {workflow.status === WorkflowStatus.COMPLETED && (
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <WorkflowProgress workflow={workflow} steps={onboardingSteps} />

        {/* KYC Status */}
        {workflow.data?.ballerineWorkflowId && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">KYC Verification in Progress</div>
              <div className="text-sm text-muted-foreground">
                Your identity verification is being processed. You&apos;ll receive an email once it&apos;s complete.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Error State */}
        {workflow.status === WorkflowStatus.FAILED && workflow.errorMessage && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">Onboarding Failed</div>
              <div className="text-sm">{workflow.errorMessage}</div>
            </AlertDescription>
          </Alert>
        )}

        {/* Next Steps */}
        {workflow.status === WorkflowStatus.RUNNING && workflow.currentStep === 'wait_for_kyc_completion' && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-1">What&apos;s Next?</div>
              <div className="text-sm text-muted-foreground">
                Please check your email for KYC verification instructions. Once verified, your account setup will continue automatically.
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
