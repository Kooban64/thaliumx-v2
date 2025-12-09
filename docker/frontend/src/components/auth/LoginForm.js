'use client';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginForm = LoginForm;
const react_1 = require("react");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const card_1 = require("@/components/ui/card");
const label_1 = require("@/components/ui/label");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
const client_1 = __importDefault(require("@/lib/api/client"));
function LoginForm({ onSuccess, onSwitchToRegister }) {
    const [formData, setFormData] = (0, react_1.useState)({
        email: '',
        password: '',
        mfaCode: '',
    });
    const [showPassword, setShowPassword] = (0, react_1.useState)(false);
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    const [showMFA, setShowMFA] = (0, react_1.useState)(false);
    const [showReset, setShowReset] = (0, react_1.useState)(false);
    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await client_1.default.post('/api/auth/reset-password', {
                email: formData.email,
            });
            if (response.success) {
                setError('Password reset email sent. Check your inbox.');
            }
            else {
                setError(response.error || 'Failed to send reset email');
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
        finally {
            setIsLoading(false);
        }
    };
    if (showReset) {
        return (<card_1.Card className="w-full max-w-md mx-auto">
        <card_1.CardHeader className="space-y-1">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold">ThaliumX</span>
          </div>
          <card_1.CardTitle className="text-2xl text-center">Reset Password</card_1.CardTitle>
          <card_1.CardDescription className="text-center">
            Enter your email to receive a password reset link
          </card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent>
          {error && (<alert_1.Alert className="mb-4" variant="destructive">
              <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
            </alert_1.Alert>)}
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="email">Email</label_1.Label>
              <input_1.Input id="email" type="email" placeholder="Enter your email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={isLoading}/>
            </div>
            <button_1.Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (<>
                  <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Sending Reset Link...
                </>) : ('Send Reset Link')}
            </button_1.Button>
            <button_1.Button type="button" variant="ghost" className="w-full" onClick={() => setShowReset(false)} disabled={isLoading}>
              Back to Login
            </button_1.Button>
          </form>
        </card_1.CardContent>
      </card_1.Card>);
    }
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await client_1.default.post('/api/auth/login', {
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
            if (response.data?.accessToken) {
                localStorage.setItem('authToken', response.data.accessToken);
                onSuccess?.(response.data.accessToken);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleMFASubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const response = await client_1.default.post('/api/auth/verify-mfa', {
                email: formData.email,
                mfaCode: formData.mfaCode,
            });
            if (!response.success) {
                throw new Error(response.message || 'MFA verification failed');
            }
            if (response.data?.accessToken) {
                localStorage.setItem('authToken', response.data.accessToken);
                onSuccess?.(response.data.accessToken);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'MFA verification failed');
        }
        finally {
            setIsLoading(false);
        }
    };
    return (<card_1.Card className="w-full max-w-md mx-auto">
      <card_1.CardHeader className="space-y-1">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">T</span>
          </div>
          <span className="text-xl font-bold">ThaliumX</span>
        </div>
        <card_1.CardTitle className="text-2xl text-center">
          {showMFA ? 'Two-Factor Authentication' : 'Welcome Back'}
        </card_1.CardTitle>
        <card_1.CardDescription className="text-center">
          {showMFA
            ? 'Enter your 6-digit authentication code'
            : 'Sign in to your account to continue'}
        </card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent>
        {error && (<alert_1.Alert className="mb-4" variant="destructive">
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        {!showMFA ? (<form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="email">Email</label_1.Label>
              <input_1.Input id="email" type="email" placeholder="Enter your email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={isLoading}/>
            </div>
            <div className="space-y-2">
              <label_1.Label htmlFor="password">Password</label_1.Label>
              <div className="relative">
                <input_1.Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required disabled={isLoading}/>
                <button_1.Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
                  {showPassword ? (<lucide_react_1.EyeOff className="h-4 w-4"/>) : (<lucide_react_1.Eye className="h-4 w-4"/>)}
                </button_1.Button>
              </div>
            </div>
            <button_1.Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (<>
                  <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Signing In...
                </>) : ('Sign In')}
            </button_1.Button>
          </form>) : (<form onSubmit={handleMFASubmit} className="space-y-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="mfaCode">Authentication Code</label_1.Label>
              <div className="relative">
                <input_1.Input id="mfaCode" type="text" placeholder="000000" value={formData.mfaCode} onChange={(e) => setFormData({ ...formData, mfaCode: e.target.value })} maxLength={6} required disabled={isLoading} className="text-center text-lg tracking-widest"/>
                <lucide_react_1.Shield className="absolute right-3 top-3 h-4 w-4 text-muted-foreground"/>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
            <button_1.Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (<>
                  <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                  Verifying...
                </>) : ('Verify Code')}
            </button_1.Button>
            <button_1.Button type="button" variant="ghost" className="w-full" onClick={() => setShowMFA(false)} disabled={isLoading}>
              Back to Login
            </button_1.Button>
          </form>)}

        <div className="mt-4 text-center text-sm">
          <button_1.Button variant="link" className="p-0 h-auto font-normal" onClick={() => setShowReset(true)}>
            Forgot password?
          </button_1.Button>
        </div>
        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Don't have an account? </span>
          <button_1.Button variant="link" className="p-0 h-auto font-normal" onClick={onSwitchToRegister}>
            Sign up
          </button_1.Button>
        </div>
      </card_1.CardContent>
    </card_1.Card>);
}
//# sourceMappingURL=LoginForm.js.map