'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useActiveRoute } from './hooks/useActiveRoute';

interface TabItem {
  id: string;
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  variant?: 'default' | 'pills' | 'underline';
}

/**
 * Tabs - Tab navigation component
 * Cursor IDE-inspired design with multiple variants
 */
export function Tabs({
  items,
  defaultValue,
  value,
  onValueChange,
  className,
  variant = 'default',
}: TabsProps) {
  const { isActive } = useActiveRoute();
  const [internalValue, setInternalValue] = useState(defaultValue || items[0]?.id);
  const activeValue = value || internalValue;

  const handleChange = (newValue: string) => {
    if (!value) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const variantClasses = {
    default: 'border-b',
    pills: 'gap-1',
    underline: 'border-b',
  };

  return (
    <div
      className={cn(
        'flex items-center',
        variantClasses[variant],
        className
      )}
      role="tablist"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActiveTab = Boolean(activeValue === item.id || (item.href && isActive(item.href)));
        const isDisabled = item.disabled;

        if (variant === 'pills') {
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActiveTab ? true : false}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              onClick={() => !isDisabled && handleChange(item.id)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                isActiveTab
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                isDisabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4" />}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActiveTab}
            aria-disabled={isDisabled}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) {
                handleChange(item.id);
              }
            }}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 border-transparent',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              isActiveTab
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:border-muted-foreground/50',
              isDisabled && 'opacity-50 cursor-not-allowed',
              variant === 'underline' && isActiveTab && 'border-primary'
            )}
          >
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4" />}
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                  {item.badge}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
