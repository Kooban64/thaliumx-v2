'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentListProps {
  documents: Record<string, File[]>;
  requiredDocuments: string[];
  className?: string;
}

/**
 * DocumentList - Lists all required and uploaded documents
 * Shows completion status for each document type
 */
export function DocumentList({
  documents,
  requiredDocuments,
  className,
}: DocumentListProps) {
  const getDocumentLabel = (docType: string): string => {
    return docType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const isDocumentUploaded = (docType: string): boolean => {
    return !!(documents[docType] && documents[docType].length > 0);
  };

  const getDocumentCount = (docType: string): number => {
    return documents[docType]?.length || 0;
  };

  if (requiredDocuments.length === 0) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Document Checklist</CardTitle>
        <CardDescription>
          {requiredDocuments.filter((doc) => isDocumentUploaded(doc)).length} of{' '}
          {requiredDocuments.length} documents uploaded
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {requiredDocuments.map((docType) => {
            const uploaded = isDocumentUploaded(docType);
            const count = getDocumentCount(docType);

            return (
              <div
                key={docType}
                className={cn(
                  'flex items-center justify-between p-2 rounded border',
                  uploaded && 'bg-green-50 border-green-200'
                )}
              >
                <div className="flex items-center gap-2">
                  {uploaded ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={cn('text-sm', uploaded && 'font-medium')}>
                    {getDocumentLabel(docType)}
                  </span>
                </div>
                {uploaded && (
                  <Badge variant="outline" className="bg-green-100 border-green-300">
                    {count} file{count !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
