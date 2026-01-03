/**
 * Workflow Progress Component
 * 
 * Visual progress indicator for multi-step workflows
 */

'use client';

import { WorkflowState, WorkflowStatus } from '@/lib/api/types/workflows';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';

interface WorkflowProgressProps {
  workflow: WorkflowState;
  steps?: Array<{ name: string; description?: string }>;
  className?: string;
}

export function WorkflowProgress({
  workflow,
  steps,
  className
}: WorkflowProgressProps) {
  // If steps not provided, create generic steps based on stepIndex
  const workflowSteps = steps || Array.from({ length: Math.max(workflow.stepIndex + 2, 5) }, (_, i) => ({
    name: `Step ${i + 1}`,
    description: i === workflow.stepIndex ? workflow.currentStep : undefined
  }));

  const getStepStatus = (index: number) => {
    if (index < workflow.stepIndex) {
      return 'completed';
    }
    if (index === workflow.stepIndex) {
      if (workflow.status === WorkflowStatus.FAILED) {
        return 'failed';
      }
      return 'active';
    }
    return 'pending';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'active':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 border-green-600';
      case 'failed':
        return 'text-red-600 border-red-600';
      case 'active':
        return 'text-blue-600 border-blue-600';
      default:
        return 'text-gray-400 border-gray-300';
    }
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        {workflowSteps.map((step, index) => {
          const status = getStepStatus(index);
          const isLast = index === workflowSteps.length - 1;

          return (
            <div key={index} className="flex items-start">
              {/* Step indicator */}
              <div className="flex flex-col items-center mr-4">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${getStepColor(status)}`}
                >
                  {getStepIcon(status)}
                </div>
                {!isLast && (
                  <div
                    className={`w-0.5 h-12 mt-2 ${
                      status === 'completed' ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-8">
                <div className={`font-medium ${getStepColor(status)}`}>
                  {step.name}
                </div>
                {step.description && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </div>
                )}
                {index === workflow.stepIndex && workflow.status === WorkflowStatus.RUNNING && (
                  <div className="text-xs text-blue-600 mt-1">
                    In progress...
                  </div>
                )}
                {index === workflow.stepIndex && workflow.status === WorkflowStatus.FAILED && workflow.errorMessage && (
                  <div className="text-xs text-red-600 mt-1">
                    {workflow.errorMessage}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
