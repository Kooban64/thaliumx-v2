'use client';

import { cn } from '@/lib/utils';
import { designTokens } from '@/lib/theme/theme-tokens';

interface AppFrameProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AppFrame - Main application frame with Cursor IDE-inspired design
 * 
 * Features:
 * - Rounded corners (6-8px)
 * - Subtle border
 * - Shadow for depth
 * - Responsive width
 * - Centered container
 */
export function AppFrame({ children, className }: AppFrameProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
      <div
        className={cn(
          'w-full max-w-[1920px]',
          'rounded-lg', // 8px border radius
          'border border-border',
          'bg-card',
          'shadow-lg dark:shadow-[0_2px_8px_rgba(0,0,0,0.3)]',
          'overflow-hidden',
          'flex flex-col',
          'min-h-[calc(100vh-2rem)] md:min-h-[calc(100vh-3rem)]',
          className
        )}
        style={{
          borderRadius: designTokens.radius.lg,
        }}
      >
        {children}
      </div>
    </div>
  );
}
