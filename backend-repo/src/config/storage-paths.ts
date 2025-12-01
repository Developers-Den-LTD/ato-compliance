/**
 * Centralized storage path configuration
 * Provides environment-aware path resolution for different deployment scenarios
 */

import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Get base storage directory based on environment
 */
function getBaseStorageDir(): string {
  // Check environment variable first
  if (process.env.STORAGE_PATH) {
    return process.env.STORAGE_PATH;
  }

  // Detect environment
  const isDocker = process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production';

  if (isDocker) {
    // Docker/Production: Use /app/server/storage
    return '/app/server/storage';
  } else {
    // Development: Use local server/storage directory
    // Get the directory of the current module
    const currentDir = process.cwd();
    return join(currentDir, 'server', 'storage');
  }
}

/**
 * Storage paths configuration
 */
export const storagePaths = {
  // Base directories
  base: getBaseStorageDir(),
  public: join(getBaseStorageDir(), 'public'),
  private: join(getBaseStorageDir(), 'private'),

  // Subdirectories
  artifacts: join(getBaseStorageDir(), 'artifacts'),
  documents: join(getBaseStorageDir(), 'documents'),
  templates: join(getBaseStorageDir(), 'templates'),
  packages: join(getBaseStorageDir(), 'ato-packages'),
  uploads: join(getBaseStorageDir(), 'uploads'),
  evidence: join(getBaseStorageDir(), 'evidence'),
  exports: join(getBaseStorageDir(), 'exports'),

  // Temporary directories
  temp: join(getBaseStorageDir(), 'temp'),
  cache: join(getBaseStorageDir(), 'cache'),
};

/**
 * Resolve artifact storage path
 */
export function getArtifactStoragePath(isPublic: boolean): string {
  return isPublic ? storagePaths.public : storagePaths.private;
}

/**
 * Resolve document storage path by type
 */
export function getDocumentStoragePath(documentType?: string): string {
  if (documentType === 'template') {
    return storagePaths.templates;
  } else if (documentType === 'package') {
    return storagePaths.packages;
  } else if (documentType === 'evidence') {
    return storagePaths.evidence;
  }

  return storagePaths.documents;
}

/**
 * Get upload directory
 */
export function getUploadPath(): string {
  return storagePaths.uploads;
}

/**
 * Get temporary directory for processing
 */
export function getTempPath(): string {
  return storagePaths.temp;
}

/**
 * Ensure all storage directories exist
 */
export async function ensureStorageDirectories(): Promise<void> {
  const { mkdir } = await import('fs/promises');

  const directories = Object.values(storagePaths);

  for (const dir of directories) {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      console.warn(`Failed to create directory ${dir}:`, error);
    }
  }

  console.log(`✅ Storage directories initialized at: ${storagePaths.base}`);
}

// Export for convenience
export default storagePaths;
