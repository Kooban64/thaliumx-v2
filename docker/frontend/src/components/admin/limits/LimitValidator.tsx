'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useValidateLimits, type KYCLimits, type RoleLimits } from '@/lib/api/hooks/useLimits';
import { Loader2, CheckCircle, XCircle, AlertTriangle, TestTube } from 'lucide-react';

interface LimitValidatorProps {
  type: 'kyc' | 'role';
  target: string;
  limits: KYCLimits | RoleLimits;
}

interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  affectedUsers?: number;
}

/**
 * LimitValidator - Validate limit changes before saving
 */
export function LimitValidator({ type, target, limits }: LimitValidatorProps) {
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const validateMutation = useValidateLimits();

  const handleValidate = async () => {
    try {
      const result = await validateMutation.mutateAsync({
        type,
        target,
        limits,
      });
      setValidationResult(result as ValidationResult);
    } catch {
      setValidationResult({
        valid: false,
        errors: [error instanceof Error ? error.message : 'Validation failed'],
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Limit Validation
        </CardTitle>
        <CardDescription>
          Validate limit changes before applying them
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleValidate}
          disabled={validateMutation.isPending}
          className="w-full"
        >
          {validateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <TestTube className="h-4 w-4 mr-2" />
              Validate Limits
            </>
          )}
        </Button>

        {validationResult && (
          <div className="space-y-3">
            {/* Validation Status */}
            <Alert variant={validationResult.valid ? 'default' : 'destructive'}>
              <div className="flex items-center gap-2">
                {validationResult.valid ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {validationResult.valid ? 'Validation Passed' : 'Validation Failed'}
                </AlertTitle>
              </div>
              {validationResult.valid && (
                <AlertDescription>
                  All limit checks passed. You can safely save these changes.
                </AlertDescription>
              )}
            </Alert>

            {/* Errors */}
            {validationResult.errors && validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Errors</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warnings */}
            {validationResult.warnings && validationResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warnings</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Affected Users */}
            {validationResult.affectedUsers !== undefined && (
              <div className="flex items-center gap-2 p-3 bg-accent rounded-lg">
                <Badge variant="outline">
                  {validationResult.affectedUsers} user(s) will be affected
                </Badge>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
