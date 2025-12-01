import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LoginFormProps {
  onSuccess?: () => void;
  onMFARequired?: (userId: string, challenge: string) => void;
}

export function LoginForm({ onSuccess, onMFARequired }: LoginFormProps) {
  const { login } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await login(formData);

      if (result.success) {
        toast({
          title: 'Login successful',
          description: 'Welcome back!',
        });
        onSuccess?.();
      } else if (result.requiresMFA) {
        // Extract userId from the response (this would need to be implemented)
        const userId = 'temp-user-id'; // This should come from the login response
        onMFARequired?.(userId, result.mfaChallenge!);
      } else {
        setError('Invalid username or password');
      }
    } catch (error) {
      setError('Login failed. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <Shield className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl text-center">Sign In</CardTitle>
        <CardDescription className="text-center">
          Enter your credentials to access the ATO Compliance Agent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="Enter your username"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                required
                disabled={isLoading}
                className="pr-10"
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

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !formData.username || !formData.password}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>ATO Compliance Agent</p>
          <p className="mt-1">Enterprise Security Platform</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface MFAFormProps {
  userId: string;
  challenge: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

export function MFAForm({ userId, challenge, onSuccess, onBack }: MFAFormProps) {
  const { loginWithMFA } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await loginWithMFA({
        userId,
        mfaCode,
        challenge,
      });

      if (result.success) {
        toast({
          title: 'MFA verification successful',
          description: 'Welcome back!',
        });
        onSuccess?.();
      } else {
        setError('Invalid MFA code. Please try again.');
      }
    } catch (error) {
      setError('MFA verification failed. Please try again.');
      console.error('MFA error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setMfaCode(value);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <Shield className="h-12 w-12 text-primary" />
        </div>
        <CardTitle className="text-2xl text-center">Multi-Factor Authentication</CardTitle>
        <CardDescription className="text-center">
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="mfaCode">Verification Code</Label>
            <Input
              id="mfaCode"
              type="text"
              value={mfaCode}
              onChange={handleCodeChange}
              placeholder="000000"
              maxLength={6}
              required
              disabled={isLoading}
              className="text-center text-2xl tracking-widest"
            />
          </div>

          <div className="flex space-x-2">
            {onBack && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onBack}
                disabled={isLoading}
              >
                Back
              </Button>
            )}
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading || mfaCode.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>Check your authenticator app for the current code</p>
        </div>
      </CardContent>
    </Card>
  );
}
