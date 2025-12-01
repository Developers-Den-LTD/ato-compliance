import { Router } from 'express';
import { db } from '../db';
import { stigRules } from '../schema';
import { sql, eq } from 'drizzle-orm';
import { authenticate as authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/assessment/stig/profiles
 * Get available STIG profiles for system registration
 */
router.get('/stig/profiles', authenticateToken, async (req, res) => {
  try {
    const { category } = req.query;
    
    // Get distinct STIG profiles from existing rules
    const profilesQuery = await db.execute<{
      stig_id: string;
      stig_title: string;
      version: string;
      rule_count: number;
    }>(sql`
      SELECT 
        stig_id,
        stig_title,
        version,
        COUNT(*) as rule_count
      FROM ${stigRules}
      WHERE rule_type = 'stig'
      GROUP BY stig_id, stig_title, version
      ORDER BY stig_id
    `);
    
    // Helper function to categorize STIG profiles
    const categorizeProfile = (stigId: string): string => {
      const id = (stigId || '').toUpperCase();
      if (id.includes('WEB') || id.includes('DATABASE') || id.includes('APP')) {
        return 'Application';
      } else if (id.includes('WINDOWS') || id.includes('RHEL') || id.includes('UBUNTU') || id.includes('LINUX')) {
        return 'Operating System';
      } else if (id.includes('ROUTER') || id.includes('SWITCH') || id.includes('FIREWALL')) {
        return 'Network Device';
      } else if (id.includes('IOS') || id.includes('ANDROID') || id.includes('MOBILE')) {
        return 'Mobile Device';
      } else if (id.includes('AWS') || id.includes('AZURE') || id.includes('CLOUD')) {
        return 'Cloud';
      }
      return 'Other';
    };
    
    // Format for frontend with categories
    const profiles = Array.isArray(profilesQuery) ? profilesQuery : [];
    let formattedProfiles = profiles.map((profile: any) => ({
      stig_id: profile.stig_id,
      stig_title: profile.stig_title || `STIG Profile ${profile.stig_id}`,
      version: profile.version || '1.0',
      category: categorizeProfile(profile.stig_id),
      rule_count: Number(profile.rule_count)
    }));
    
    // Filter by category if provided
    if (category && typeof category === 'string') {
      formattedProfiles = formattedProfiles.filter(p => 
        p.category.toLowerCase() === category.toLowerCase()
      );
    }
    
    res.json(formattedProfiles);
    
  } catch (error) {
    console.error('Error fetching STIG profiles:', error);
    res.status(500).json({ error: 'Failed to fetch STIG profiles' });
  }
});

/**
 * GET /api/assessment/stig/rules/:stigId
 * Get all rules for a specific STIG profile
 */
router.get('/stig/rules/:stigId', authenticateToken, async (req, res) => {
  try {
    const { stigId } = req.params;
    
    const rules = await db
      .select()
      .from(stigRules)
      .where(eq(stigRules.stigId, stigId));
    
    res.json(rules);
    
  } catch (error) {
    console.error('Error fetching STIG rules:', error);
    res.status(500).json({ error: 'Failed to fetch STIG rules' });
  }
});

/**
 * POST /api/assessment/stig/import
 * Import STIG rules from XCCDF file
 * Note: This is a placeholder endpoint. Full implementation requires xml2js and file upload support.
 */
router.post('/stig/import', authenticateToken, async (req, res) => {
  try {
    // For now, return a message indicating the feature is not yet implemented
    res.status(501).json({ 
      error: 'STIG import not yet implemented',
      message: 'This feature requires additional dependencies (multer, xml2js) to be installed.',
      suggestion: 'Please use the database seeding scripts to import STIG data, or install the required dependencies.'
    });
    
  } catch (error) {
    console.error('Error importing STIG:', error);
    res.status(500).json({ error: 'Failed to import STIG' });
  }
});

/**
 * GET /api/assessment/stig/stats
 * Get STIG statistics
 */
router.get('/stig/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await db.execute<{
      total_profiles: number;
      total_rules: number;
      total_jsig_rules: number;
    }>(sql`
      SELECT 
        COUNT(DISTINCT stig_id) as total_profiles,
        COUNT(CASE WHEN rule_type = 'stig' THEN 1 END) as total_rules,
        COUNT(CASE WHEN rule_type = 'jsig' THEN 1 END) as total_jsig_rules
      FROM ${stigRules}
    `);
    
    const result = Array.isArray(stats) ? stats[0] : { total_profiles: 0, total_rules: 0, total_jsig_rules: 0 };
    
    res.json({
      totalProfiles: Number(result.total_profiles || 0),
      totalRules: Number(result.total_rules || 0),
      totalJsigRules: Number(result.total_jsig_rules || 0)
    });
    
  } catch (error) {
    console.error('Error fetching STIG stats:', error);
    res.status(500).json({ error: 'Failed to fetch STIG stats' });
  }
});

export default router;
