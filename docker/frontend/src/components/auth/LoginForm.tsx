'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { loginSchema, validateForm } from '@/lib/utils';

interface LoginResponse {
  accessToken?: string;
  user?: {
    id: string;
    email: string;
  };
}


interface LoginFormProps {
  onSuccess?: (token: string) => void;
  onSwitchToRegister?: () => void;
}

export function LoginForm({ onSuccess, onSwitchToRegister }: LoginFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    mfaCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMFA, setShowMFA] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/api/auth/reset-password', {
        email: formData.email,
      });

      if (response.success) {
        setError('Password reset email sent. Check your inbox.');
      } else {
        setError(response.error || 'Failed to send reset email');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (showReset) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold">ThaliumX</span>
          </div>
          <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your email to receive a password reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert className="mb-4" variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Reset Link...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowReset(false)}
              disabled={isLoading}
            >
              Back to Login
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate form data
    const validation = validateForm(loginSchema, {
      email: formData.email,
      password: formData.password,
    });

    if (!validation.success) {
      setError(Object.values(validation.errors)[0] || 'Please check your input');
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiClient.post<LoginResponse>('/api/auth/login', {
        email: formData.email,
        password: formData.password,
      });

      if (!response.success) {
        if (response.error === 'MFA_REQUIRED') {
          setShowMFA(true);
          return;
        }
        throw new Error(response.message || 'Login failed');
      }

      if (response.success) {
        // Tokens are now stored in httpOnly cookies by the backend
        onSuccess?.('authenticated');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.post<LoginResponse>('/api/auth/verify-mfa', {
        email: formData.email,
        mfaCode: formData.mfaCode,
      });

      if (!response.success) {
        throw new Error(response.message || 'MFA verification failed');
      }

      if (response.success) {
        // Tokens are now stored in httpOnly cookies by the backend
        onSuccess?.('authenticated');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed');
    } finally {
      setIsLoading(false);
    }
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
        <CardTitle className="text-2xl text-center">
          {showMFA ? 'Two-Factor Authentication' : 'Welcome Back'}
        </CardTitle>
        <CardDescription className="text-center">
          {showMFA 
            ? 'Enter your 6-digit authentication code'
            : 'Sign in to your account to continue'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!showMFA ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleMFASubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mfaCode">Authentication Code</Label>
              <div className="relative">
                <Input
                  id="mfaCode"
                  type="text"
                  placeholder="000000"
                  value={formData.mfaCode}
                  onChange={(e) => setFormData({ ...formData, mfaCode: e.target.value })}
                  maxLength={6}
                  required
                  disabled={isLoading}
                  className="text-center text-lg tracking-widest"
                />
                <Shield className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Code'
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowMFA(false)}
              disabled={isLoading}
            >
              Back to Login
            </Button>
          </form>
        )}

        <div className="mt-4 text-center text-sm">
          <Button
            variant="link"
            className="p-0 h-auto font-normal"
            onClick={() => setShowReset(true)}
          >
            Forgot password?
          </Button>
        </div>
        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <Button
            variant="link"
            className="p-0 h-auto font-normal"
            onClick={onSwitchToRegister}
          >
            Sign up
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
