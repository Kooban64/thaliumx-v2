'use client';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterForm = RegisterForm;
const react_1 = require("react");
const button_1 = require("@/components/ui/button");
const input_1 = require("@/components/ui/input");
const card_1 = require("@/components/ui/card");
const label_1 = require("@/components/ui/label");
const alert_1 = require("@/components/ui/alert");
const lucide_react_1 = require("lucide-react");
const client_1 = __importDefault(require("@/lib/api/client"));
function RegisterForm({ onSuccess, onSwitchToLogin }) {
    const [formData, setFormData] = (0, react_1.useState)({
        email: '',
        password: '',
        confirmPassword: '',
        firstName: '',
        lastName: '',
        brokerCode: '',
    });
    const [showPassword, setShowPassword] = (0, react_1.useState)(false);
    const [showConfirmPassword, setShowConfirmPassword] = (0, react_1.useState)(false);
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)('');
    const [success, setSuccess] = (0, react_1.useState)(false);
    const validatePassword = (password) => {
        const minLength = password.length >= 8;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        return {
            minLength,
            hasUpper,
            hasLower,
            hasNumber,
            hasSpecial,
            isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
        };
    };
    const passwordValidation = validatePassword(formData.password);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        if (!passwordValidation.isValid) {
            setError('Password does not meet security requirements');
            setIsLoading(false);
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setIsLoading(false);
            return;
        }
        try {
            const response = await client_1.default.post('/api/auth/register', {
                email: formData.email,
                password: formData.password,
                firstName: formData.firstName,
                lastName: formData.lastName,
                brokerCode: formData.brokerCode || undefined,
            });
            if (!response.success) {
                throw new Error(response.error || 'Registration failed');
            }
            setSuccess(true);
            // Auto-login after successful registration
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
    if (success) {
        return (<card_1.Card className="w-full max-w-md mx-auto">
        <card_1.CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <lucide_react_1.CheckCircle className="h-6 w-6 text-green-600"/>
          </div>
          <card_1.CardTitle className="text-2xl">Registration Successful!</card_1.CardTitle>
          <card_1.CardDescription>
            Your account has been created successfully. You can now access the platform.
          </card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent>
          <button_1.Button className="w-full" onClick={() => onSuccess?.('')}>
            Continue to Platform
          </button_1.Button>
        </card_1.CardContent>
      </card_1.Card>);
    }
    return (<card_1.Card className="w-full max-w-md mx-auto">
      <card_1.CardHeader className="space-y-1">
        <div className="flex items-center justify-center space-x-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">T</span>
          </div>
          <span className="text-xl font-bold">ThaliumX</span>
        </div>
        <card_1.CardTitle className="text-2xl text-center">Create Account</card_1.CardTitle>
        <card_1.CardDescription className="text-center">
          Join ThaliumX to access advanced trading features
        </card_1.CardDescription>
      </card_1.CardHeader>
      <card_1.CardContent>
        {error && (<alert_1.Alert className="mb-4" variant="destructive">
            <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
          </alert_1.Alert>)}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label_1.Label htmlFor="firstName">First Name</label_1.Label>
              <input_1.Input id="firstName" type="text" placeholder="John" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required disabled={isLoading}/>
            </div>
            <div className="space-y-2">
              <label_1.Label htmlFor="lastName">Last Name</label_1.Label>
              <input_1.Input id="lastName" type="text" placeholder="Doe" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required disabled={isLoading}/>
            </div>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="email">Email</label_1.Label>
            <input_1.Input id="email" type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="brokerCode">Broker Code (Optional)</label_1.Label>
            <input_1.Input id="brokerCode" type="text" placeholder="Enter broker code if you have one" value={formData.brokerCode} onChange={(e) => setFormData({ ...formData, brokerCode: e.target.value })} disabled={isLoading}/>
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="password">Password</label_1.Label>
            <div className="relative">
              <input_1.Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Create a strong password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required disabled={isLoading}/>
              <button_1.Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)} disabled={isLoading}>
                {showPassword ? (<lucide_react_1.EyeOff className="h-4 w-4"/>) : (<lucide_react_1.Eye className="h-4 w-4"/>)}
              </button_1.Button>
            </div>
            
            {/* Password Requirements */}
            {formData.password && (<div className="space-y-1 text-xs">
                <div className={`flex items-center space-x-2 ${passwordValidation.minLength ? 'text-green-600' : 'text-red-600'}`}>
                  <div className={`h-1 w-1 rounded-full ${passwordValidation.minLength ? 'bg-green-600' : 'bg-red-600'}`}/>
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center space-x-2 ${passwordValidation.hasUpper ? 'text-green-600' : 'text-red-600'}`}>
                  <div className={`h-1 w-1 rounded-full ${passwordValidation.hasUpper ? 'bg-green-600' : 'bg-red-600'}`}/>
                  <span>One uppercase letter</span>
                </div>
                <div className={`flex items-center space-x-2 ${passwordValidation.hasLower ? 'text-green-600' : 'text-red-600'}`}>
                  <div className={`h-1 w-1 rounded-full ${passwordValidation.hasLower ? 'bg-green-600' : 'bg-red-600'}`}/>
                  <span>One lowercase letter</span>
                </div>
                <div className={`flex items-center space-x-2 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-red-600'}`}>
                  <div className={`h-1 w-1 rounded-full ${passwordValidation.hasNumber ? 'bg-green-600' : 'bg-red-600'}`}/>
                  <span>One number</span>
                </div>
                <div className={`flex items-center space-x-2 ${passwordValidation.hasSpecial ? 'text-green-600' : 'text-red-600'}`}>
                  <div className={`h-1 w-1 rounded-full ${passwordValidation.hasSpecial ? 'bg-green-600' : 'bg-red-600'}`}/>
                  <span>One special character</span>
                </div>
              </div>)}
          </div>

          <div className="space-y-2">
            <label_1.Label htmlFor="confirmPassword">Confirm Password</label_1.Label>
            <div className="relative">
              <input_1.Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm your password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} required disabled={isLoading}/>
              <button_1.Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isLoading}>
                {showConfirmPassword ? (<lucide_react_1.EyeOff className="h-4 w-4"/>) : (<lucide_react_1.Eye className="h-4 w-4"/>)}
              </button_1.Button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (<p className="text-xs text-red-600">Passwords do not match</p>)}
          </div>

          <button_1.Button type="submit" className="w-full" disabled={isLoading || !passwordValidation.isValid}>
            {isLoading ? (<>
                <lucide_react_1.Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                Creating Account...
              </>) : ('Create Account')}
          </button_1.Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already have an account? </span>
          <button_1.Button variant="link" className="p-0 h-auto font-normal" onClick={onSwitchToLogin}>
            Sign in
          </button_1.Button>
        </div>
      </card_1.CardContent>
    </card_1.Card>);
}
//# sourceMappingURL=RegisterForm.js.map