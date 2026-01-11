'use client';

import { useState, useEffect } from 'react';
import { User, LogOut, Settings, Bell, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { checkAuth as checkBackendAuth, getCurrentUser, logout as logoutBackend } from '@/lib/auth/backend-auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * HeaderUserMenu - User menu in header
 */
export function HeaderUserMenu() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
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

  const handleLogout = async () => {
    await logoutBackend();
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled>
        <User className="h-4 w-4" />
      </Button>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <a href="/login">Sign In</a>
        </Button>
        <Button size="sm" asChild>
          <a href="/register">Sign Up</a>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-xs font-medium">
              {user?.firstName?.[0] || user?.email?.[0] || 'U'}
            </span>
          </div>
          <span className="hidden md:inline text-sm">
            {user?.firstName || user?.email || 'User'}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 border-b">
          <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <DropdownMenuItem>
          <a href="/dashboard/account" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <a href="/dashboard/account" className="flex items-center">
            <Bell className="mr-2 h-4 w-4" />
            <span>Notifications</span>
          </a>
        </DropdownMenuItem>
        <div className="border-t my-1" />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
