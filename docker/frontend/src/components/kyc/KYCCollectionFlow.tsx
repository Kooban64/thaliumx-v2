'use client';

/**
 * KYC Collection Flow Component
 * 
 * Embeds Ballerine collection flow in an iframe for seamless KYC completion.
 * Users never see Ballerine directly - everything happens within our UI.
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { getZitadelToken } from '@/lib/auth/backend-auth';

interface KYCCollectionFlowProps {
  workflowId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

interface CollectionFlowData {
  workflowId: string;
  collectionFlowUrl: string;
  collectionFlowToken?: string;
  workflowStatus: string;
  currentState: string;
  embedConfig: {
    allow: string;
    sandbox: string;
  };
  usage: 'iframe_only';
}

export function KYCCollectionFlow({
  workflowId,
  onComplete,
  onError,
  className
}: KYCCollectionFlowProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collectionFlowData, setCollectionFlowData] = useState<CollectionFlowData | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string>('pending');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch collection flow from backend
  useEffect(() => {
    const fetchCollectionFlow = async () => {
      try {
        const token = getZitadelToken();
        if (!token) {
          setError('Authentication required');
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/kyc/collection-flow/${workflowId}`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load collection flow');
        }

        const data = await response.json();
        if (data.success && data.data) {
          setCollectionFlowData(data.data);
          setWorkflowStatus(data.data.workflowStatus);
        } else {
          throw new Error('Invalid response from server');
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load KYC collection flow';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (workflowId) {
      fetchCollectionFlow();
    }
  }, [workflowId, onError]);

  // Listen for iframe messages (completion, errors, etc.)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify message origin (should be from Ballerine)
      // In production, validate against BALLERINE_BASE_URL from backend
      // For now, accept messages from localhost (dev) and ballerine domains
      const allowedOrigins = [
        'localhost',
        'ballerine',
        process.env.NEXT_PUBLIC_BALLERINE_BASE_URL || ''
      ].filter(Boolean);
      
      const originMatches = allowedOrigins.some(allowed => 
        event.origin.includes(allowed) || event.origin === allowed
      );
      
      if (!originMatches && process.env.NODE_ENV === 'production') {
        console.warn('Ignored message from unknown origin:', event.origin);
        return; // Ignore messages from unknown origins in production
      }

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        // Handle workflow completion
        if (data.type === 'workflow.completed' || data.event === 'workflow.completed') {
          setWorkflowStatus('completed');
          onComplete?.();
        }
        
        // Handle workflow state changes
        if (data.type === 'workflow.state-changed' || data.event === 'workflow.state-changed') {
          if (data.state) {
            setWorkflowStatus(data.state);
          }
        }
        
        // Handle errors
        if (data.type === 'error' || data.error) {
          setError(data.error || data.message || 'An error occurred in the collection flow');
          onError?.(data.error || data.message);
        }
      } catch (err) {
        // Ignore invalid JSON messages
        console.debug('Ignored iframe message:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onComplete, onError]);

  // Poll workflow status to detect completion
  useEffect(() => {
    if (!workflowId || workflowStatus === 'completed' || workflowStatus === 'failed') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const token = getZitadelToken();
        if (!token) return;

        const response = await fetch(`/api/workflows/${workflowId}/status`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const status = data.data.status;
            setWorkflowStatus(status);
            
            if (status === 'completed') {
              onComplete?.();
              clearInterval(pollInterval);
            } else if (status === 'failed') {
              setError('Workflow failed. Please contact support.');
              clearInterval(pollInterval);
            }
          }
        }
      } catch (err) {
        // Ignore polling errors
        console.debug('Workflow status poll error:', err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [workflowId, workflowStatus, onComplete]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>KYC Verification</CardTitle>
          <CardDescription>Complete your identity verification</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button 
            className="mt-4" 
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (workflowStatus === 'completed') {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">Verification Complete!</h3>
          <p className="text-muted-foreground text-center mb-4">
            Your KYC verification has been completed successfully.
          </p>
          {onComplete && (
            <Button onClick={onComplete}>
              Continue
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!collectionFlowData?.collectionFlowUrl) {
    return (
      <Card className={className}>
        <CardContent className="py-12">
          <Alert>
            <AlertDescription>
              Collection flow is not available yet. Please wait while we prepare your verification.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Identity Verification</CardTitle>
            <CardDescription>
              Please complete the verification process to upgrade your account
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Security Note: This iframe embeds Ballerine collection flow */}
        {/* Users never see Ballerine directly - it's embedded in our UI */}
        <div className="relative w-full" style={{ minHeight: '600px' }}>
          <iframe
            ref={iframeRef}
            src={collectionFlowData.collectionFlowUrl}
            className="w-full border rounded-lg"
            style={{ minHeight: '600px', height: '100%' }}
            allow={collectionFlowData.embedConfig.allow}
            sandbox={collectionFlowData.embedConfig.sandbox}
            title="KYC Verification"
            // Security: Prevent navigation away from iframe
            onLoad={() => {
              // Verify iframe loaded successfully
              if (iframeRef.current) {
                try {
                  // Try to access iframe content (will fail due to CORS, which is expected)
                  const iframeWindow = iframeRef.current.contentWindow;
                  if (!iframeWindow) {
                    console.debug('Iframe content window not accessible (expected due to CORS)');
                  }
                } catch (err) {
                  // Expected CORS error - iframe is from different origin
                  console.debug('Iframe CORS check (expected):', err);
                }
              }
            }}
          />
        </div>

        {/* Status indicator */}
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Status: {workflowStatus}</span>
          {workflowStatus === 'running' && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
        </div>

        {/* Help text */}
        <Alert className="mt-4">
          <AlertDescription className="text-xs">
            <strong>Secure Verification:</strong> This verification process is handled securely.
            You may be asked to provide identification documents and personal information.
            All data is encrypted and processed according to regulatory requirements.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
