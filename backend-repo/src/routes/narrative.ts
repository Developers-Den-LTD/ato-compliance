import { Router } from 'express';
import { validateAuth } from '../middleware/auth.js';
import { narrativeGenerationService } from '../services/narrative-generation.service.js';
import { storage } from '../storage.js';
import crypto from 'crypto';

const router = Router();

// In-memory storage for generation progress
const narrativeGenerationProgress = new Map<string, {
  systemId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  totalControls: number;
  processedControls: number;
  currentControl?: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
}>();

// Generate narratives for all controls in a system with progress tracking
router.post('/systems/:systemId/narratives/generate', validateAuth, async (req, res) => {
  try {
    const { systemId } = req.params;
    const { async: useAsync = false } = req.body || {};
    
    // Verify system exists
    const system = await storage.getSystem(systemId);
    if (!system) {
      return res.status(404).json({ error: 'System not found' });
    }
    
    if (useAsync) {
      // Generate a job ID for async processing
      const jobId = crypto.randomUUID();
      
      // Initialize progress tracking
      narrativeGenerationProgress.set(jobId, {
        systemId,
        status: 'pending',
        progress: 0,
        totalControls: 0,
        processedControls: 0,
        startTime: new Date()
      });
      
      // Start async generation
      generateNarrativesAsync(jobId, systemId);
      
      res.json({
        success: true,
        jobId,
        message: 'Narrative generation started',
        statusUrl: `/api/narrative/status/${jobId}`
      });
    } else {
      // Synchronous generation (existing behavior)
      const narratives = await narrativeGenerationService.generateSystemNarratives(systemId);
      
      res.json({
        success: true,
        systemId,
        narrativesGenerated: narratives.length,
        narratives
      });
    }
  } catch (error) {
    console.error('Failed to generate system narratives:', error);
    res.status(500).json({ 
      error: 'Failed to generate narratives',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Async narrative generation function
async function generateNarrativesAsync(jobId: string, systemId: string) {
  const progress = narrativeGenerationProgress.get(jobId);
  if (!progress) return;
  
  try {
    // Update status to in_progress
    progress.status = 'in_progress';
    
    // Get system controls to know total count
    const systemControls = await storage.getSystemControls(systemId);
    progress.totalControls = systemControls.length;
    
    // Generate narratives with progress updates
    const narratives = await narrativeGenerationService.generateSystemNarrativesWithProgress(
      systemId,
      (current: number, total: number, controlId?: string) => {
        if (progress) {
          progress.processedControls = current;
          progress.progress = Math.round((current / total) * 100);
          progress.currentControl = controlId;
        }
      }
    );
    
    // Mark as completed
    progress.status = 'completed';
    progress.progress = 100;
    progress.endTime = new Date();
    
  } catch (error) {
    console.error('Async narrative generation failed:', error);
    if (progress) {
      progress.status = 'failed';
      progress.error = error instanceof Error ? error.message : 'Unknown error';
      progress.endTime = new Date();
    }
  }
}

// Regenerate narrative for a specific control
router.post('/systems/:systemId/controls/:controlId/narrative/regenerate', validateAuth, async (req, res) => {
  try {
    const { systemId, controlId } = req.params;
    
    // Verify system and control exist
    const system = await storage.getSystem(systemId);
    const control = await storage.getControl(controlId);
    
    if (!system || !control) {
      return res.status(404).json({ error: 'System or control not found' });
    }
    
    // Regenerate narrative
    const narrative = await narrativeGenerationService.regenerateControlNarrative(systemId, controlId);
    
    res.json({
      success: true,
      systemId,
      controlId,
      narrative
    });
  } catch (error) {
    console.error('Failed to regenerate control narrative:', error);
    res.status(500).json({ 
      error: 'Failed to regenerate narrative',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get control narrative
router.get('/systems/:systemId/controls/:controlId/narrative', validateAuth, async (req, res) => {
  try {
    const { systemId, controlId } = req.params;
    
    const systemControl = await storage.getSystemControl(systemId, controlId);
    if (!systemControl) {
      return res.status(404).json({ error: 'System control not found' });
    }
    
    res.json({
      success: true,
      narrative: {
        text: systemControl.implementationText || '',
        status: systemControl.status,
        lastUpdated: systemControl.lastUpdated
      }
    });
  } catch (error) {
    console.error('Failed to get control narrative:', error);
    res.status(500).json({ 
      error: 'Failed to get narrative',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get narrative generation status
router.get('/status/:jobId', validateAuth, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const progress = narrativeGenerationProgress.get(jobId);
    if (!progress) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json({
      jobId,
      ...progress,
      elapsedTime: progress.endTime 
        ? progress.endTime.getTime() - progress.startTime.getTime() 
        : Date.now() - progress.startTime.getTime()
    });
  } catch (error) {
    console.error('Failed to get narrative generation status:', error);
    res.status(500).json({ 
      error: 'Failed to get status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all narratives for a system
router.get('/systems/:systemId/narratives', validateAuth, async (req, res) => {
  try {
    const { systemId } = req.params;
    
    const systemControls = await storage.getSystemControls(systemId);
    const narratives = systemControls
      .filter(sc => sc.implementationText)
      .map(sc => ({
        controlId: sc.controlId,
        controlTitle: sc.control.title,
        narrative: sc.implementationText,
        status: sc.status,
        lastUpdated: sc.lastUpdated
      }));
    
    res.json({
      success: true,
      systemId,
      totalControls: systemControls.length,
      narrativesGenerated: narratives.length,
      narratives
    });
  } catch (error) {
    console.error('Failed to get system narratives:', error);
    res.status(500).json({ 
      error: 'Failed to get narratives',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Generate AI narrative for a specific control
router.post('/generate', validateAuth, async (req, res) => {
  try {
    const { systemId, controlId, customPrompt, includeGuidance } = req.body;
    
    // Verify system and control exist
    const system = await storage.getSystem(systemId);
    const control = await storage.getControl(controlId);
    
    if (!system || !control) {
      return res.status(404).json({ error: 'System or control not found' });
    }
    
    // Get system control if it exists
    const systemControl = await storage.getSystemControl(systemId, controlId);
    
    // Get evidence and artifacts for context
    const evidence = await storage.getEvidenceByControl(controlId);
    const artifacts = await storage.getArtifactsBySystem(systemId);
    const findings = await storage.getFindingsBySystem(systemId);
    
    // Build context for narrative generation
    const context = {
      system,
      control,
      systemControl,
      evidence,
      artifacts,
      findings,
      customPrompt,
      includeGuidance
    };
    
    // Generate narrative using the service
    const generatedNarrative = await narrativeGenerationService.generateContextAwareNarrative(context);
    
    res.json({
      success: true,
      ...generatedNarrative
    });
  } catch (error) {
    console.error('Failed to generate narrative:', error);
    res.status(500).json({ 
      error: 'Failed to generate narrative',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
