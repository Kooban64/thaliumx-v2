'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import { useKYC } from '@/lib/api/hooks/useKYC';
import { KYCLevel } from '@/stores/kycStore';
import { cn } from '@/lib/utils';

interface KYCUpgradePromptProps {
  onUpgradeClick?: () => void;
  className?: string;
  variant?: 'alert' | 'card';
}

/**
 * KYCUpgradePrompt - Prompts user to upgrade KYC level
 * Shows benefits and requirements for next level
 */
export function KYCUpgradePrompt({
  onUpgradeClick,
  className,
  variant = 'alert',
}: KYCUpgradePromptProps) {
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

  const getLevelBenefits = (targetLevel: KYCLevel) => {
    switch (targetLevel) {
      case 'L1':
        return {
          title: 'Upgrade to L1 - Basic Verification',
          description: 'Unlock trading access and higher limits',
          benefits: [
            'Enable trading functionality',
            'Higher transaction limits',
            'Increased daily transaction count',
            'Email + Phone verification only',
          ],
        };
      case 'L2':
        return {
          title: 'Upgrade to L2 - Identity Verified',
          description: 'Significantly higher limits and advanced features',
          benefits: [
            '5x higher transaction limits',
            'Advanced trading features',
            'Priority customer support',
            'Identity verification required',
          ],
        };
      case 'L3':
        return {
          title: 'Upgrade to L3 - Enhanced Verification',
          description: 'Maximum limits and institutional features',
          benefits: [
            'Maximum transaction limits',
            'Institutional-grade features',
            'Dedicated account manager',
            'Enhanced screening process',
          ],
        };
      case 'INSTITUTIONAL':
        return {
          title: 'Upgrade to Institutional',
          description: 'Enterprise-level limits and custom solutions',
          benefits: [
            'Enterprise-level limits',
            'Custom trading solutions',
            'White-glove service',
            'Business verification required',
          ],
        };
      default:
        return null;
    }
  };

  if (isLoading) {
    return null;
  }

  const nextLevel = getNextLevel(level);
  if (!nextLevel) {
    return null; // Already at max level
  }

  const benefits = getLevelBenefits(nextLevel);
  if (!benefits) {
    return null;
  }

  if (variant === 'alert') {
    return (
      <Alert className={cn('border-primary/50 bg-primary/5', className)}>
        <TrendingUp className="h-4 w-4" />
        <AlertTitle>{benefits.title}</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{benefits.description}</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {benefits.benefits.map((benefit, index) => (
              <li key={index}>{benefit}</li>
            ))}
          </ul>
          {onUpgradeClick && (
            <Button onClick={onUpgradeClick} className="mt-3" size="sm">
              Upgrade Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={cn('border-primary/50 bg-primary/5', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          {benefits.title}
        </CardTitle>
        <CardDescription>{benefits.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Benefits:</h4>
          <ul className="space-y-2">
            {benefits.benefits.map((benefit, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
        {onUpgradeClick && (
          <Button onClick={onUpgradeClick} className="w-full">
            Upgrade to {nextLevel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
