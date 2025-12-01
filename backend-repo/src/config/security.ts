// Security Configuration and Validation
// Ensures proper security setup for production deployments

/**
 * Validate security configuration on startup
 */
export function validateSecurityConfig(): void {
  if (process.env.NODE_ENV === 'production') {
    const hasTokens = process.env.VALID_TOKENS && process.env.VALID_TOKENS.trim().length > 0;
    const hasApiKeys = process.env.VALID_API_KEYS && process.env.VALID_API_KEYS.trim().length > 0;
    
    if (!hasTokens && !hasApiKeys) {
      console.error('CRITICAL SECURITY ERROR: Production deployment requires authentication credentials');
      console.error('Set either VALID_TOKENS or VALID_API_KEYS environment variables');
      console.error('Example: VALID_TOKENS=token1,token2 or VALID_API_KEYS=key1,key2');
      process.exit(1);
    }
    
    // Validate system permissions if provided
    if (process.env.SYSTEM_PERMISSIONS) {
      try {
        const permissions = JSON.parse(process.env.SYSTEM_PERMISSIONS);
        if (typeof permissions !== 'object' || permissions === null) {
          console.warn('WARNING: SYSTEM_PERMISSIONS should be a JSON object mapping user IDs to system arrays');
        } else {
          const userCount = Object.keys(permissions).length;
          console.log(`Production security: ${userCount} user permission mappings configured`);
        }
      } catch (error) {
        console.error('CRITICAL SECURITY ERROR: Invalid SYSTEM_PERMISSIONS JSON format');
        console.error('Example: {"token-user-abc123":["system-1","system-2"],"api-user-service":["*"]}');
        process.exit(1);
      }
    } else {
      console.warn('WARNING: No SYSTEM_PERMISSIONS configured - users will have no system access in production');
    }
    
    console.log('✅ Production security configuration validated');
  } else {
    console.log('Development mode: Using default security credentials for testing');
  }
}

/**
 * Get recommended security environment variables for production
 */
export function getSecurityTemplate(): Record<string, string> {
  return {
    'VALID_TOKENS': 'your-production-token-1,your-production-token-2',
    'VALID_API_KEYS': 'your-api-key-1,your-service-key-2', 
    'SYSTEM_PERMISSIONS': '{"token-user-your-pro":["system-id-1","system-id-2"],"api-user-your-ap":["*"]}'
  };
}
