// Mock API service - provides dummy data for all endpoints
// This allows the frontend to run without a backend

export const MOCK_DATA = {
  user: {
    id: '1',
    username: 'demo@example.com',
    displayName: 'Demo User',
    email: 'demo@example.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'admin',
    permissions: ['*'],
    systems: ['*'],
    lastLoginAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString()
  },
  
  systems: [
    {
      id: 'sys-1',
      name: 'Production Web Application',
      description: 'Main customer-facing web application',
      category: 'Major Application',
      impactLevel: 'High',
      complianceStatus: 'in-progress',
      owner: 'John Doe',
      systemType: 'Application',
      operatingSystem: 'Linux',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sys-2',
      name: 'Internal Database System',
      description: 'PostgreSQL database cluster',
      category: 'General Support System',
      impactLevel: 'Moderate',
      complianceStatus: 'compliant',
      owner: 'Jane Smith',
      systemType: 'Operating System',
      operatingSystem: 'Ubuntu 22.04',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  
  controls: Array.from({ length: 20 }, (_, i) => ({
    id: `AC-${i + 1}`,
    framework: 'NIST-800-53',
    family: 'Access Control',
    title: `Access Control Policy ${i + 1}`,
    description: `This control addresses access control requirements for the system.`,
    baseline: ['Low', 'Moderate', 'High'],
    status: i % 3 === 0 ? 'implemented' : i % 3 === 1 ? 'partial' : 'not_implemented',
    createdAt: new Date().toISOString()
  })),
  
  findings: [
    {
      id: 'find-1',
      systemId: 'sys-1',
      title: 'Missing Security Headers',
      description: 'Web application does not implement security headers',
      severity: 'high',
      status: 'open',
      source: 'manual',
      createdAt: new Date().toISOString()
    },
    {
      id: 'find-2',
      systemId: 'sys-1',
      title: 'Outdated SSL Certificate',
      description: 'SSL certificate expires in 30 days',
      severity: 'medium',
      status: 'open',
      source: 'scap',
      createdAt: new Date().toISOString()
    }
  ],
  
  documents: [
    {
      id: 'doc-1',
      systemId: 'sys-1',
      type: 'ssp',
      title: 'System Security Plan',
      status: 'draft',
      version: '1.0',
      createdAt: new Date().toISOString()
    }
  ],
  
  assessments: [
    {
      id: 'assess-1',
      systemId: 'sys-1',
      assessmentId: 'ASSESS-2024-001',
      title: 'Annual Security Assessment',
      status: 'completed',
      progress: 100,
      findingsCount: 5,
      createdAt: new Date().toISOString()
    }
  ],
  
  jobs: [
    {
      id: 'job-1',
      systemId: 'sys-1',
      type: 'ssp',
      status: 'completed',
      progress: 100,
      createdAt: new Date().toISOString()
    }
  ],
  
  analytics: {
    timestamp: new Date().toISOString(),
    overview: {
      totalSystems: 2,
      totalControls: 20,
      totalFindings: 2,
      compliancePercentage: 75
    },
    systems: {
      total: 2,
      byImpactLevel: { High: 1, Moderate: 1, Low: 0 },
      byComplianceStatus: { compliant: 1, 'non-compliant': 0, 'in-progress': 1, 'not-assessed': 0 }
    },
    controls: {
      total: 20,
      implemented: 7,
      'partially-implemented': 7,
      'not-implemented': 6
    },
    findings: {
      total: 2,
      bySeverity: { critical: 0, high: 1, medium: 1, low: 0, informational: 0 },
      byStatus: { open: 2, fixed: 0, accepted: 0, false_positive: 0 }
    }
  }
};

// Mock fetch function that intercepts API calls
export const mockFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  console.log('[Mock API]', options?.method || 'GET', url);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Parse URL
  const urlObj = new URL(url, window.location.origin);
  const path = urlObj.pathname;
  const searchParams = urlObj.searchParams;
  
  // Mock responses based on endpoint
  let responseData: any = null;
  let status = 200;
  
  // Auth endpoints
  if (path === '/api/auth/me') {
    responseData = MOCK_DATA.user;
  }
  else if (path === '/api/auth/login') {
    // Accept any username/password for demo
    responseData = { 
      success: true,
      user: MOCK_DATA.user,
      accessToken: 'mock-access-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now(),
      session: {
        sessionId: 'mock-session-' + Date.now(),
        sessionToken: 'mock-access-token-' + Date.now(),
        token: 'mock-access-token-' + Date.now(),
        expiresAt: new Date(Date.now() + 86400000).toISOString() // 24 hours
      }
    };
  }
  else if (path === '/api/auth/register') {
    responseData = { 
      success: true,
      user: MOCK_DATA.user,
      accessToken: 'mock-access-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now()
    };
  }
  else if (path === '/api/auth/logout') {
    responseData = { success: true, message: 'Logged out successfully' };
  }
  else if (path === '/api/auth/refresh') {
    responseData = { 
      success: true,
      accessToken: 'mock-access-token-' + Date.now(),
      refreshToken: 'mock-refresh-token-' + Date.now()
    };
  }
  
  // Systems endpoints
  else if (path === '/api/systems' && options?.method === 'GET') {
    responseData = MOCK_DATA.systems;
  }
  else if (path.match(/^\/api\/systems\/[^/]+$/)) {
    const systemId = path.split('/').pop();
    responseData = MOCK_DATA.systems.find(s => s.id === systemId) || MOCK_DATA.systems[0];
  }
  else if (path.match(/^\/api\/systems\/[^/]+\/controls$/)) {
    responseData = MOCK_DATA.controls.slice(0, 10);
  }
  else if (path.match(/^\/api\/systems\/[^/]+\/documents$/)) {
    responseData = MOCK_DATA.documents;
  }
  else if (path.match(/^\/api\/systems\/[^/]+\/readiness$/)) {
    responseData = {
      ready: true,
      controlsCoverage: 85,
      evidenceCount: 15,
      missingControls: 3
    };
  }
  
  // Controls endpoints
  else if (path === '/api/controls') {
    const limit = parseInt(searchParams.get('limit') || '50');
    responseData = { controls: MOCK_DATA.controls.slice(0, limit), total: MOCK_DATA.controls.length };
  }
  
  // Findings endpoints
  else if (path === '/api/findings') {
    responseData = MOCK_DATA.findings;
  }
  
  // Documents endpoints
  else if (path === '/api/documents') {
    responseData = MOCK_DATA.documents;
  }
  
  // Assessments endpoints
  else if (path === '/api/assessments') {
    responseData = MOCK_DATA.assessments;
  }
  else if (path.match(/^\/api\/assessments\/[^/]+$/)) {
    responseData = MOCK_DATA.assessments[0];
  }
  
  // Jobs endpoints
  else if (path === '/api/jobs' || path.match(/^\/api\/generation\/jobs/)) {
    responseData = MOCK_DATA.jobs;
  }
  else if (path.match(/^\/api\/generation\/status\/[^/]+$/)) {
    responseData = { status: 'completed', progress: 100 };
  }
  else if (path.match(/^\/api\/generation\/result\/[^/]+$/)) {
    responseData = { documents: MOCK_DATA.documents, success: true };
  }
  
  // Analytics endpoints
  else if (path === '/api/analytics') {
    responseData = MOCK_DATA.analytics;
  }
  
  // Templates endpoints
  else if (path === '/api/templates') {
    responseData = [];
  }
  
  // Artifacts/Evidence endpoints
  else if (path.match(/^\/api\/artifacts/)) {
    responseData = [];
  }
  else if (path.match(/^\/api\/evidence/)) {
    responseData = [];
  }
  
  // Generation endpoints
  else if (path === '/api/generation/start') {
    responseData = { jobId: 'job-' + Date.now(), status: 'pending' };
  }
  else if (path.match(/^\/api\/documents\/ssp\/(generate|preview)$/)) {
    responseData = { success: true, documentId: 'doc-' + Date.now() };
  }
  
  // Ingestion endpoints
  else if (path === '/api/ingestion/upload') {
    responseData = { success: true, jobId: 'job-' + Date.now() };
  }
  
  // Narrative endpoints
  else if (path === '/api/narrative/generate') {
    responseData = { narrative: 'This is a generated control narrative...', success: true };
  }
  
  // Control assignment endpoints
  else if (path.match(/^\/api\/control-assignment/)) {
    responseData = { success: true, assignedCount: 10 };
  }
  
  // STIG endpoints
  else if (path.match(/^\/api\/assessment\/stig/)) {
    responseData = { success: true };
  }
  
  // Default fallback
  else {
    responseData = { message: 'Mock endpoint not implemented', path };
    status = 404;
  }
  
  // Create mock Response
  return new Response(JSON.stringify(responseData), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};

// Override global fetch with mock
export const enableMockApi = () => {
  const originalFetch = window.fetch;
  
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    
    // Only mock /api calls
    if (url.includes('/api/')) {
      return mockFetch(url, init);
    }
    
    // Pass through non-API calls
    return originalFetch(input, init);
  };
  
  console.log('%c[Mock API] Enabled', 'color: #00ff00; font-weight: bold');
  console.log('%cAll /api/* calls will return dummy data', 'color: #00ff00');
  console.log('%cYou can login with any username/password', 'color: #00ff00');
};
