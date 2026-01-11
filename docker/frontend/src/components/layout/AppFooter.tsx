'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ExternalLink, Heart, Github, FileText, HelpCircle, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import apiClient from '@/lib/api/client';

/**
 * AppFooter - Footer component with meaningful information
 * 
 * Features:
 * - Quick links
 * - System information
 * - Status indicators
 * - Version information
 */
export function AppFooter() {
  const [systemHealth, setSystemHealth] = useState<any>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await apiClient.get<any>('/api/admin/health');
        if (res.success && res.data) {
          setSystemHealth(res.data);
        }
      } catch {
        // Ignore errors - health check is optional
      }
    };
    fetchHealth();
    // Refresh health every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

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
        'px-4 md:px-6 py-3',
        'text-xs text-muted-foreground'
      )}
    >
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
        </div>

        {/* System Information */}
        <div className="flex items-center gap-4 flex-wrap justify-center md:justify-end">
          {systemHealth && (
            <>
              <div className="flex items-center gap-1">
                {getStatusIcon(systemHealth.status)}
                <span>API: {systemHealth.services?.api || 'unknown'}</span>
              </div>
              <div className="flex items-center gap-1">
                {getStatusIcon(systemHealth.services?.database)}
                <span>DB: {systemHealth.services?.database || 'unknown'}</span>
              </div>
              {systemHealth.uptime && (
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
    </footer>
  );
}
