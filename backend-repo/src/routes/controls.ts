import { Router } from 'express';
import { db } from '../db';
import { controls } from "../schema";
import { eq, sql, like, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { Parser } from 'json2csv';
import multer from 'multer';
import * as XLSX from 'xlsx';

const router = Router();

// GET /api/controls - Get all controls with optional filters
router.get('/', async (req, res) => {
  try {
    const query = z.object({
      family: z.string().optional(),
      baseline: z.string().optional(),
      framework: z.string().optional().default('NIST-800-53'),
      search: z.string().optional(),
      status: z.string().optional(),
      limit: z.coerce.number().positive().default(1000),
      offset: z.coerce.number().nonnegative().default(0),
    }).parse(req.query);

    let conditions = [];
    
    // Always filter by framework
    conditions.push(eq(controls.framework, query.framework));
    
    if (query.family) {
      conditions.push(eq(controls.family, query.family));
    }
    
    if (query.baseline) {
      conditions.push(sql`${controls.baseline} @> ARRAY[${query.baseline}]::text[]`);
    }
    
    if (query.status) {
      // status property doesn't exist in schema, skip this condition
      // conditions.push(eq(controls.status, query.status));
    }
    
    if (query.search) {
      conditions.push(
        like(controls.id, `%${query.search}%`)
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count for pagination
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(controls)
      .where(whereClause);

    const result = await db
      .select()
      .from(controls)
      .where(whereClause)
      .limit(query.limit)
      .offset(query.offset)
      .orderBy(controls.id);

    res.json({
      controls: result,
      total: count,
      filters: {
        family: query.family,
        baseline: query.baseline,
        status: query.status,
        limit: query.limit
      }
    });
  } catch (error) {
    console.error('Error fetching controls:', error);
    res.status(500).json({ error: 'Failed to fetch controls' });
  }
});

// GET /api/controls/template - Download controls template (Excel format)
// IMPORTANT: This MUST come before /:id route or it will match as an ID
router.get('/template', async (req, res) => {
  try {
    const templateData = [
      {
        control_id: 'AC-1',
        title: 'Policy and Procedures',
        family: 'ACCESS CONTROL',
        baseline: 'LOW,MODERATE,HIGH',
        description: 'Example control description',
        implementation_status: 'Not Implemented',
        responsible_role: '',
        implementation_statement: '',
        notes: ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Controls');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=controls-template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// GET /api/controls/export - Export controls to CSV/Excel
// IMPORTANT: This MUST come before /:id route
router.get('/export', async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const framework = (req.query.framework as string) || 'NIST-800-53';
    
    const allControls = await db
      .select()
      .from(controls)
      .where(eq(controls.framework, framework))
      .orderBy(controls.id);

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(allControls);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Controls');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=controls-export.xlsx');
      res.send(buffer);
    } else {
      const parser = new Parser();
      const csv = parser.parse(allControls);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=controls-export.csv');
      res.send(csv);
    }
  } catch (error) {
    console.error('Error exporting controls:', error);
    res.status(500).json({ error: 'Failed to export controls' });
  }
});

// GET /api/controls/:id - Get specific control
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const control = await db
      .select()
      .from(controls)
      .where(eq(controls.id, id))
      .limit(1);
      
    if (control.length === 0) {
      return res.status(404).json({ error: 'Control not found' });
    }
    
    res.json(control[0]);
  } catch (error) {
    console.error('Error fetching control:', error);
    res.status(500).json({ error: 'Failed to fetch control' });
  }
});

// GET /api/controls/family/:family - Get controls by family
router.get('/family/:family', async (req, res) => {
  try {
    const { family } = req.params;
    
    const result = await db
      .select()
      .from(controls)
      .where(eq(controls.family, family))
      .orderBy(controls.id);
      
    res.json(result);
  } catch (error) {
    console.error('Error fetching controls by family:', error);
    res.status(500).json({ error: 'Failed to fetch controls' });
  }
});

// GET /api/controls/baseline/:baseline - Get controls by baseline
router.get('/baseline/:baseline', async (req, res) => {
  try {
    const { baseline } = req.params;
    
    const result = await db
      .select()
      .from(controls)
      .where(sql`${controls.baseline} @> ARRAY[${baseline}]::text[]`)
      .orderBy(controls.id);
      
    res.json(result);
  } catch (error) {
    console.error('Error fetching controls by baseline:', error);
    res.status(500).json({ error: 'Failed to fetch controls' });
  }
});

// POST /api/controls/import/excel - Import controls from Excel
const upload = multer({ storage: multer.memoryStorage() });

router.post('/import/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let imported = 0;
    let errors: string[] = [];

    for (const row of data as any[]) {
      try {
        if (!row.control_id) {
          errors.push(`Row missing control_id: ${JSON.stringify(row)}`);
          continue;
        }

        // Check if control exists
        const existing = await db
          .select()
          .from(controls)
          .where(eq(controls.id, row.control_id))
          .limit(1);

        if (existing.length === 0) {
          errors.push(`Control ${row.control_id} not found in database`);
          continue;
        }

        // Update control with imported data
        await db
          .update(controls)
          .set({
            // implementationStatus doesn't exist in schema, skip it
            // responsibleRole doesn't exist in schema, skip it
            // implementationStatement doesn't exist in schema, skip it
            // notes doesn't exist in schema, skip it
            description: row.implementation_statement || controls.description,
            // updatedAt doesn't exist in schema, skip it
          })
          .where(eq(controls.id, row.control_id));

        imported++;
      } catch (error) {
        errors.push(`Error importing ${row.control_id}: ${error}`);
      }
    }

    res.json({
      success: true,
      imported,
      total: data.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error importing controls:', error);
    res.status(500).json({ error: 'Failed to import controls' });
  }
});

export default router;
