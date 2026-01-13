'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentUploader } from './DocumentUploader';
import { DocumentPreview } from './DocumentPreview';
import { DocumentList } from './DocumentList';

interface KYCDocumentUploadProps {
  requiredDocuments: string[];
  onComplete: (documents: Record<string, File[]>) => void;
  onBack?: () => void;
  className?: string;
}

/**
 * KYCDocumentUpload - Document upload interface for KYC upgrades
 * Handles multiple document types and file uploads
 */
export function KYCDocumentUpload({
  requiredDocuments,
  onComplete,
  onBack,
  className,
}: KYCDocumentUploadProps) {
  const [documents, setDocuments] = useState<Record<string, File[]>>({});
  const [currentDocumentType, setCurrentDocumentType] = useState<string | null>(
    requiredDocuments[0] || null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDocumentUpload = useCallback(
    (documentType: string, files: File[]) => {
      setDocuments((prev) => ({
        ...prev,
        [documentType]: files,
      }));
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[documentType];
        return newErrors;
      });
    },
    []
  );

  const handleDocumentRemove = useCallback((documentType: string, fileIndex: number) => {
    setDocuments((prev) => {
      const files = prev[documentType] || [];
      const newFiles = files.filter((_, index) => index !== fileIndex);
      if (newFiles.length === 0) {
        const { [documentType]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [documentType]: newFiles };
    });
  }, []);

  const handleNext = () => {
    if (!currentDocumentType) return;
    const currentIndex = requiredDocuments.indexOf(currentDocumentType);
    if (currentIndex < requiredDocuments.length - 1) {
      const nextDoc = requiredDocuments[currentIndex + 1];
      if (nextDoc) {
        setCurrentDocumentType(nextDoc);
      }
    }
  };

  const handlePrevious = () => {
    if (!currentDocumentType) return;
    const currentIndex = requiredDocuments.indexOf(currentDocumentType);
    if (currentIndex > 0) {
      const prevDoc = requiredDocuments[currentIndex - 1];
      if (prevDoc) {
        setCurrentDocumentType(prevDoc);
      }
    }
  };

  const handleComplete = () => {
    // Validate all required documents are uploaded
    const missing = requiredDocuments.filter((doc) => !documents[doc] || documents[doc].length === 0);
    if (missing.length > 0) {
      const newErrors: Record<string, string> = {};
      missing.forEach((doc) => {
        newErrors[doc] = 'This document is required';
      });
      setErrors(newErrors);
      // Go to first missing document
      if (missing[0]) {
        setCurrentDocumentType(missing[0]);
      }
      return;
    }
    onComplete(documents);
  };

  const getDocumentLabel = (docType: string): string => {
    return docType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getDocumentDescription = (docType: string): string => {
    switch (docType) {
      case 'NATIONAL_ID':
        return 'Government-issued ID card or driver\'s license';
      case 'PROOF_OF_ADDRESS':
        return 'Utility bill, bank statement, or government document (less than 3 months old)';
      case 'BIOMETRIC_DATA':
        return 'Selfie or photo for face verification';
      case 'PASSPORT':
        return 'Valid passport with photo page';
      case 'PROOF_OF_INCOME':
        return 'Salary slip, tax return, or bank statement showing income';
      case 'SOURCE_OF_FUNDS':
        return 'Document explaining the source of your funds';
      case 'BUSINESS_LICENSE':
        return 'Valid business license or registration certificate';
      case 'ARTICLES_OF_INCORPORATION':
        return 'Articles of incorporation document';
      case 'CERTIFICATE_OF_INCORPORATION':
        return 'Certificate of incorporation';
      case 'BANK_STATEMENT':
        return 'Recent bank statement (last 3 months)';
      default:
        return 'Please upload the required document';
    }
  };

  const allDocumentsUploaded = requiredDocuments.every(
    (doc) => documents[doc] && documents[doc].length > 0
  );
  const currentIndex = currentDocumentType ? requiredDocuments.indexOf(currentDocumentType) : -1;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Progress Indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Document {currentIndex + 1} of {requiredDocuments.length}
          </span>
          <span className="font-medium">
            {requiredDocuments.filter((doc) => documents[doc] && documents[doc].length > 0).length} /{' '}
            {requiredDocuments.length} completed
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${((currentIndex + 1) / requiredDocuments.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Current Document Upload */}
      {currentDocumentType && (
        <Card>
          <CardHeader>
            <CardTitle>{getDocumentLabel(currentDocumentType)}</CardTitle>
            <CardDescription>{getDocumentDescription(currentDocumentType)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errors[currentDocumentType] && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors[currentDocumentType]}</AlertDescription>
              </Alert>
            )}

            <DocumentUploader
              documentType={currentDocumentType}
              onUpload={(files) => handleDocumentUpload(currentDocumentType, files)}
              acceptedFormats={['image/*', 'application/pdf']}
              maxSize={10 * 1024 * 1024} // 10MB
            />

            {documents[currentDocumentType] && documents[currentDocumentType].length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Uploaded Files</h4>
                {documents[currentDocumentType].map((file, index) => (
                  <DocumentPreview
                    key={index}
                    file={file}
                    onRemove={() => handleDocumentRemove(currentDocumentType, index)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document List Summary */}
      <DocumentList documents={documents} requiredDocuments={requiredDocuments} />

      {/* Navigation */}
      <div className="flex gap-2">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}
        {currentIndex > 0 && (
          <Button variant="outline" onClick={handlePrevious} className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
        )}
        {currentIndex < requiredDocuments.length - 1 ? (
          <Button onClick={handleNext} className="flex-1">
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleComplete} className="flex-1" disabled={!allDocumentsUploaded}>
            {allDocumentsUploaded ? (
              <>
                Complete
                <CheckCircle2 className="ml-2 h-4 w-4" />
              </>
            ) : (
              'Complete Uploads First'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
