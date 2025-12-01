import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  permissions: string[];
  systems: string[];
  lastLoginAt?: string;
  lastActivityAt?: string;
}

export interface Session {
  sessionId: string;
  token: string;
  sessionToken: string;
  expiresAt: string;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface MFACredentials {
  userId: string;
  mfaCode: string;
  challenge: string;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; requiresMFA?: boolean; mfaChallenge?: string }>;
  loginWithMFA: (credentials: MFACredentials) => Promise<{ success: boolean }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string, resourceId?: string) => boolean;
  hasRole: (role: string) => boolean;
  hasSystemAccess: (systemId: string) => boolean;
}

// ============================================================================
// AUTHENTICATION CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================================================
// AUTHENTICATION PROVIDER
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();

  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('accessToken')
  );

  // ============================================================================
  // API FUNCTIONS
  // ============================================================================

  const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(`/api/auth${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error || 'Request failed');
    }

    return response.json();
  };

  // ============================================================================
  // QUERIES
  // ============================================================================

  // Get current user info - always try to fetch (backend handles auth bypass)
  const { data: userData, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await apiRequest('/me');
      // Transform the response to match the expected format
      return {
        success: true,
        user: response,
        session: { 
          sessionId: 'dev-session-id',
          sessionToken: accessToken, 
          token: accessToken,
          expiresAt: new Date(Date.now() + 86400 * 1000).toISOString()
        }
      };
    },
    enabled: true, // Always try to fetch - backend will return admin user if auth disabled
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle authentication errors
  useEffect(() => {
    if (userError && accessToken) {
      console.warn('Auth check failed:', userError);
      // Clear token on auth failure
      setAccessToken(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }, [userError, accessToken]);

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      // Handle both response formats: { user, accessToken } or { user, session: { sessionToken } }
      const token = data.accessToken || data.session?.sessionToken;
      const refreshToken = data.refreshToken || data.session?.refreshToken;
      
      console.log('Login response:', data);
      console.log('Extracted token:', token);
      
      if (data.user && token) {
        setAccessToken(token);
        localStorage.setItem('accessToken', token);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        // Set user data in query cache
        queryClient.setQueryData(['auth', 'me'], {
          success: true,
          user: data.user,
          session: { 
            sessionId: 'dev-session-id',
            sessionToken: token, 
            token: token,
            expiresAt: new Date(Date.now() + 86400 * 1000).toISOString()
          }
        });
        console.log('Auth token set successfully:', token);
      } else {
        console.error('Login failed - missing user or token', { user: data.user, token });
      }
    },
    onError: (error) => {
      console.error('Login error:', error);
    },
  });

  // MFA login mutation
  const mfaLoginMutation = useMutation({
    mutationFn: (credentials: MFACredentials) =>
      apiRequest('/mfa', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      if (data.user && data.accessToken) {
        setAccessToken(data.accessToken);
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        queryClient.setQueryData(['auth', 'me'], {
          success: true,
          user: data.user,
          session: { sessionToken: data.accessToken, token: data.accessToken }
        });
      }
    },
    onError: (error) => {
      console.error('MFA login error:', error);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: () => apiRequest('/logout', { method: 'POST' }),
    onSuccess: () => {
      setAccessToken(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      queryClient.clear();
    },
    onError: (error) => {
      console.error('Logout error:', error);
      // Clear local state even if logout fails
      setAccessToken(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      queryClient.clear();
    },
  });

  // Refresh session mutation
  const refreshMutation = useMutation({
    mutationFn: () => {
      const refreshToken = localStorage.getItem('refreshToken');
      return apiRequest('/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    },
    onSuccess: (data) => {
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
      }
    },
  });

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  const login = async (credentials: LoginCredentials) => {
    try {
      const result = await loginMutation.mutateAsync(credentials);
      // Handle both response formats
      const token = result.accessToken || result.session?.sessionToken;
      return {
        success: !!(result.user && token),
        requiresMFA: result.requiresMFA,
        mfaChallenge: result.mfaChallenge,
      };
    } catch (error) {
      return { success: false };
    }
  };

  const loginWithMFA = async (credentials: MFACredentials) => {
    try {
      const result = await mfaLoginMutation.mutateAsync(credentials);
      return { success: result.success };
    } catch (error) {
      return { success: false };
    }
  };

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      // Ignore errors, local state is cleared anyway
    }
  };

  const refreshSession = async () => {
    try {
      await refreshMutation.mutateAsync();
    } catch (error) {
      // If refresh fails, logout user
      setAccessToken(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      queryClient.clear();
    }
  };

  // ============================================================================
  // PERMISSION HELPERS
  // ============================================================================

  const hasPermission = (permission: string, resourceId?: string): boolean => {
    if (!userData?.user) return false;
    
    const userPermissions = userData.user.permissions || [];
    const userSystems = userData.user.systems || [];
    
    // Check if user has the permission
    if (!userPermissions.includes(permission) && !userPermissions.includes('*')) {
      return false;
    }
    
    // If resource-specific, check system access
    if (resourceId && !userSystems.includes('*') && !userSystems.includes(resourceId)) {
      return false;
    }
    
    return true;
  };

  const hasRole = (role: string): boolean => {
    if (!userData?.user) return false;
    return userData.user.role === role;
  };

  const hasSystemAccess = (systemId: string): boolean => {
    if (!userData?.user) return false;
    const userSystems = userData.user.systems || [];
    return userSystems.includes('*') || userSystems.includes(systemId);
  };

  // ============================================================================
  // AUTO-REFRESH LOGIC
  // ============================================================================

  useEffect(() => {
    if (!accessToken || !userData?.session) return;

    const expiresAt = new Date(userData.session.expiresAt);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();

    // Refresh 5 minutes before expiry
    const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 60000); // At least 1 minute

    const refreshTimer = setTimeout(() => {
      refreshSession();
    }, refreshTime);

    return () => clearTimeout(refreshTimer);
  }, [accessToken, userData?.session]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: AuthContextType = {
    user: userData?.user || null,
    session: userData?.session || null,
    isAuthenticated: !!accessToken && !!userData?.user,
    isLoading: userLoading || loginMutation.isPending || mfaLoginMutation.isPending,
    error: userError?.message || null,
    login,
    loginWithMFA,
    logout,
    refreshSession,
    hasPermission,
    hasRole,
    hasSystemAccess,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// HOOKS FOR SPECIFIC PERMISSIONS
// ============================================================================

export function usePermission(permission: string, resourceId?: string) {
  const { hasPermission } = useAuth();
  return hasPermission(permission, resourceId);
}

export function useRole(role: string) {
  const { hasRole } = useAuth();
  return hasRole(role);
}

export function useSystemAccess(systemId: string) {
  const { hasSystemAccess } = useAuth();
  return hasSystemAccess(systemId);
}

// ============================================================================
// HIGHER-ORDER COMPONENTS
// ============================================================================

interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireAuth({ children, fallback = <div>Please log in</div> }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RequirePermissionProps {
  permission: string;
  resourceId?: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequirePermission({ 
  permission, 
  resourceId, 
  children, 
  fallback = <div>Access denied</div> 
}: RequirePermissionProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission, resourceId)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RequireRoleProps {
  role: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireRole({ 
  role, 
  children, 
  fallback = <div>Access denied</div> 
}: RequireRoleProps) {
  const { hasRole } = useAuth();

  if (!hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
