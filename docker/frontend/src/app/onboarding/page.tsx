/**
 * Onboarding Page
 * 
 * Shows onboarding workflow progress after user registration
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { KYCCollectionFlow } from '@/components/kyc/KYCCollectionFlow';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { checkAuth as checkBackendAuth } from '@/lib/auth/backend-auth';
import Link from 'next/link';

function OnboardingPageContent() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [workflowIdFromUrl, setWorkflowIdFromUrl] = useState<string | null>(null);

  useEffect(() => {
    // Check for workflowId in URL (from upgrade trigger)
    const workflowId = searchParams.get('workflowId');
    if (workflowId) {
      setWorkflowIdFromUrl(workflowId);
    }

    const fetchUser = async () => {
      try {
        const isAuthenticated = await checkBackendAuth();
        if (!isAuthenticated) {
          window.location.href = '/login?next=/onboarding';
          return;
        }

        const response = await apiClient.get<{ id: string }>('/api/auth/profile');
        if (response.success && response.data?.id) {
          setUserId(response.data.id);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Please log in to view onboarding</p>
              <Button asChild>
                <Link href="/login">Login</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (onboardingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <div className="mb-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <span className="text-green-600 text-3xl">✓</span>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Onboarding Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Your account has been successfully set up. You can now access all platform features.
            </p>
            <Button asChild className="w-full">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If workflowId provided in URL, show collection flow directly
  if (workflowIdFromUrl && !loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">KYC Verification</h1>
            <p className="text-muted-foreground mt-2">
              Please complete your identity verification to upgrade your account.
            </p>
          </div>
          <KYCCollectionFlow
            workflowId={workflowIdFromUrl}
            onComplete={() => {
              setOnboardingComplete(true);
            }}
            onError={(error) => {
              console.error('KYC collection error:', error);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Welcome to ThaliumX</h1>
          <p className="text-muted-foreground mt-2">
            We&apos;re setting up your account. This will only take a few minutes.
          </p>
        </div>
        <OnboardingProgress
          userId={userId}
          onComplete={() => setOnboardingComplete(true)}
        />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <OnboardingPageContent />
    </Suspense>
  );
}
