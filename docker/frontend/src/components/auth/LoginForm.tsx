'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LoginFormProps {
  onContinue?: () => void;
}

export function LoginForm({ onContinue }: LoginFormProps) {
  const handleContinue = () => {
    onContinue?.();
    window.location.href = '/auth';
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">T</span>
          </div>
          <span className="text-xl font-bold">ThaliumX</span>
        </div>
        <CardTitle className="text-2xl text-center">Sign in</CardTitle>
        <CardDescription className="text-center">
          Authentication is handled by the identity provider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" className="w-full" onClick={handleContinue}>
          Continue to sign in
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Password reset and MFA are managed in the identity provider account console.
        </p>
      </CardContent>
    </Card>
  );
}
