# Frontend Refactoring Guide

## Overview
This guide documents the refactoring needed to align all frontend components with our clean API communication approach.

## Our Standard Approach

### 1. API Communication
**Always use `apiRequest()` from `@/lib/queryClient`**

```typescript
// ❌ OLD WAY - Direct fetch
const response = await fetch('/api/systems');

// ❌ OLD WAY - authenticatedFetch
const response = await authenticatedFetch('/api/systems');

// ✅ NEW WAY - apiRequest
import { apiRequest } from "@/lib/queryClient";
const response = await apiRequest('GET', '/api/systems');
const data = await response.json();
```

### 2. Query Keys
**Use endpoint paths consistently**

```typescript
// ✅ CORRECT
useQuery({
  queryKey: ['/api/systems'],
  // queryFn is automatic via queryClient config
})

// ✅ CORRECT with params
useQuery({
  queryKey: ['/api/systems', systemId],
  queryFn: async () => {
    const response = await apiRequest('GET', `/api/systems/${systemId}`);
    return response.json();
  }
})
```

### 3. Mutations
**Use apiRequest in mutation functions**

```typescript
// ✅ CORRECT
const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await apiRequest('POST', '/api/systems', data);
    return response.json();
  }
})
```

### 4. File Uploads
**Use FormData with apiRequest**

```typescript
// ✅ CORRECT
const formData = new FormData();
formData.append('file', file);

const response = await apiRequest('POST', '/api/upload', formData);
```

## Files Requiring Refactoring

### High Priority (Core Functionality) - ✅ COMPLETED
- [x] `src/components/user-management-tab.tsx` - ✅ DONE
- [x] `src/components/vulnerability-scan-upload.tsx` - ✅ DONE
- [x] `src/components/stig-upload-dialog.tsx` - ✅ DONE
- [x] `src/components/smart-control-assignment.tsx` - ✅ DONE
- [x] `src/components/simple-baseline-assignment.tsx` - ✅ DONE
- [x] `src/components/system-documents.tsx` - ✅ DONE
- [x] `src/components/quick-document-generator.tsx` - ✅ DONE
- [x] `src/components/narrative-editor.tsx` - ✅ DONE
- [x] `src/components/job-monitor.tsx` - ✅ DONE
- [x] `src/components/evidence-upload-manager.tsx` - ✅ DONE
- [x] `src/components/document-generator.tsx` - ✅ DONE
- [x] `src/components/controls-manager.tsx` - ✅ DONE
- [x] `src/components/control-mapping-dashboard.tsx` - ✅ DONE
- [x] `src/components/control-import-dialog.tsx` - ✅ DONE
- [x] `src/components/chat-assistant.tsx` - ✅ DONE
- [x] `src/components/ato-guided-workflow.tsx` - ✅ DONE
- [x] `src/components/template-upload-manager.tsx` - ✅ DONE

### Assessment Components - ✅ COMPLETED
- [x] `src/components/assessment-dashboard.tsx` - ✅ DONE
- [x] `src/components/assessment-lifecycle-tracker.tsx` - ✅ DONE
- [x] `src/components/assessment-results-viewer.tsx` - ✅ DONE
- [x] `src/components/assessment-initiator.tsx` - ✅ DONE
- [x] `src/components/assessment-initiator-simple.tsx` - ✅ DONE
- [x] `src/components/assessment-initiator-enhanced.tsx` - ✅ DONE
- [x] `src/components/assessment-report-generator.tsx` - ✅ DONE
- [x] `src/components/assessment-progress-tracker.tsx` - ✅ DONE
- [x] `src/components/assessment-results-detail.tsx` - ✅ DONE
- [x] `src/components/assessment-history.tsx` - ✅ DONE

### Page Components - ✅ COMPLETED
- [x] `src/pages/assessment.tsx` - ✅ DONE
- [x] `src/pages/assessment-management.tsx` - ✅ DONE
- [x] `src/pages/analytics.tsx` - ✅ DONE
- [x] `src/pages/controls.tsx` - ✅ DONE
- [x] `src/pages/test-assessment.tsx` - ✅ DONE
- [x] `src/pages/document-generation.tsx` - ✅ DONE
- [x] `src/pages/data-ingestion.tsx` - ✅ DONE
- [x] `src/pages/system-detail.tsx` - ✅ DONE

### Excluded from Refactoring (By Design)
- `src/contexts/AuthContext.tsx` - Uses direct fetch for auth-specific logic with custom token management
- `src/pages/__tests__/**` - Test files using fetch for data URLs
- `src/components/assessment-dashboard.backup.tsx` - Backup file, not in use

## Refactoring Status: ✅ COMPLETE

All production components and pages have been successfully refactored to use the `apiRequest()` pattern. The codebase now has:
- Consistent API communication across all components
- Centralized authentication handling
- Proper error handling
- Support for FormData uploads
- Clean, maintainable code

## Common Patterns to Replace

### Pattern 1: Direct fetch with manual auth
```typescript
// ❌ BEFORE
const token = getAuthToken();
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// ✅ AFTER
const response = await apiRequest('GET', '/api/endpoint');
```

### Pattern 2: authenticatedFetch
```typescript
// ❌ BEFORE
import { authenticatedFetch } from '@/lib/queryClient';
const response = await authenticatedFetch('/api/endpoint');

// ✅ AFTER
import { apiRequest } from '@/lib/queryClient';
const response = await apiRequest('GET', '/api/endpoint');
```

### Pattern 3: authApi.authenticatedFetch
```typescript
// ❌ BEFORE
import { authApi } from '@/lib/authApi';
const response = await authApi.authenticatedFetch(`${API_URL}/endpoint`);

// ✅ AFTER
import { apiRequest } from '@/lib/queryClient';
const response = await apiRequest('GET', '/api/endpoint');
```

### Pattern 4: Query with custom queryFn
```typescript
// ❌ BEFORE
useQuery({
  queryKey: ['/api/systems'],
  queryFn: async () => {
    const response = await fetch('/api/systems');
    return response.json();
  }
})

// ✅ AFTER
useQuery({
  queryKey: ['/api/systems'],
  queryFn: async () => {
    const response = await apiRequest('GET', '/api/systems');
    return response.json();
  }
})
```

## Testing Checklist

After refactoring each file:
- [ ] Import `apiRequest` from `@/lib/queryClient`
- [ ] Remove unused imports (`authenticatedFetch`, `authApi`, etc.)
- [ ] Replace all fetch calls with `apiRequest`
- [ ] Ensure proper HTTP methods ('GET', 'POST', 'PUT', 'DELETE')
- [ ] Test the functionality works
- [ ] Check for TypeScript errors

## Notes

- Keep `src/types/schema.ts` - we maintain frontend types separately
- The `apiRequest` function automatically handles:
  - Authentication headers
  - API URL prefixing
  - Error handling
  - Credentials (cookies)
