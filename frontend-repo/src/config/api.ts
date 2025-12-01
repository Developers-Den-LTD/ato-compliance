// API Configuration
const getApiUrl = (): string => {
  // Debug logging
  console.log('🔍 VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('🔍 MODE:', import.meta.env.MODE);
  
  // Always use VITE_API_URL if set
  if (import.meta.env.VITE_API_URL) {
    console.log('✅ Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  // Fallback to localhost for development
  console.log('⚠️ Falling back to localhost');
  return 'http://localhost:3000';
};

export const API_BASE_URL = getApiUrl();
export const API_URL = `${API_BASE_URL}/api`;

console.log('🎯 Final API_BASE_URL:', API_BASE_URL);
console.log('🎯 Final API_URL:', API_URL);

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


