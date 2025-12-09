'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AuthPage;
const react_1 = require("react");
const LoginForm_1 = require("@/components/auth/LoginForm");
const RegisterForm_1 = require("@/components/auth/RegisterForm");
const fingerprint_1 = require("@/lib/device/fingerprint");
function AuthPage() {
    const [isLogin, setIsLogin] = (0, react_1.useState)(true);
    const [isAuthenticated, setIsAuthenticated] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        // Check if user is already authenticated
        const token = localStorage.getItem('authToken');
        if (token) {
            setIsAuthenticated(true);
        }
    }, []);
    const handleAuthSuccess = (token) => {
        setIsAuthenticated(true);
        // Fire-and-forget device fingerprint submission
        (0, fingerprint_1.submitDeviceFingerprint)();
        // Redirect to dashboard or trading page
        window.location.href = '/dashboard';
    };
    if (isAuthenticated) {
        return (<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Authentication Successful!</h2>
          <p className="text-muted-foreground mb-4">Redirecting to dashboard...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>);
    }
    return (<div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {isLogin ? (<LoginForm_1.LoginForm onSuccess={handleAuthSuccess} onSwitchToRegister={() => setIsLogin(false)}/>) : (<RegisterForm_1.RegisterForm onSuccess={handleAuthSuccess} onSwitchToLogin={() => setIsLogin(true)}/>)}
      </div>
    </div>);
}
//# sourceMappingURL=page.js.map