import { Router } from 'express';
import { db } from '../db';
import { systems, controls, assessments, findings, stigRules } from "../schema";
import { sql, eq } from 'drizzle-orm';

const router = Router();

// GET /api/analytics/dashboard - Get dashboard metrics
router.get('/dashboard', async (req, res) => {
  try {
    // Get system counts by status
    const systemsCountResult = await db
      .select({ 
        status: systems.complianceStatus,
        count: sql<number>`count(*)::int` 
      })
      .from(systems)
      .groupBy(systems.complianceStatus)
      .execute();

    // Get control implementation counts from system_controls (not controls table)
    // Controls table just has the control definitions, not implementation status
    const controlsCountResult = await db.execute<{status: string, count: number}>(
      sql`SELECT status, COUNT(*)::int as count FROM system_controls GROUP BY status`
    );

    // Get systems by impact level
    const systemsImpactResult = await db
      .select({
        impactLevel: systems.impactLevel,
        count: sql<number>`count(*)::int`
      })
      .from(systems)
      .groupBy(systems.impactLevel)
      .execute();

    // Get STIG/JSIG totals
    const stigRuleCounts = await db
      .select({
        ruleType: stigRules.ruleType,
        count: sql<number>`count(*)::int`
      })
      .from(stigRules)
      .groupBy(stigRules.ruleType)
      .execute();

    // Get finding counts by severity/status/rule type
    const findingsResult = await db
      .select({
        severity: findings.severity,
        status: findings.status,
        count: sql<number>`count(*)::int`
      })
      .from(findings)
      .groupBy(findings.severity, findings.status)
      .execute();

    // Get total counts
    const [totalSystems] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(systems)
      .execute();

    const [totalControls] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(controls)
      .execute();

    const [totalAssessments] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(assessments)
      .execute();

    // Format response
    const systemsStats = {
      total: Number(totalSystems?.count ?? 0),
      byComplianceStatus: {
        compliant: 0,
        'non-compliant': 0,
        'in-progress': 0,
        'not-assessed': 0,
      },
      byImpactLevel: {
        High: 0,
        Moderate: 0,
        Low: 0,
      },
    };

    systemsCountResult.forEach(row => {
      const count = Number(row.count);
      switch (row.status) {
        case 'compliant':
          systemsStats.byComplianceStatus.compliant = count;
          break;
        case 'non-compliant':
          systemsStats.byComplianceStatus['non-compliant'] = count;
          break;
        case 'in-progress':
          systemsStats.byComplianceStatus['in-progress'] = count;
          break;
        case 'not-assessed':
        case 'not-started':
          systemsStats.byComplianceStatus['not-assessed'] += count;
          break;
      }
    });

    systemsImpactResult.forEach(row => {
      const impact = (row.impactLevel ?? '').toLowerCase();
      const count = Number(row.count);
      if (impact === 'high') systemsStats.byImpactLevel.High = count;
      if (impact === 'moderate') systemsStats.byImpactLevel.Moderate = count;
      if (impact === 'low') systemsStats.byImpactLevel.Low = count;
    });

    const controlsStats = {
      total: Number(totalControls?.count ?? 0),
      implemented: 0,
      'partially-implemented': 0,
      'not-implemented': 0,
      notApplicable: 0,
      byRuleType: {
        stig: { total: 0, implemented: 0, 'partially-implemented': 0, 'not-implemented': 0 },
        jsig: { total: 0, implemented: 0, 'partially-implemented': 0, 'not-implemented': 0 },
      },
    };

    controlsCountResult.forEach(row => {
      const count = Number(row.count);
      switch (row.status) {
        case 'implemented':
          controlsStats.implemented += count;
          break;
        case 'partial':
          controlsStats['partially-implemented'] += count;
          break;
        case 'not_implemented':
          controlsStats['not-implemented'] += count;
          break;
        case 'not_applicable':
          controlsStats.notApplicable += count;
          break;
      }
    });

    stigRuleCounts.forEach(row => {
      const type = row.ruleType === 'jsig' ? 'jsig' : 'stig';
      const count = Number(row.count);
      controlsStats.byRuleType[type].total += count;
    });

    // Calculate compliance rate
    const totalImplementedControls = controlsStats.implemented + (controlsStats['partially-implemented'] * 0.5);
    const totalApplicableControls = totalControls?.count ? Number(totalControls.count) - controlsStats.notApplicable : 0;
    const complianceRate = totalApplicableControls > 0 ? 
      Math.round((totalImplementedControls / totalApplicableControls) * 100) : 0;

    const findingsStats = {
      total: 0,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        informational: 0,
      },
      byStatus: {
        open: 0,
        fixed: 0,
        accepted: 0,
        false_positive: 0,
      },
      byRuleType: {
        stig: { total: 0, critical: 0, high: 0, medium: 0, low: 0, informational: 0 },
        jsig: { total: 0, critical: 0, high: 0, medium: 0, low: 0, informational: 0 },
      },
    };

    findingsResult.forEach(row => {
      const count = Number(row.count);
      const severity = (row.severity ?? 'informational') as keyof typeof findingsStats.bySeverity;
      const status = (row.status ?? 'open') as keyof typeof findingsStats.byStatus;
      const ruleType = 'stig';

      findingsStats.total += count;
      if (findingsStats.bySeverity[severity] !== undefined) {
        findingsStats.bySeverity[severity] += count;
      }
      if (findingsStats.byStatus[status] !== undefined) {
        findingsStats.byStatus[status] += count;
      }
      findingsStats.byRuleType[ruleType].total += count;
      if (findingsStats.byRuleType[ruleType][severity] !== undefined) {
        findingsStats.byRuleType[ruleType][severity] += count;
      }
    });

    res.json({
      timestamp: new Date().toISOString(),
      overview: {
        totalSystems: systemsStats.total,
        totalControls: controlsStats.total,
        totalFindings: findingsStats.total,
        compliancePercentage: complianceRate,
      },
      systems: {
        total: systemsStats.total,
        byComplianceStatus: systemsStats.byComplianceStatus,
        byImpactLevel: systemsStats.byImpactLevel,
      },
      controls: controlsStats,
      findings: findingsStats,
      systemsCount: systemsStats.total,
      controlsCount: controlsStats.total,
      assessmentsCount: totalAssessments?.count ? Number(totalAssessments.count) : 0,
      complianceRate,
    });
    
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard analytics' });
  }
});

// GET /api/analytics/compliance/export - Export compliance report
router.get('/compliance/export', async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    
    // Get all systems with compliance data
    const systemsData = await db.select().from(systems);
    
    // Get system_controls data (which has status)
    const systemControlsData = await db.execute<{system_id: string, status: string}>(
      sql`SELECT system_id, status FROM system_controls`
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="compliance-report.csv"');
      
      // CSV header
      let csv = 'System Name,Category,Impact Level,Compliance Status,Total Controls,Implemented,Not Implemented\n';
      
      // Add system data
      for (const system of systemsData) {
        const systemControls = systemControlsData.filter(sc => sc.system_id === system.id);
        const implementedCount = systemControls.filter(c => c.status === 'implemented').length;
        const notImplementedCount = systemControls.filter(c => c.status === 'not_implemented').length;
        
        csv += `"${system.name}","${system.category}","${system.impactLevel}","${system.complianceStatus}",${systemControls.length},${implementedCount},${notImplementedCount}\n`;
      }
      
      res.send(csv);
    } else {
      res.status(400).json({ error: 'Unsupported export format' });
    }
    
  } catch (error) {
    console.error('Error exporting compliance report:', error);
    res.status(500).json({ error: 'Failed to export compliance report' });
  }
});

export default router;
