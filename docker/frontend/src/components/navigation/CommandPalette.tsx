'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes/config';
import { useUserStore } from '@/stores/userStore';

interface CommandItem {
  id: string;
  label: string;
  href?: string;
  description?: string;
  category: string;
  icon?: React.ComponentType<{ className?: string }>;
  keywords?: string[];
  action?: () => void;
}

/**
 * CommandPalette - Cmd+K command palette for quick navigation
 * Cursor IDE-inspired design
 */
export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { profile } = useUserStore();
  
  // Ensure profile exists
  if (!profile) {
    return null;
  }

  // Generate command items based on routes and user role
  const commandItems: CommandItem[] = [
    // Navigation
    { id: 'nav-home', label: 'Go to Home', href: '/', category: 'Navigation', keywords: ['home', 'dashboard'] },
    { id: 'nav-dashboard', label: 'Go to Dashboard', href: routes.dashboard.home, category: 'Navigation', keywords: ['dashboard', 'main'] },
    { id: 'nav-trading', label: 'Go to Trading', href: routes.dashboard.trading, category: 'Navigation', keywords: ['trading', 'trade'] },
    { id: 'nav-wallet', label: 'Go to Wallet', href: routes.dashboard.wallet, category: 'Navigation', keywords: ['wallet', 'funds'] },
    { id: 'nav-portfolio', label: 'Go to Portfolio', href: routes.dashboard.portfolio, category: 'Navigation', keywords: ['portfolio', 'holdings'] },
    { id: 'nav-account', label: 'Go to Account', href: routes.dashboard.account, category: 'Navigation', keywords: ['account', 'settings', 'profile'] },
    
    // Admin commands (if admin)
    ...(profile && (profile.role === 'admin' || profile.role === 'super_admin')
      ? [
          { id: 'admin-home', label: 'Go to Admin Dashboard', href: routes.admin.home, category: 'Admin', keywords: ['admin', 'dashboard'] },
          { id: 'admin-users', label: 'Manage Users', href: routes.admin.users, category: 'Admin', keywords: ['users', 'manage'] },
          { id: 'admin-brokers', label: 'Manage Brokers', href: routes.admin.brokers, category: 'Admin', keywords: ['brokers', 'manage'] },
          { id: 'admin-system', label: 'System Management', href: routes.admin.system, category: 'Admin', keywords: ['system', 'health'] },
        ]
      : []),
    
    // Broker commands (if broker)
    ...(profile && profile.role?.startsWith('broker_')
      ? [
          { id: 'broker-home', label: 'Go to Broker Dashboard', href: routes.broker.home, category: 'Broker', keywords: ['broker', 'dashboard'] },
          { id: 'broker-users', label: 'Manage Broker Users', href: routes.broker.users, category: 'Broker', keywords: ['users', 'manage'] },
        ]
      : []),
  ];

  // Filter items based on query
  const filteredItems = query
    ? commandItems.filter((item) => {
        const searchText = `${item.label} ${item.description || ''} ${item.keywords?.join(' ') || ''}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      })
    : commandItems;

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Open with Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(0);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        handleSelect(filteredItems[selectedIndex]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (item: CommandItem) => {
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(0);
  };

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
        onClick={() => {
          setIsOpen(false);
          setQuery('');
          setSelectedIndex(0);
        }}
      />

      {/* Command Palette */}
      <div className="fixed left-1/2 top-20 z-50 w-full max-w-2xl -translate-x-1/2">
        <div className="rounded-lg border bg-popover shadow-lg">
          {/* Search Input */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {filteredItems.length > 0 ? (
              <div className="space-y-4">
                {Object.entries(groupedItems).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      {category}
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const isSelected = currentIndex === selectedIndex;
                        currentIndex++;
                        const Icon = item.icon || ArrowRight;

                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className={cn(
                              'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                              'hover:bg-accent hover:text-accent-foreground',
                              isSelected && 'bg-accent text-accent-foreground'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <div className="font-medium">{item.label}</div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground">
                                    {item.description}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
                                  ↵
                                </kbd>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No commands found
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                    ↑↓
                  </kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                    ↵
                  </kbd>
                  <span>Select</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ESC
                </kbd>
                <span>Close</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
