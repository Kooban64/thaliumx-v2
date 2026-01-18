'use client';

import { usePathname } from 'next/navigation';
import { HeaderLogo } from './HeaderLogo';
import { HeaderNav } from './HeaderNav';
import { HeaderUserMenu } from './HeaderUserMenu';
import { ThemeToggle } from './ThemeToggle';
import { Search } from '@/components/navigation/Search';
import { defaultSearch } from '@/lib/search/defaultSearch';
import { cn } from '@/lib/utils';

/**
 * AppHeader - Main header component with Cursor IDE-inspired design
 * 
 * Features:
 * - Sticky header
 * - Logo/branding
 * - Navigation menu (all items)
 * - User menu
 * - Theme toggle
 * - Conditionally hides on public pages (uses PublicHeader instead)
 */
export function AppHeader() {
  const pathname = usePathname();
  
  // Public pages use PublicHeader instead
  const publicPages = ['/landing', '/token-presale', '/login', '/register'];
  const isPublicPage = publicPages.some(page => pathname === page || pathname.startsWith(page));
  
  if (isPublicPage) {
    return null; // Public pages use their own layout with PublicHeader
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-40',
        'h-14', // 56px height
        'border-b border-border',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'flex items-center justify-between',
        'px-4 md:px-6'
      )}
    >
      <HeaderLogo />
      <HeaderNav />
      <div className="flex items-center gap-2">
        <div className="hidden md:block w-64">
          <Search placeholder="Search..." defaultSearch={defaultSearch} />
        </div>
        <ThemeToggle />
        <HeaderUserMenu />
      </div>
    </header>
  );
}
