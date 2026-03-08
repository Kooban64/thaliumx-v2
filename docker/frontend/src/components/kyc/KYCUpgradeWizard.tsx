'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle2, ArrowRight, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { useKYC } from '@/lib/api/hooks/useKYC';
import { KYCLevel } from '@/stores/kycStore';
import { KYCDocumentUpload } from './KYCDocumentUpload';

interface KYCUpgradeWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
  initialTargetLevel?: KYCLevel;
  className?: string;
}

type WizardStep = 'select' | 'requirements' | 'documents' | 'review' | 'submitting' | 'success' | 'error';

/**
 * KYCUpgradeWizard - Multi-step wizard for KYC upgrades
 * Handles the complete upgrade flow from level selection to submission
 */
export function KYCUpgradeWizard({
  onComplete,
  onCancel,
  initialTargetLevel,
  className,
}: KYCUpgradeWizardProps) {
  const { level, upgrade, isUpgrading } = useKYC();
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    initialTargetLevel ? 'requirements' : 'select'
  );
  const [targetLevel, setTargetLevel] = useState<KYCLevel | null>(initialTargetLevel || null);
  const [documents, setDocuments] = useState<Record<string, File[]>>({});
  const [error, setError] = useState<string | null>(null);

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
        return {
          title: 'L1 - Basic Verification',
          description: 'Email + Phone verification required',
          documents: [],
          checks: ['Email Verification', 'Phone Verification', 'Sanctions Check'],
        };
      case 'L2':
        return {
          title: 'L2 - Identity Verified',
          description: 'Government ID and proof of address required',
          documents: ['NATIONAL_ID', 'PROOF_OF_ADDRESS', 'BIOMETRIC_DATA'],
          checks: ['Sanctions Check', 'PEP Check', 'Face Verification'],
        };
      case 'L3':
        return {
          title: 'L3 - Enhanced Verification',
          description: 'Enhanced screening and source of funds required',
          documents: ['PASSPORT', 'PROOF_OF_ADDRESS', 'PROOF_OF_INCOME', 'SOURCE_OF_FUNDS', 'BIOMETRIC_DATA'],
          checks: ['Enhanced Screening', 'Source of Funds Verification'],
        };
      case 'INSTITUTIONAL':
        return {
          title: 'Institutional Verification',
          description: 'Business documents and regulatory licenses required',
          documents: [
            'BUSINESS_LICENSE',
            'ARTICLES_OF_INCORPORATION',
            'CERTIFICATE_OF_INCORPORATION',
            'BANK_STATEMENT',
            'PROOF_OF_ADDRESS',
          ],
          checks: ['Business Verification', 'Ownership Structure', 'Regulatory Compliance'],
        };
      default:
        return { title: '', description: '', documents: [], checks: [] };
    }
  };

  const getStepProgress = (): number => {
    switch (currentStep) {
      case 'select':
        return 25;
      case 'requirements':
        return 50;
      case 'documents':
        return 75;
      case 'review':
        return 90;
      case 'submitting':
      case 'success':
      case 'error':
        return 100;
      default:
        return 0;
    }
  };

  const handleLevelSelect = (selectedLevel: KYCLevel) => {
    setTargetLevel(selectedLevel);
    setCurrentStep('requirements');
    setError(null);
  };

  const handleDocumentsComplete = (uploadedDocs: Record<string, File[]>) => {
    setDocuments(uploadedDocs);
    setCurrentStep('review');
  };

  const handleSubmit = async () => {
    if (!targetLevel) return;

    setCurrentStep('submitting');
    setError(null);

    try {
      await upgrade(targetLevel);
      setCurrentStep('success');
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit upgrade request');
      setCurrentStep('error');
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case 'requirements':
        setCurrentStep('select');
        break;
      case 'documents':
        setCurrentStep('requirements');
        break;
      case 'review':
        setCurrentStep('documents');
        break;
      case 'error':
        setCurrentStep('review');
        break;
    }
  };

  const nextLevel = getNextLevel(level);
  const requirements = targetLevel ? getLevelRequirements(targetLevel) : null;

  // Step 1: Select Level
  if (currentStep === 'select') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Upgrade KYC Level
          </CardTitle>
          <CardDescription>Select the level you want to upgrade to</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={getStepProgress()} className="h-2" />
          <div className="grid gap-4">
            {nextLevel && (
              <Card
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleLevelSelect(nextLevel)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{getLevelRequirements(nextLevel).title}</CardTitle>
                  <CardDescription>{getLevelRequirements(nextLevel).description}</CardDescription>
                </CardHeader>
              </Card>
            )}
            {level !== 'L3' && level !== 'INSTITUTIONAL' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You can only upgrade to the next level. Complete {nextLevel} first before upgrading further.
                </AlertDescription>
              </Alert>
            )}
          </div>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="w-full">
              Cancel
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  // Step 2: Requirements
  if (currentStep === 'requirements' && targetLevel && requirements) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Requirements for {requirements.title}</CardTitle>
          <CardDescription>Review what&apos;s needed to upgrade</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={getStepProgress()} className="h-2" />

          <div className="space-y-4">
            {requirements.checks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Verification Checks</h4>
                <ul className="space-y-2">
                  {requirements.checks.map((check, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {requirements.documents.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Required Documents</h4>
                <ul className="space-y-2">
                  {requirements.documents.map((doc, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Badge variant="outline">{doc.replace(/_/g, ' ')}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={() => setCurrentStep('documents')}
              className="flex-1"
              disabled={requirements.documents.length === 0}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 3: Document Upload
  if (currentStep === 'documents' && targetLevel && requirements) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
          <CardDescription>Upload required documents for {requirements.title}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={getStepProgress()} className="h-2" />
          <KYCDocumentUpload
            requiredDocuments={requirements.documents}
            onComplete={handleDocumentsComplete}
            onBack={handleBack}
          />
        </CardContent>
      </Card>
    );
  }

  // Step 4: Review
  if (currentStep === 'review' && targetLevel && requirements) {
    const documentCount = Object.values(documents).flat().length;
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Review & Submit</CardTitle>
          <CardDescription>Review your upgrade request before submitting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={getStepProgress()} className="h-2" />

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">Upgrading to</h4>
              <Badge variant="default" className="text-lg px-3 py-1">
                {requirements.title}
              </Badge>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Documents Uploaded</h4>
              <p className="text-sm text-muted-foreground">
                {documentCount} document{documentCount !== 1 ? 's' : ''} ready for submission
              </p>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your documents will be reviewed by our compliance team. This process typically takes 1-3 business days.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSubmit} className="flex-1" disabled={isUpgrading}>
              {isUpgrading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Upgrade Request
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Step 5: Submitting
  if (currentStep === 'submitting') {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground">Submitting your upgrade request...</p>
        </CardContent>
      </Card>
    );
  }

  // Step 6: Success
  if (currentStep === 'success') {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="h-12 w-12 text-green-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Upgrade Request Submitted</h3>
          <p className="text-sm text-muted-foreground text-center">
            Your KYC upgrade request has been submitted successfully. You&apos;ll be notified once the review is complete.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Step 7: Error
  if (currentStep === 'error') {
    return (
      <Card className={className}>
        <CardContent className="space-y-4 py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error || 'An error occurred while submitting your request'}</AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button onClick={handleSubmit} className="flex-1">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
