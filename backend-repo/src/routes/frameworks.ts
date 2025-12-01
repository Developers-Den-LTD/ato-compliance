import { Router } from 'express';
import { db } from '../db';
import { controls } from "../schema";
import { eq, sql, count } from 'drizzle-orm';

const router = Router();

// GET /api/frameworks - Get available frameworks and their stats
router.get('/', async (req, res) => {
  try {
    // Get framework statistics
    const frameworkStats = await db
      .select({
        framework: controls.framework,
        controlCount: count(controls.id),
        families: sql<string[]>`array_agg(DISTINCT ${controls.family})`.as('families')
      })
      .from(controls)
      .groupBy(controls.framework);

    // Get baseline statistics for each framework
    const baselineStats = await db
      .select({
        framework: controls.framework,
        baseline: sql<string>`unnest(${controls.baseline})`.as('baseline'),
        count: sql<number>`count(*)`.as('count')
      })
      .from(controls)
      .groupBy(controls.framework, sql`unnest(${controls.baseline})`);

    // Organize baseline stats by framework
    const baselinesByFramework = baselineStats.reduce((acc, stat) => {
      if (!acc[stat.framework]) {
        acc[stat.framework] = [];
      }
      acc[stat.framework].push({
        baseline: stat.baseline,
        count: stat.count
      });
      return acc;
    }, {} as Record<string, Array<{baseline: string, count: number}>>);

    // Build comprehensive framework info
    const frameworks = frameworkStats.map(stat => ({
      id: stat.framework,
      name: getFrameworkDisplayName(stat.framework),
      description: getFrameworkDescription(stat.framework),
      version: getFrameworkVersion(stat.framework),
      controlCount: stat.controlCount,
      families: stat.families.sort(),
      baselines: baselinesByFramework[stat.framework] || [],
      isActive: true
    }));

    res.json({
      success: true,
      frameworks: frameworks.sort((a, b) => a.name.localeCompare(b.name))
    });

  } catch (error) {
    console.error('Error fetching frameworks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch frameworks'
    });
  }
});

// GET /api/frameworks/:frameworkId - Get detailed framework information
router.get('/:frameworkId', async (req, res) => {
  try {
    const { frameworkId } = req.params;

    // Get framework summary
    const frameworkSummary = await db
      .select({
        framework: controls.framework,
        controlCount: count(controls.id)
      })
      .from(controls)
      .where(eq(controls.framework, frameworkId))
      .groupBy(controls.framework);

    if (frameworkSummary.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Framework not found'
      });
    }

    // Get family breakdown
    const familyStats = await db
      .select({
        family: controls.family,
        count: count(controls.id)
      })
      .from(controls)
      .where(eq(controls.framework, frameworkId))
      .groupBy(controls.family)
      .orderBy(controls.family);

    // Get baseline breakdown
    const baselineStats = await db
      .select({
        baseline: sql<string>`unnest(${controls.baseline})`.as('baseline'),
        count: sql<number>`count(*)`.as('count')
      })
      .from(controls)
      .where(eq(controls.framework, frameworkId))
      .groupBy(sql`unnest(${controls.baseline})`);

    res.json({
      success: true,
      framework: {
        id: frameworkId,
        name: getFrameworkDisplayName(frameworkId),
        description: getFrameworkDescription(frameworkId),
        version: getFrameworkVersion(frameworkId),
        controlCount: frameworkSummary[0].controlCount,
        families: familyStats,
        baselines: baselineStats,
        isActive: true
      }
    });

  } catch (error) {
    console.error('Error fetching framework details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch framework details'
    });
  }
});

// Helper functions for framework metadata
function getFrameworkDisplayName(frameworkId: string): string {
  const names: Record<string, string> = {
    'NIST-800-53': 'NIST 800-53',
    'FedRAMP': 'FedRAMP',
    'ISO-27001': 'ISO 27001',
    'CIS-Controls': 'CIS Controls',
    'PCI-DSS': 'PCI DSS',
    'SOC-2': 'SOC 2'
  };
  return names[frameworkId] || frameworkId;
}

function getFrameworkDescription(frameworkId: string): string {
  const descriptions: Record<string, string> = {
    'NIST-800-53': 'Security and Privacy Controls for Federal Information Systems and Organizations',
    'FedRAMP': 'Federal Risk and Authorization Management Program - Cloud Security for Government',
    'ISO-27001': 'International Standard for Information Security Management Systems',
    'CIS-Controls': 'Center for Internet Security Critical Security Controls',
    'PCI-DSS': 'Payment Card Industry Data Security Standard',
    'SOC-2': 'Service Organization Control 2 - Security, Availability, and Confidentiality'
  };
  return descriptions[frameworkId] || 'Security control framework';
}

function getFrameworkVersion(frameworkId: string): string {
  const versions: Record<string, string> = {
    'NIST-800-53': 'Rev 5',
    'FedRAMP': 'Rev 5',
    'ISO-27001': '2022',
    'CIS-Controls': 'v8',
    'PCI-DSS': 'v4.0',
    'SOC-2': '2017'
  };
  return versions[frameworkId] || '';
}

export default router;
