'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface HeaderLogoProps {
  className?: string;
}

/**
 * HeaderLogo - Logo and branding component
 */
export function HeaderLogo({ className }: HeaderLogoProps) {
  return (
    <Link href="/" className={cn('flex items-center space-x-2 hover:opacity-80 transition-opacity', className)}>
      <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
        <span className="text-primary-foreground font-bold text-lg">T</span>
      </div>
      <span className="text-xl font-bold">ThaliumX</span>
    </Link>
  );
}
