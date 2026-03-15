'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const handleContinue = () => {
    onSuccess?.();
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
        <CardTitle className="text-2xl text-center">Create Account</CardTitle>
        <CardDescription className="text-center">
          Registration is handled by the identity provider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" className="w-full" onClick={handleContinue}>
          Continue to sign up
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          You will complete registration, verification, and MFA in the identity provider console.
        </p>
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <Button variant="link" className="p-0 h-auto font-normal" onClick={onSwitchToLogin}>
            Sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
