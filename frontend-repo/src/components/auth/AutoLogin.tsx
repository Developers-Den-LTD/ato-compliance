import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function AutoLogin() {
  const { login, isAuthenticated } = useAuth();
  const hasAttemptedLogin = useRef(false);

  useEffect(() => {
    // Auto-login in development mode or when auth is disabled if not authenticated
    if (!isAuthenticated && !hasAttemptedLogin.current) {
      hasAttemptedLogin.current = true;
      console.log('Development mode: Auto-logging in with admin credentials');
      login({ username: 'admin', password: 'admin123' })
        .then((result) => {
          if (result.success) {
            console.log('Auto-login successful');
          } else {
            console.warn('Auto-login failed:', result);
            // Don't reset hasAttemptedLogin to prevent retry loops
          }
        })
        .catch((error) => {
          console.error('Auto-login error:', error);
          // Don't reset hasAttemptedLogin to prevent retry loops
        });
    }
  }, [isAuthenticated, login]);

  return null;
}