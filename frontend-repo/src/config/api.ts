// API Configuration
const getApiUrl = (): string => {
  // Always use VITE_API_URL if set
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Fallback to localhost for development
  return 'http://localhost:3000';
};

export const API_BASE_URL = getApiUrl();
export const API_URL = `${API_BASE_URL}/api`;

// Helper to build full API URL from relative path
export const buildApiUrl = (path: string): string => {
  // If already absolute, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // If starts with /api, replace with API_URL
  if (path.startsWith('/api')) {
    return `${API_URL}${path.substring(4)}`;
  }
  // Otherwise prepend API_URL
  return `${API_URL}${path}`;
};


