'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * PublicAuthMenu - Simple auth menu for public pages
 * Does NOT make any API calls to avoid 401 errors
 * Just shows Sign In / Sign Up buttons
 */
export function PublicAuthMenu() {
  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/login">Sign In</Link>
      </Button>
      <Button size="sm" asChild>
        <Link href="/register">Sign Up</Link>
      </Button>
    </div>
  );
}
