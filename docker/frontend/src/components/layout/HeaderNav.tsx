'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Home,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { checkAuth as checkBackendAuth, getCurrentUser } from '@/lib/auth/backend-auth';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { userNavConfig } from '@/config/nav/user-nav';
import { adminNavConfig } from '@/config/nav/admin-nav';
import { brokerNavConfig } from '@/config/nav/broker-nav';
import { useMenuFilter } from '@/components/navigation/hooks/useMenuFilter';
import { useActiveRoute } from '@/components/navigation/hooks/useActiveRoute';

import type { NavItem as ConfigNavItem } from '@/config/nav/types';

// Use the config NavItem type
type NavItem = ConfigNavItem;

/**
 * HeaderNav - Navigation menu in header with Cursor IDE-inspired design
 * Features:
 * - Horizontal menu items
 * - Dropdown menus for sub-items
 * - Keyboard navigation
 * - Active state indicators
 * - Role-based menu visibility
 */
export function HeaderNav() {
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navRef = useRef<HTMLDivElement>(null);
  const { filterItems } = useMenuFilter();
  const { isActive } = useActiveRoute();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const auth = await checkBackendAuth();
        setIsAuthenticated(auth);
        if (auth) {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);


  // Get menu items from config based on role and filter them
  const menuItems = useMemo(() => {
    if (!isAuthenticated || !user) {
      return [{ id: 'home', label: 'Home', href: '/', icon: Home }];
    }

    const role = user.role;
    let configItems: typeof userNavConfig.items;

    if (role === 'admin' || role === 'super_admin') {
      configItems = adminNavConfig.items;
    } else if (role?.startsWith('broker_')) {
      configItems = brokerNavConfig.items;
    } else {
      configItems = userNavConfig.items;
    }

    return filterItems(configItems);
  }, [isAuthenticated, user, filterItems]);
  // menuItems is now computed from useMemo above

  // Use the hook for active route detection
  const checkActive = (href?: string) => {
    return isActive(href);
  };

  const hasActiveChild = (item: NavItem): boolean => {
    if (!item.children) return false;
    return item.children.some(child => checkActive(child.href));
  };

  if (loading) {
    return null;
  }

  // Render a menu item (with optional dropdown)
  const renderMenuItem = (item: NavItem) => {
    const Icon = item.icon || Home;
    const active = checkActive(item.href) || hasActiveChild(item);
    const hasChildren = item.children && item.children.length > 0;

    if (hasChildren) {
      return (
        <DropdownMenu key={item.id || item.label}>
          <DropdownMenuTrigger>
            <button
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="min-w-[240px] p-1"
          >
            {item.children?.map((child) => {
              const childActive = checkActive(child.href);
              return (
                <DropdownMenuItem key={child.id || child.label}>
                  <Link
                    href={child.href || '#'}
                    className={cn(
                      'flex flex-col items-start gap-1 px-3 py-2 rounded-sm w-full',
                      childActive && 'bg-accent text-accent-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-sm font-medium">{child.label}</span>
                    </div>
                    {child.description && (
                      <span className="text-xs text-muted-foreground">{child.description}</span>
                    )}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Link
        key={item.id || item.label}
        href={item.href || '#'}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          active
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        )}
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
        {item.badge && (
          <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div ref={navRef} className="flex-1">
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1 px-4 overflow-x-auto">
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="h-8 w-8"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-popover border-b shadow-lg z-50 max-h-[calc(100vh-4rem)] overflow-y-auto">
            <nav className="flex flex-col p-2">
              {menuItems.map((item) => {
                const Icon = item.icon || Home;
                const active = checkActive(item.href) || hasActiveChild(item);
                const hasChildren = item.children && item.children.length > 0;

                if (hasChildren) {
                  return (
                    <div key={item.id || item.label} className="flex flex-col">
                      <div
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium',
                          active && 'bg-accent text-accent-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                      <div className="pl-7 flex flex-col">
                        {item.children?.map((child) => {
                          const childActive = checkActive(child.href);
                          return (
                            <Link
                              key={child.id || child.label}
                              href={child.href || '#'}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                'flex flex-col items-start gap-1 px-3 py-2 rounded-md text-sm',
                                childActive
                                  ? 'bg-accent text-accent-foreground'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                              )}
                            >
                              <span className="font-medium">{child.label}</span>
                              {child.description && (
                                <span className="text-xs text-muted-foreground">{child.description}</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.id || item.label}
                    href={item.href || '#'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
