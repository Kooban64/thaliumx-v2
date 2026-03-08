'use client';

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the component tree,
 * logs those errors, and displays a fallback UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Error Boundary should only catch React rendering errors (component lifecycle, render phase)
    // API/network errors should be handled at the component level with proper user feedback
    
    // Allow all errors to be caught - components should handle API errors gracefully
    // This ensures we catch real application bugs while components handle API failures
    
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Always log errors for debugging - don't hide problems
    this.setState({
      error,
      errorInfo,
    });

    // Log error to console for debugging
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error reporting service (Sentry, LogRocket, etc.)
      // reportError(error, errorInfo);
    }
  }

  handleRetry = () => {
    // Reset error state and allow component to re-render
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Force a small delay to allow any pending async operations to complete
    setTimeout(() => {
      // Component will re-render automatically
    }, 100);
  };

  handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Application Error</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-4">
                  A rendering error occurred. This has been logged for debugging.
                  {this.state.error?.message && (
                    <span className="block mt-2 text-sm font-mono text-muted-foreground">
                      {this.state.error.message}
                    </span>
                  )}
                </p>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mb-4">
                    <summary className="cursor-pointer font-medium">Error Details (Development)</summary>
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                )}

                <div className="flex gap-2">
                  <Button onClick={this.handleRetry} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button onClick={this.handleReload} size="sm">
                    Reload Page
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Async Error Boundary for handling async errors
 */
export class AsyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Handle async errors (promises, async operations)
    if (error instanceof Promise) {
      error.catch((asyncError) => {
        this.setState({
          hasError: true,
          error: asyncError as Error,
          errorInfo,
        });
      });
    } else {
      this.setState({
        hasError: true,
        error,
        errorInfo,
      });
    }
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <h3 className="text-red-800 font-medium">Async Operation Failed</h3>
          <p className="text-red-600 text-sm mt-1">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Network Error Boundary for API failures
 */
export class NetworkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Check if it's a network error
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
      this.setState({
        hasError: true,
        error,
        errorInfo,
      });
    } else {
      // Re-throw non-network errors
      throw error;
    }
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50">
          <h3 className="text-yellow-800 font-medium">Connection Error</h3>
          <p className="text-yellow-600 text-sm mt-1">
            Unable to connect to our servers. Please check your internet connection and try again.
          </p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
