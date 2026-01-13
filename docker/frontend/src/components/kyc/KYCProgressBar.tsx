'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useKYC } from '@/lib/api/hooks/useKYC';
import { KYCLevel } from '@/stores/kycStore';
import { cn } from '@/lib/utils';

interface KYCProgressBarProps {
  className?: string;
}

/**
 * KYCProgressBar - Shows progress to next KYC level
 * Displays requirements checklist and benefits
 */
export function KYCProgressBar({ className }: KYCProgressBarProps) {
  const { level, isLoading } = useKYC();

  const getNextLevel = (currentLevel: KYCLevel | null): KYCLevel | null => {
    switch (currentLevel) {
      case null:
      case 'L0':
        return 'L1';
      case 'L1':
        return 'L2';
      case 'L2':
        return 'L3';
      case 'L3':
        return 'INSTITUTIONAL';
      default:
        return null;
    }
  };

  const getLevelRequirements = (targetLevel: KYCLevel) => {
    switch (targetLevel) {
      case 'L1':
        return [
          { id: 'email', label: 'Email Verification', completed: true },
          { id: 'phone', label: 'Phone Verification', completed: false },
          { id: 'sanctions', label: 'Sanctions Check', completed: false },
        ];
      case 'L2':
        return [
          { id: 'email', label: 'Email Verification', completed: true },
          { id: 'phone', label: 'Phone Verification', completed: true },
          { id: 'id', label: 'Government ID', completed: false },
          { id: 'address', label: 'Proof of Address', completed: false },
          { id: 'biometric', label: 'Biometric Verification', completed: false },
          { id: 'pep', label: 'PEP Check', completed: false },
        ];
      case 'L3':
        return [
          { id: 'l2', label: 'L2 Requirements', completed: true },
          { id: 'source', label: 'Source of Funds', completed: false },
          { id: 'enhanced', label: 'Enhanced Screening', completed: false },
        ];
      case 'INSTITUTIONAL':
        return [
          { id: 'business', label: 'Business Registration', completed: false },
          { id: 'incorporation', label: 'Incorporation Documents', completed: false },
          { id: 'ownership', label: 'Ownership Structure', completed: false },
          { id: 'signatories', label: 'Authorized Signatories', completed: false },
          { id: 'licenses', label: 'Regulatory Licenses', completed: false },
        ];
      default:
        return [];
    }
  };

  const getLevelBenefits = (targetLevel: KYCLevel) => {
    switch (targetLevel) {
      case 'L1':
        return [
          'Higher transaction limits',
          'Trading access enabled',
          'Increased daily transaction count',
        ];
      case 'L2':
        return [
          'Significantly higher limits',
          'Advanced trading features',
          'Priority support',
        ];
      case 'L3':
        return [
          'Maximum transaction limits',
          'Institutional features',
          'Dedicated account manager',
        ];
      case 'INSTITUTIONAL':
        return [
          'Enterprise-level limits',
          'Custom solutions',
          'White-glove service',
        ];
      default:
        return [];
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>KYC Progress</CardTitle>
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

  const nextLevel = getNextLevel(level);
  if (!nextLevel) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>KYC Progress</CardTitle>
          <CardDescription>You've reached the highest verification level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span>Maximum level achieved</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const requirements = getLevelRequirements(nextLevel);
  const benefits = getLevelBenefits(nextLevel);
  const completedCount = requirements.filter((r) => r.completed).length;
  const progress = (completedCount / requirements.length) * 100;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Progress to {nextLevel}</CardTitle>
        <CardDescription>Complete requirements to upgrade your KYC level</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Completion</span>
            <span className="text-muted-foreground">
              {completedCount} / {requirements.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Requirements Checklist */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Requirements</h4>
          <div className="space-y-2">
            {requirements.map((req) => (
              <div key={req.id} className="flex items-center gap-2 text-sm">
                {req.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={cn(req.completed && 'text-muted-foreground line-through')}>
                  {req.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Benefits */}
        <div className="pt-4 border-t space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Benefits of {nextLevel}
          </h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
