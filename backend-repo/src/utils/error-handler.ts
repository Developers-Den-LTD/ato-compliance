// Standardized Error Handling Utilities
// Provides consistent error handling patterns across the application

export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
  timestamp: string;
}

export class StandardError extends Error implements AppError {
  public code: string;
  public statusCode: number;
  public details: any;
  public timestamp: string;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500,
    details: any = null
  ) {
    super(message);
    this.name = 'StandardError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export class ValidationError extends StandardError {
  constructor(message: string, details: any = null) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends StandardError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ProcessingError extends StandardError {
  constructor(message: string, details: any = null) {
    super(message, 'PROCESSING_ERROR', 422, details);
    this.name = 'ProcessingError';
  }
}

export class AuthenticationError extends StandardError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends StandardError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
    this.name = 'AuthorizationError';
  }
}

/**
 * Standardized error handler for async operations
 */
export async function handleAsyncError<T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Error in ${context}:`, error);
    
    if (error instanceof StandardError) {
      throw error;
    }
    
    // Convert unknown errors to StandardError
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new ProcessingError(`Failed to ${context}: ${message}`, error);
  }
}

/**
 * Standardized error handler for document processing operations
 */
export async function handleDocumentProcessingError<T>(
  operation: () => Promise<T>,
  documentId: string,
  operationType: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Document processing error for ${documentId} (${operationType}):`, error);
    
    if (error instanceof StandardError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    throw new ProcessingError(
      `Failed to ${operationType} document ${documentId}: ${message}`,
      { documentId, operationType, originalError: error }
    );
  }
}

/**
 * Standardized error handler for narrative generation
 */
export async function handleNarrativeGenerationError<T>(
  operation: () => Promise<T>,
  controlId: string,
  systemId: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`Narrative generation error for control ${controlId} in system ${systemId}:`, error);
    
    if (error instanceof StandardError) {
      throw error;
    }
    
    const message = error instanceof Error ? error.message : 'Unknown narrative generation error';
    throw new ProcessingError(
      `Failed to generate narrative for control ${controlId}: ${message}`,
      { controlId, systemId, originalError: error }
    );
  }
}

/**
 * Convert any error to a standardized format
 */
export function standardizeError(error: unknown): AppError {
  if (error instanceof StandardError) {
    return error;
  }
  
  if (error instanceof Error) {
    return new StandardError(
      error.message,
      'UNKNOWN_ERROR',
      500,
      { originalError: error.name, stack: error.stack }
    );
  }
  
  return new StandardError(
    'An unknown error occurred',
    'UNKNOWN_ERROR',
    500,
    { originalError: error }
  );
}

/**
 * Log error with context
 */
export function logError(error: AppError, context: string, additionalInfo?: any): void {
  const logData = {
    timestamp: error.timestamp,
    code: error.code,
    message: error.message,
    context,
    statusCode: error.statusCode,
    details: error.details,
    ...additionalInfo
  };
  
  if (error.statusCode >= 500) {
    console.error('Server Error:', logData);
  } else {
    console.warn('Client Error:', logData);
  }
}

/**
 * Create a user-friendly error message
 */
export function getUserFriendlyMessage(error: AppError): string {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return 'Please check your input and try again.';
    case 'NOT_FOUND':
      return 'The requested resource was not found.';
    case 'AUTHENTICATION_ERROR':
      return 'Please log in to continue.';
    case 'AUTHORIZATION_ERROR':
      return 'You do not have permission to perform this action.';
    case 'PROCESSING_ERROR':
      return 'There was an error processing your request. Please try again.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}
