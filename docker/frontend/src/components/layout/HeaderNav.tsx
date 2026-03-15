'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Home,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { checkAuth as checkBackendAuth, getCurrentUser } from '@/lib/auth/backend-auth';
import { useUserStore } from '@/stores/userStore';
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
import type { UserProfile } from '@/stores/userStore';

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
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const navRef = useRef<HTMLDivElement>(null);
  const { filterItems } = useMenuFilter();
  const { isActive } = useActiveRoute();
  const userStoreProfile = useUserStore((state) => state.profile);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // First check if user is in store (from post-login init)
        if (userStoreProfile) {
          setUser(userStoreProfile);
          setIsAuthenticated(true);
          setLoading(false);
          return;
        }

        // Fallback: check auth via API
        const auth = await checkBackendAuth();
        setIsAuthenticated(auth);
        if (auth) {
          try {
            const currentUser = await getCurrentUser();
            setUser(currentUser as UserProfile);
            // Sync with userStore
            if (currentUser) {
              useUserStore.getState().setProfile(currentUser);
            }
          } catch (userError) {
            // If getCurrentUser fails, still mark as authenticated but without user data
            console.warn('Failed to get current user:', userError);
            setIsAuthenticated(auth);
          }
        }
      } catch (error) {
        // Silently handle auth errors - don't throw, just set state
        console.warn('Auth check failed:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [userStoreProfile]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);


  // Get menu items from config based on role and filter them
  const menuItems = useMemo(() => {
    if (!isAuthenticated || !user) {
      return [{ id: 'home', label: 'Home', href: '/', icon: Home }];
    }

    // Use role from user object or fallback to userStore
    const role = user.role || userStoreProfile?.role;
    const normalizedRole = role?.toLowerCase().replace(/-/g, '_');
    if (!normalizedRole) {
      return [{ id: 'home', label: 'Home', href: '/', icon: Home }];
    }

    let configItems: typeof userNavConfig.items;

    if (normalizedRole === 'admin' || normalizedRole === 'super_admin' || normalizedRole === 'platform_admin' || normalizedRole === 'master_system_admin') {
      configItems = adminNavConfig.items;
    } else if (normalizedRole === 'broker_admin' || normalizedRole.startsWith('broker_')) {
      configItems = brokerNavConfig.items;
    } else {
      configItems = userNavConfig.items;
    }

    const filtered = filterItems(configItems);
    
    // For admin, group items into categories for better UX
    if (normalizedRole === 'admin' || normalizedRole === 'super_admin' || normalizedRole === 'platform_admin' || normalizedRole === 'master_system_admin') {
      // Group by item IDs to ensure correct categorization regardless of filtering
      const primaryIds = ['admin-home', 'admin-users', 'admin-brokers', 'admin-analytics'];
      const managementIds = ['admin-system', 'admin-rbac', 'admin-policies'];
      const operationsIds = ['admin-finance', 'admin-security', 'admin-compliance', 'admin-workflows'];
      const configurationIds = ['admin-limits'];
      
      const primaryItems = filtered.filter(item => primaryIds.includes(item.id || ''));
      const managementItems = filtered.filter(item => managementIds.includes(item.id || ''));
      const operationsItems = filtered.filter(item => operationsIds.includes(item.id || ''));
      const configurationItems = filtered.filter(item => configurationIds.includes(item.id || ''));
      
      return {
        primary: primaryItems,
        management: managementItems,
        operations: operationsItems,
        configuration: configurationItems,
      };
    }
    
    return filtered;
  }, [isAuthenticated, user, userStoreProfile, filterItems]);

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
    const itemId = item.id || item.label;

    if (hasChildren) {
      return (
        <DropdownMenu key={itemId}>
          {/* Parent item - clickable link if href exists, otherwise just dropdown trigger */}
          <div className="relative group flex items-center">
            {item.href && item.href !== '#' ? (
              <>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    'flex-1',
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(item.href!);
                    }
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
                {/* Dropdown toggle button - appears on hover/focus */}
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'px-1 py-2 flex items-center justify-center',
                      'opacity-0 group-hover:opacity-100 transition-opacity',
                      'focus:opacity-100 focus:outline-none',
                      'hover:bg-accent/50 rounded-r-md'
                    )}
                    aria-label={`Open ${item.label} menu`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                      }
                    }}
                  >
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
              </>
            ) : (
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                    }
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </button>
              </DropdownMenuTrigger>
            )}
          </div>
          <DropdownMenuContent
            align="start"
            className="min-w-[240px] p-1"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
              }
            }}
          >
            {/* Add "Go to [Page]" option at top of dropdown if parent has href */}
            {item.href && item.href !== '#' && (
              <>
                <DropdownMenuItem
                  onClick={() => {
                    router.push(item.href!);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(item.href!);
                    }
                  }}
                  className="font-medium cursor-pointer"
                >
                  <div className="flex items-center gap-2 w-full">
                    <Icon className="h-4 w-4" />
                    <span>Go to {item.label}</span>
                  </div>
                </DropdownMenuItem>
                <div className="h-px bg-border my-1" />
              </>
            )}
            {item.children?.map((child) => {
              const childActive = checkActive(child.href);
              return (
                <DropdownMenuItem
                  key={child.id || child.label}
                  onClick={() => {
                    if (child.href && child.href !== '#') {
                      router.push(child.href);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (child.href && child.href !== '#') {
                        router.push(child.href);
                      }
                    }
                  }}
                  className={cn(
                    'cursor-pointer',
                    childActive && 'bg-accent text-accent-foreground'
                  )}
                >
                  <div className="flex flex-col items-start gap-1 w-full">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-sm font-medium">{child.label}</span>
                    </div>
                    {child.description && (
                      <span className="text-xs text-muted-foreground">{child.description}</span>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Link
        key={itemId}
        href={item.href || '#'}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          active
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (item.href && item.href !== '#') {
              router.push(item.href);
            }
          }
        }}
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

  // Check if menuItems is grouped (admin) or flat (other roles)
  const isGrouped = menuItems && typeof menuItems === 'object' && 'primary' in menuItems;
  const flatItems = isGrouped ? null : (menuItems as NavItem[]);
  const groupedItems = isGrouped ? (menuItems as { primary: NavItem[]; management: NavItem[]; operations: NavItem[]; configuration: NavItem[] }) : null;

  return (
    <div ref={navRef} className="flex-1 min-w-0">
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1.5 md:gap-2 px-2 md:px-4 overflow-x-auto scrollbar-hide">
        {isGrouped && groupedItems ? (
          <>
            {/* Primary items - always visible */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {groupedItems.primary.map((item) => renderMenuItem(item))}
            </div>
            {/* Management group */}
            {groupedItems.management.length > 0 && (
              <>
                <div className="h-6 w-px bg-border mx-0.5 md:mx-1 flex-shrink-0" />
                <div className="flex items-center gap-1 flex-shrink-0">
                  {groupedItems.management.map((item) => renderMenuItem(item))}
                </div>
              </>
            )}
            {/* Operations group */}
            {groupedItems.operations.length > 0 && (
              <>
                <div className="h-6 w-px bg-border mx-0.5 md:mx-1 flex-shrink-0" />
                <div className="flex items-center gap-1 flex-shrink-0">
                  {groupedItems.operations.map((item) => renderMenuItem(item))}
                </div>
              </>
            )}
            {/* Configuration group */}
            {groupedItems.configuration.length > 0 && (
              <>
                <div className="h-6 w-px bg-border mx-0.5 md:mx-1 flex-shrink-0" />
                <div className="flex items-center gap-1 flex-shrink-0">
                  {groupedItems.configuration.map((item) => renderMenuItem(item))}
                </div>
              </>
            )}
          </>
        ) : (
          flatItems?.map((item) => renderMenuItem(item))
        )}
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden relative">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="h-8 w-8"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && mobileMenuOpen) {
              setMobileMenuOpen(false);
            }
          }}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        {mobileMenuOpen && (
          <div className="fixed md:hidden top-14 left-0 right-0 bg-popover border-b shadow-lg z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto scrollbar-hide">
            <nav className="flex flex-col p-2 gap-1">
              {(isGrouped && groupedItems
                ? [
                    ...groupedItems.primary,
                    ...groupedItems.management,
                    ...groupedItems.operations,
                    ...groupedItems.configuration,
                  ]
                : flatItems || []
              ).map((item) => {
                const Icon = item.icon || Home;
                const active = checkActive(item.href) || hasActiveChild(item);
                const hasChildren = item.children && item.children.length > 0;

                if (hasChildren) {
                  return (
                    <div key={item.id || item.label} className="flex flex-col gap-1">
                      <Link
                        href={item.href || '#'}
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (item.href && item.href !== '#') {
                            router.push(item.href);
                          }
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && item.href && item.href !== '#') {
                            e.preventDefault();
                            setMobileMenuOpen(false);
                            router.push(item.href);
                          }
                        }}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                          active && 'bg-accent text-accent-foreground',
                          !active && 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                      <div className="pl-7 flex flex-col gap-0.5">
                        {item.children?.map((child) => {
                          const childActive = checkActive(child.href);
                          return (
                            <Link
                              key={child.id || child.label}
                              href={child.href || '#'}
                              onClick={() => {
                                setMobileMenuOpen(false);
                                if (child.href && child.href !== '#') {
                                  router.push(child.href);
                                }
                              }}
                              onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && child.href && child.href !== '#') {
                                  e.preventDefault();
                                  setMobileMenuOpen(false);
                                  router.push(child.href);
                                }
                              }}
                              className={cn(
                                'flex flex-col items-start gap-1 px-3 py-2 rounded-md text-sm transition-colors',
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
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (item.href && item.href !== '#') {
                        router.push(item.href);
                      }
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && item.href && item.href !== '#') {
                        e.preventDefault();
                        setMobileMenuOpen(false);
                        router.push(item.href);
                      }
                    }}
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
