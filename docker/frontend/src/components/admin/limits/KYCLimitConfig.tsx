'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKYCLimits, useUpdateKYCLimits, type KYCLimits } from '@/lib/api/hooks/useLimits';
import { Loader2, Shield } from 'lucide-react';
import { KYCLimitEditor } from './KYCLimitEditor';
import { logRuntimeError } from '@/lib/services/errorLogger';
import { toast } from '@/components/shared/Toast';

const KYC_LEVELS = ['L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL'] as const;

/**
 * KYCLimitConfig - Main KYC level limit configuration interface
 */
export function KYCLimitConfig() {
  const [selectedLevel, setSelectedLevel] = useState<string>('L0');
  const { data: limits, isLoading } = useKYCLimits();
  const updateMutation = useUpdateKYCLimits();

  const currentLimits = limits?.[selectedLevel] || {};

  const handleSave = async (updatedLimits: KYCLimits) => {
    try {
      await updateMutation.mutateAsync({
        level: selectedLevel,
        limits: updatedLimits,
      });
    } catch (error) {
      logRuntimeError(error, 'KYCLimitConfig', { action: 'updateKYCLimits', level: selectedLevel });
      toast({
        type: 'error',
        title: 'Failed to update limits',
        description: error instanceof Error ? error.message : 'Failed to update KYC limits',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">KYC Level Limit Configuration</h1>
        <p className="text-muted-foreground">
          Configure transaction limits for each KYC verification level
        </p>
      </div>

      {/* KYC Level Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Select KYC Level
          </CardTitle>
          <CardDescription>
            Choose a KYC level to configure its limits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {KYC_LEVELS.map((level) => (
              <Button
                key={level}
                variant={selectedLevel === level ? 'default' : 'outline'}
                onClick={() => setSelectedLevel(level)}
                className="min-w-[120px]"
              >
                {level}
                {level === 'INSTITUTIONAL' && (
                  <Badge variant="secondary" className="ml-2">
                    Premium
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Limit Editor */}
      {selectedLevel && (
        <KYCLimitEditor
          level={selectedLevel}
          limits={currentLimits}
          onSave={handleSave}
          isSaving={updateMutation.isPending}
        />
      )}
    </div>
  );
}
