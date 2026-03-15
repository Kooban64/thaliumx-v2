'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink, Heart, Github, FileText, HelpCircle, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api/client';
import { ChatWidget } from '@/components/support/ChatWidget';

interface HealthErrorShape {
  response?: {
    status?: number;
  };
}

interface SystemHealth {
  status?: string;
  services?: {
    api?: string;
    database?: string;
  };
  uptime?: number;
}

/**
 * AppFooter - Footer component with meaningful information
 * 
 * Features:
 * - Quick links
 * - System information
 * - Status indicators
 * - Version information
 * - Conditionally hides on public pages (uses PublicFooter instead)
 */
export function AppFooter() {
  const pathname = usePathname();
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);

  // Public pages use PublicFooter instead
  const publicPages = ['/landing', '/token-presale', '/login', '/register'];
  const isPublicPage = publicPages.some(page => pathname === page || pathname.startsWith(page));

  useEffect(() => {
    if (isPublicPage) {
      return;
    }

    const fetchHealth = async () => {
      try {
        // Only fetch health if user is authenticated (has token)
        const { getAuthToken } = await import('@/lib/auth/backend-auth');
        const token = getAuthToken();
        if (!token) {
          return; // No token, skip health check
        }

        const res = await apiClient.get<unknown>('/api/admin/health');
        if (res.success && res.data) {
          setSystemHealth(res.data);
        }
      } catch (error: unknown) {
        // Ignore 401 errors (user not authenticated)
        const typedError = error as HealthErrorShape;
        if (typedError.response?.status === 401) {
          return;
        }
        // Ignore other errors - health check is optional
      }
    };
    fetchHealth();
    // Refresh health every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [isPublicPage]);

  if (isPublicPage) {
    return null; // Public pages use their own layout with PublicFooter
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'ok':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case 'unhealthy':
      case 'error':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <AlertCircle className="h-3 w-3 text-yellow-500" />;
    }
  };

  return (
    <footer
      className={cn(
        'border-t border-border',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'px-4 md:px-6 lg:px-8 py-3 md:py-4',
        'text-xs text-muted-foreground',
        'mt-auto' // Push footer to bottom
      )}
    >
      <div className="max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Quick Links */}
        <div className="flex items-center gap-4 flex-wrap justify-center md:justify-start">
          <Link href="/support" className="hover:text-foreground transition-colors flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            <span>Support</span>
          </Link>
          <Link href="/docs" className="hover:text-foreground transition-colors flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>Docs</span>
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms
          </Link>
          <a
            href="https://github.com/thaliumx"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Github className="h-3 w-3" />
            <span>GitHub</span>
            <ExternalLink className="h-2 w-2" />
          </a>
          <ChatWidget />
        </div>

        {/* System Information */}
        <div className="flex items-center gap-4 flex-wrap justify-center md:justify-end">
          {systemHealth && (
            <>
              <div className="flex items-center gap-1">
                {getStatusIcon(systemHealth.status || 'unknown')}
                <span>API: {systemHealth.services?.api || 'unknown'}</span>
              </div>
              <div className="flex items-center gap-1">
                {getStatusIcon(systemHealth.services?.database || 'unknown')}
                <span>DB: {systemHealth.services?.database || 'unknown'}</span>
              </div>
                {typeof systemHealth.uptime === 'number' && (
                  <span>
                    Uptime: {Math.floor(systemHealth.uptime / 3600)}h{' '}
                    {Math.floor((systemHealth.uptime % 3600) / 60)}m
                </span>
              )}
            </>
          )}
          <span className="text-muted-foreground/70">
            v1.0.0 • Built with <Heart className="inline h-3 w-3 text-red-500" /> by ThaliumX
          </span>
        </div>
      </div>
      </div>
    </footer>
  );
}
