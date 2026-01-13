'use client';

import { useState, useRef, useEffect } from 'react';
import { Search as SearchIcon, X, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export interface SearchResult {
  id: string;
  label: string;
  href: string;
  description?: string;
  category?: string;
}

interface SearchProps {
  placeholder?: string;
  onSearch?: (query: string) => Promise<SearchResult[]>;
  defaultSearch?: (query: string) => SearchResult[];
  className?: string;
  showShortcut?: boolean;
}

/**
 * Search - Global search component
 * Cursor IDE-inspired design with keyboard shortcuts
 */
export function Search({
  placeholder = 'Search...',
  onSearch,
  className,
  showShortcut = true,
  defaultSearch,
}: SearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Open search with Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuery('');
        setResults([]);
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

  // Handle search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (onSearch) {
      setIsSearching(true);
      onSearch(query)
        .then((searchResults) => {
          setResults(searchResults);
          setSelectedIndex(0);
        })
        .finally(() => setIsSearching(false));
    } else if (defaultSearch) {
      const searchResults = defaultSearch(query);
      setResults(searchResults);
      setSelectedIndex(0);
    }
  }, [query, onSearch, defaultSearch]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        router.push(results[selectedIndex].href);
        setIsOpen(false);
        setQuery('');
        setResults([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, router]);

  const handleResultClick = (result: SearchResult) => {
    router.push(result.href);
    setIsOpen(false);
    setQuery('');
    setResults([]);
  };

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={cn(
          'h-8 w-full justify-start text-sm text-muted-foreground',
          className
        )}
      >
        <SearchIcon className="h-4 w-4 mr-2" />
        <span className="flex-1 text-left">{placeholder}</span>
        {showShortcut && (
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <Command className="h-3 w-3" />
            <span>K</span>
          </kbd>
        )}
      </Button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
        onClick={() => {
          setIsOpen(false);
          setQuery('');
          setResults([]);
        }}
      />

      {/* Search Modal */}
      <div className="fixed left-1/2 top-20 z-50 w-full max-w-lg -translate-x-1/2">
        <div className="rounded-lg border bg-popover shadow-lg">
          {/* Search Input */}
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsOpen(false);
                setQuery('');
                setResults([]);
              }}
              className="h-6 w-6"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Results */}
          {query && (
            <div className="max-h-[300px] overflow-y-auto p-2">
              {isSearching ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Searching...
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className={cn(
                        'w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        selectedIndex === index && 'bg-accent text-accent-foreground'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{result.label}</div>
                          {result.description && (
                            <div className="text-xs text-muted-foreground">
                              {result.description}
                            </div>
                          )}
                        </div>
                        {result.category && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {result.category}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No results found
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          {!query && (
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Navigate with arrow keys</span>
                <span>Press Enter to select</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
