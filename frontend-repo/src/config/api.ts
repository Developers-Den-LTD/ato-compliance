// API Configuration
// Automatically uses localhost in development and production URL in production
const getApiUrl = (): string => {
  // Check if we're in development mode
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  
  // Use environment variable if set, otherwise use defaults
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Default URLs based on environment
  return isDevelopment 
    ? 'http://localhost:3000'
    : 'https://ato-compliance-frontend-2lm9.vercel.app';
};

export const API_BASE_URL = getApiUrl();
export const API_URL = `${API_BASE_URL}/api`;

// Frontend URL for reference
export const FRONTEND_URL = import.meta.env.DEV 
  ? 'http://localhost:5173'
  : 'https://ato-compliance-frontend-kd6j.vercel.app';
