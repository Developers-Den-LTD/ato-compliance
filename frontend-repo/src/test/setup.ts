// Frontend test setup for React Testing Library
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Configure React Testing Library
configure({
  testIdAttribute: 'data-testid',
  asyncUtilTimeout: 5000,
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:5001',
    origin: 'http://localhost:5001',
    pathname: '/',
    search: '',
    hash: '',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
  },
  writable: true,
});

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalConsoleError.call(console, ...args);
  };
  
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalConsoleWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test utilities for frontend
global.testUtils = {
  ...global.testUtils,
  
  // Mock API responses
  mockApiResponse: (data: any, status = 200) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data),
    });
  },
  
  // Mock API error
  mockApiError: (message = 'API Error', status = 500) => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(message));
  },
  
  // Create mock user for frontend tests
  createMockUser: () => ({
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  
  // Create mock system for frontend tests
  createMockSystem: (userId = 'test-user-id') => ({
    id: 'test-system-id',
    name: 'Test System',
    description: 'Test system description',
    category: 'General Support System',
    impactLevel: 'Moderate',
    complianceStatus: 'in-progress',
    owner: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  
  // Create mock control for frontend tests
  createMockControl: () => ({
    id: 'AC-1',
    family: 'Access Control',
    title: 'Access Control Policy and Procedures',
    description: 'Test control description',
    baseline: ['Low', 'Moderate', 'High'],
    status: 'not_implemented',
    framework: 'NIST 800-53',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  
  // Create mock assessment for frontend tests
  createMockAssessment: (systemId = 'test-system-id', userId = 'test-user-id') => ({
    id: 'test-assessment-id',
    systemId,
    name: 'Test Assessment',
    description: 'Test assessment description',
    status: 'in-progress',
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  
  // Create mock document for frontend tests
  createMockDocument: (systemId = 'test-system-id') => ({
    id: 'test-document-id',
    systemId,
    name: 'test-document.pdf',
    title: 'Test Document',
    type: 'policy_document',
    mimeType: 'application/pdf',
    size: 1024,
    status: 'approved',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  
  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock file for upload tests
  createMockFile: (name = 'test.pdf', type = 'application/pdf', size = 1024) => {
    const file = new File(['test content'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  },
};
