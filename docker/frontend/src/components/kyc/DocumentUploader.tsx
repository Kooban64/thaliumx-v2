'use client';

import { useCallback, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateDocument } from './DocumentValidator';

interface DocumentUploaderProps {
  documentType: string;
  onUpload: (files: File[]) => void;
  acceptedFormats?: string[];
  maxSize?: number; // in bytes
  multiple?: boolean;
  className?: string;
}

/**
 * DocumentUploader - File upload component with drag and drop
 * Supports multiple files and validation
 */
export function DocumentUploader({
  documentType,
  onUpload,
  acceptedFormats = ['image/*', 'application/pdf'],
  maxSize = 10 * 1024 * 1024, // 10MB default
  multiple = true,
  className,
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      setError(null);
      setIsUploading(true);

      try {
        // Validate all files
        const validationResults = await Promise.all(
          fileArray.map((file) => validateDocument(file, acceptedFormats, maxSize))
        );

        const invalidFiles = validationResults.filter((result) => !result.valid);
        if (invalidFiles.length > 0) {
          setError(invalidFiles.map((r) => r.error).join(', '));
          setIsUploading(false);
          return;
        }

        // Upload valid files
        onUpload(fileArray);
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to process files');
      } finally {
        setIsUploading(false);
      }
    },
    [onUpload, acceptedFormats, maxSize]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          error && 'border-red-500 bg-red-50'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          id={`file-upload-${documentType}`}
          className="hidden"
          accept={acceptedFormats.join(',')}
          multiple={multiple}
          onChange={handleFileInput}
          disabled={isUploading}
        />
        <label
          htmlFor={`file-upload-${documentType}`}
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Processing files...</span>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  {acceptedFormats.join(', ')} (max {Math.round(maxSize / 1024 / 1024)}MB)
                </p>
              </div>
            </>
          )}
        </label>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}
    </div>
  );
}
