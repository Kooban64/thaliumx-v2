'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Gauge, AlertCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RateLimitInfo {
  maxRequests: number;
  windowSeconds: number;
  currentRequests: number;
  remainingRequests: number;
  resetTime: Date;
  endpointType: string;
  role: string;
  kycLevel: string;
}

interface RateLimitDisplayProps {
  endpointType?: string;
  className?: string;
  showDetails?: boolean;
}

export function RateLimitDisplay({ 
  endpointType = 'api',
  className,
  showDetails = true 
}: RateLimitDisplayProps) {
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);

  useEffect(() => {
    const updateRateLimitInfo = () => {
      const stored = localStorage.getItem(`rateLimit_${endpointType}`);
      if (stored) {
        try {
          const info = JSON.parse(stored);
          setRateLimitInfo({
            ...info,
            resetTime: new Date(info.resetTime)
          });
        } catch {
          // Invalid stored data
        }
      }
    };

    updateRateLimitInfo();
    
    const handleRateLimitUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.endpointType === endpointType || !endpointType) {
        setRateLimitInfo(customEvent.detail);
        localStorage.setItem(`rateLimit_${endpointType}`, JSON.stringify(customEvent.detail));
      }
    };

    window.addEventListener('rateLimitUpdate', handleRateLimitUpdate);
    
    return () => {
      window.removeEventListener('rateLimitUpdate', handleRateLimitUpdate);
    };
  }, [endpointType]);

  if (!rateLimitInfo) {
    return null;
  }

  const usagePercent = rateLimitInfo.maxRequests > 0
    ? (rateLimitInfo.currentRequests / rateLimitInfo.maxRequests) * 100
    : 0;

  const isNearLimit = usagePercent >= 80;
  const isAtLimit = rateLimitInfo.remainingRequests === 0;

  const timeUntilReset = Math.max(0, Math.floor((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000));
  const minutesUntilReset = Math.floor(timeUntilReset / 60);
  const secondsUntilReset = timeUntilReset % 60;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Rate Limits
          </CardTitle>
          <Badge variant={isAtLimit ? 'destructive' : isNearLimit ? 'secondary' : 'outline'}>
            {rateLimitInfo.endpointType}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {rateLimitInfo.remainingRequests} of {rateLimitInfo.maxRequests} requests remaining
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>Usage</span>
            <span className="font-medium">{usagePercent.toFixed(1)}%</span>
          </div>
          <Progress 
            value={usagePercent} 
            className={`h-2 ${
              isAtLimit ? 'bg-red-500' : 
              isNearLimit ? 'bg-orange-500' : 
              'bg-green-500'
            }`}
          />
        </div>

        {isAtLimit && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Rate limit reached. Please wait {minutesUntilReset}m {secondsUntilReset}s before making more requests.
            </AlertDescription>
          </Alert>
        )}

        {isNearLimit && !isAtLimit && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Approaching rate limit. {rateLimitInfo.remainingRequests} requests remaining.
            </AlertDescription>
          </Alert>
        )}

        {timeUntilReset > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Resets in {minutesUntilReset}m {secondsUntilReset}s</span>
          </div>
        )}

        {showDetails && (
          <div className="pt-3 border-t space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Endpoint Type:</span>
              <span className="font-medium">{rateLimitInfo.endpointType}</span>
            </div>
            <div className="flex justify-between">
              <span>Window:</span>
              <span className="font-medium">{rateLimitInfo.windowSeconds}s</span>
            </div>
            {rateLimitInfo.role && (
              <div className="flex justify-between">
                <span>Role:</span>
                <span className="font-medium">{rateLimitInfo.role}</span>
              </div>
            )}
            {rateLimitInfo.kycLevel && (
              <div className="flex justify-between">
                <span>KYC Level:</span>
                <span className="font-medium">{rateLimitInfo.kycLevel}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
