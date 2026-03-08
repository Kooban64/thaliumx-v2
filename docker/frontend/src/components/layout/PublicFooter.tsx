'use client';

import Link from 'next/link';
import { ExternalLink, Github, FileText, HelpCircle, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatWidget } from '@/components/support/ChatWidget';

/**
 * PublicFooter - Footer for public pages (landing, token presale)
 * 
 * Features:
 * - Quick links: Support, Docs, Privacy, Terms, GitHub
 * - Copyright and version info
 * - Simpler design than AppFooter
 * - No system health checks (those are for authenticated users)
 */
export function PublicFooter() {
  return (
    <footer
      className={cn(
        'border-t border-border',
        'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'px-4 md:px-6 py-6',
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
          <ChatWidget isPublic={true} />
        </div>

        {/* Copyright and Version */}
        <div className="flex items-center gap-2 text-muted-foreground/70">
          <span>
            v1.0.0 • Built with <Heart className="inline h-3 w-3 text-red-500" /> by ThaliumX
          </span>
        </div>
      </div>
    </footer>
  );
}
