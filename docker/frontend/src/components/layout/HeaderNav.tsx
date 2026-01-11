'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BarChart3,
  Wallet,
  DollarSign,
  Activity,
  HelpCircle,
  Settings,
  Users,
  Shield,
  FileText,
  TrendingUp,
  Building2,
  Key,
  Workflow,
  Gauge,
  CreditCard,
  AlertTriangle,
  LineChart,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { checkAuth as checkBackendAuth, getCurrentUser } from '@/lib/auth/backend-auth';

interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  children?: NavItem[];
}

/**
 * HeaderNav - Navigation menu in header
 * Shows different menu items based on user role
 */
export function HeaderNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const auth = await checkBackendAuth();
        setIsAuthenticated(auth);
        if (auth) {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // User Dashboard Menu Items
  const userMenuItems: NavItem[] = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Trading', href: '/dashboard', icon: BarChart3 },
    { label: 'Wallet', href: '/wallet', icon: Wallet },
    { label: 'Portfolio', href: '/portfolio', icon: DollarSign },
    { label: 'Presale', href: '/token-presale', icon: TrendingUp },
    { label: 'Staking', href: '/staking', icon: Activity },
    { label: 'NFT', href: '/nft', icon: FileText },
    { label: 'DEX', href: '/dex', icon: BarChart3 },
    { label: 'Market Data', href: '/market', icon: LineChart },
    { label: 'Account', href: '/dashboard/account', icon: Settings },
    { label: 'Support', href: '/support', icon: HelpCircle },
  ];

  // Admin Dashboard Menu Items
  const adminMenuItems: NavItem[] = [
    { label: 'Home', href: '/admin', icon: Home },
    { label: 'System', href: '/admin/system', icon: Gauge },
    { label: 'Users', href: '/admin/users', icon: Users },
    { label: 'Brokers', href: '/admin/brokers', icon: Building2 },
    { label: 'RBAC', href: '/admin/rbac', icon: Key },
    { label: 'Policies', href: '/admin/policies', icon: Shield },
    { label: 'Workflows', href: '/admin/workflows', icon: Workflow },
    { label: 'Compliance', href: '/admin/compliance', icon: FileText },
    { label: 'Finance', href: '/admin/finance', icon: CreditCard },
    { label: 'Security', href: '/admin/security', icon: AlertTriangle },
    { label: 'Analytics', href: '/admin/analytics', icon: LineChart },
    { label: 'Limits', href: '/admin/limits', icon: Activity },
  ];

  // Broker Dashboard Menu Items
  const brokerMenuItems: NavItem[] = [
    { label: 'Home', href: '/broker', icon: Home },
    { label: 'Users', href: '/broker/users', icon: Users },
    { label: 'Trading', href: '/broker/trading', icon: BarChart3 },
    { label: 'Finance', href: '/broker/finance', icon: CreditCard },
    { label: 'Compliance', href: '/broker/compliance', icon: Shield },
    { label: 'Settings', href: '/broker/settings', icon: Settings },
    { label: 'Analytics', href: '/broker/analytics', icon: LineChart },
  ];

  // Determine which menu items to show
  const getMenuItems = (): NavItem[] => {
    if (!isAuthenticated || !user) {
      return [{ label: 'Home', href: '/', icon: Home }];
    }

    const role = user.role;
    if (role === 'admin' || role === 'super_admin') {
      return adminMenuItems;
    }
    if (role === 'broker_admin' || role === 'broker_compliance' || role === 'broker_finance') {
      return brokerMenuItems;
    }
    return userMenuItems;
  };

  const menuItems = getMenuItems();

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  if (loading) {
    return null;
  }

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-1 flex-1 px-4">
        {menuItems.map((item) => {
          const Icon = item.icon || Home;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
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
        })}
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
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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
    </>
  );
}
