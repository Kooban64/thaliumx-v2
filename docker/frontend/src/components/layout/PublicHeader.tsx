'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Coins, TrendingUp, Info, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeaderLogo } from './HeaderLogo';
import { PublicAuthMenu } from './PublicAuthMenu';
import { cn } from '@/lib/utils';

/**
 * PublicHeader - Header for public pages (landing, token presale)
 * 
 * Features:
 * - Logo linking to landing page
 * - Crypto-focused navigation menu
 * - Sign In / Sign Up buttons (no profile dropdown)
 * - Mobile responsive menu
 * - No authentication checks that cause 401 errors
 */
export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Home', href: '/landing', icon: null },
    { label: 'Features', href: '/landing#features', icon: TrendingUp },
    { label: 'Token Presale', href: '/token-presale', icon: Coins },
    { label: 'About', href: '/landing#about', icon: Info },
    { label: 'Contact', href: '/landing#contact', icon: Mail },
  ];

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
      {/* Logo */}
      <HeaderLogo publicOnly={true} />

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-6">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            {item.icon && <item.icon className="h-4 w-4" />}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Right side: Auth buttons */}
      <div className="flex items-center gap-2">
        {/* Desktop: Show simple auth menu (no API calls) */}
        <div className="hidden md:block">
          <PublicAuthMenu />
        </div>

        {/* Mobile: Menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="absolute top-14 left-0 right-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
          <nav className="flex flex-col px-4 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </Link>
            ))}
            <div className="border-t border-border my-2 pt-2">
              <PublicAuthMenu />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
