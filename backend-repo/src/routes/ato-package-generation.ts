/**
 * ATO Package Generation API routes
 */

import { Router } from 'express';
import { validateAuth } from '../middleware/auth';
import { atoPackageGenerationService } from '../services/ato-package-generation.service';
import { ValidationError, standardizeError, logError } from '../utils/error-handler';

const router = Router();

// Apply authentication to all routes
router.use(validateAuth);

/**
 * POST /api/generation/ato-package
 * Generate ATO package for a system
 */
router.post('/ato-package', async (req, res) => {
  const startTime = Date.now();

  try {
    const {
      systemId,
      includeSSP = true,
      includeNarratives = true,
      includeEvidence = true,
      includeFindings = true,
      includePOAM = true,
      includeChecklists = true
    } = req.body;

    // Validate required fields
    if (!systemId) {
      throw new ValidationError('systemId is required');
    }

    // Validate UUID format
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(systemId)) {
      throw new ValidationError('systemId must be a valid UUID');
    }

    console.log(`🚀 Starting ATO package generation for system: ${systemId}`);

    // Generate ATO package
    const result = await atoPackageGenerationService.generateATOPackage({
      systemId,
      includeSSP,
      includeNarratives,
      includeEvidence,
      includeFindings,
      includePOAM,
      includeChecklists
    });

    if (!result.success) {
      const duration = Date.now() - startTime;
      console.error(`❌ ATO package generation failed in ${duration}ms:`, result.errors);

      return res.status(500).json({
        success: false,
        error: 'Failed to generate ATO package',
        errors: result.errors,
        warnings: result.warnings,
        duration
      });
    }

    const duration = Date.now() - startTime;
    const sizeInMB = result.packageSize ? (result.packageSize / 1024 / 1024).toFixed(2) : 'unknown';

    console.log(`✅ ATO package generated successfully in ${duration}ms (${sizeInMB} MB)`);

    res.json({
      success: true,
      message: 'ATO package generated successfully',
      packagePath: result.packagePath,
      packageSize: result.packageSize,
      documentsIncluded: result.documentsIncluded,
      warnings: result.warnings,
      duration
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const standardError = standardizeError(error);

    logError(standardError, 'ATO package generation', {
      systemId: req.body.systemId,
      duration
    });

    res.status(standardError.statusCode || 500).json({
      success: false,
      error: standardError.message,
      code: standardError.code,
      duration
    });
  }
});

export default router;
