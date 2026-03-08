'use client';

import { Button } from '@/components/ui/button';
import { X, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import Image from 'next/image';

interface DocumentPreviewProps {
  file: File;
  onRemove?: () => void;
  onView?: () => void;
  className?: string;
}

/**
 * DocumentPreview - Preview component for uploaded documents
 * Shows file info and allows removal
 */
export function DocumentPreview({
  file,
  onRemove,
  onView,
  className,
}: DocumentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = () => {
    if (file.type.startsWith('image/')) {
      return '🖼️';
    }
    if (file.type === 'application/pdf') {
      return '📄';
    }
    return '📎';
  };

  const handleView = () => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      if (onView) {
        onView();
      } else {
        // Open in new window
        window.open(url, '_blank');
      }
    } else if (onView) {
      onView();
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 border rounded-lg bg-muted/50',
        className
      )}
    >
      <div className="flex-shrink-0 text-2xl">{getFileIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)} • {file.type || 'Unknown type'}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {file.type.startsWith('image/') && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleView}
            className="h-8 w-8"
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">Preview</span>
          </Button>
        )}
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Remove</span>
          </Button>
        )}
      </div>
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <Image
            src={previewUrl}
            alt={file.name}
            width={1200}
            height={1200}
            unoptimized
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
