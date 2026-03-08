'use client';

import { useEffect } from 'react';

/**
 * GlobalErrorHandler - Logs unhandled errors for debugging
 * 
 * This component should be mounted once at the root level to:
 * - Log unhandled promise rejections (for debugging)
 * - Log uncaught errors (for debugging)
 * - NOT suppress errors - components should handle them with proper user feedback
 * 
 * Note: We log errors but don't prevent them. Components should handle API errors
 * gracefully with user-friendly messages (toasts, inline errors, etc.)
 */
export function GlobalErrorHandler() {
  useEffect(() => {
    // Handle unhandled promise rejections (e.g., from API calls that weren't caught)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      
      // Always log for debugging - don't hide problems
      console.error('Unhandled promise rejection (this should be handled by components):', error);
      
      // Don't prevent default - let components handle it
      // If it reaches here, it means a component didn't properly handle an API error
      // This is useful for debugging missing error handling
    };

    // Handle uncaught errors
    const handleError = (event: ErrorEvent) => {
      const error = event.error;
      
      // Always log for debugging
      console.error('Uncaught error (this should be handled by components):', error || event);
      
      // Don't prevent default - let error boundary handle React errors
    };

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Cleanup
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // This component doesn't render anything
  return null;
}
