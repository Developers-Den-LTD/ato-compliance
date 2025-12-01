import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Upload, Download, AlertCircle, FileSpreadsheet, FileJson } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ControlImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ControlImportDialog({ open, onOpenChange }: ControlImportDialogProps) {
  const [importData, setImportData] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [errors, setErrors] = useState<string[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('excel');
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: async (data: { controls: any[], mode: 'merge' | 'replace' }) => {
      const response = await apiRequest('POST', '/api/controls/import', data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      alert(`Successfully imported ${data.imported} controls and updated ${data.updated} controls.`);
      onOpenChange(false);
      setImportData('');
      setExcelFile(null);
      setErrors([]);
    },
    onError: (error: any) => {
      setErrors([error.response?.data?.details || 'Import failed']);
    },
  });

  const excelImportMutation = useMutation({
    mutationFn: async ({ file, mode }: { file: File, mode: 'merge' | 'replace' }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      
      const response = await apiRequest('POST', '/api/controls/import/excel', formData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
      alert(`Successfully imported ${data.imported} controls and updated ${data.updated} controls.`);
      onOpenChange(false);
      setExcelFile(null);
      setErrors([]);
    },
    onError: (error: any) => {
      setErrors([error.message || 'Excel import failed']);
    },
  });

  const handleJsonImport = () => {
    try {
      const parsed = JSON.parse(importData);
      let controls = [];
      
      if (Array.isArray(parsed)) {
        controls = parsed;
      } else if (parsed.controls && Array.isArray(parsed.controls)) {
        controls = parsed.controls;
      } else {
        throw new Error('Invalid format. Expected array of controls or object with controls array.');
      }

      importMutation.mutate({ controls, mode: importMode });
    } catch (error) {
      setErrors([error.message || 'Invalid JSON format']);
    }
  };

  const handleExcelImport = () => {
    if (!excelFile) {
      setErrors(['Please select an Excel file to import']);
      return;
    }
    excelImportMutation.mutate({ file: excelFile, mode: importMode });
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await apiRequest('GET', '/api/controls/template');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'controls-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrors(['Failed to download template']);
    }
  };

  const handleExportJson = async () => {
    try {
      const response = await apiRequest('GET', '/api/controls/export');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `controls-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrors(['Export failed']);
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await apiRequest('GET', '/api/controls/export');
      const data = await response.json();
      
      // Convert to Excel using the template format
      const excelData = data.controls.map((control: any) => ({
        'Control ID': control.id,
        'Family': control.family,
        'Title': control.title,
        'Description': control.description || '',
        'Baseline': Array.isArray(control.baseline) ? control.baseline.join(',') : '',
        'Priority': control.priority || '',
        'Framework': control.framework || 'NIST-800-53',
        'Enhancement': control.enhancement || '',
        'Supplemental Guidance': control.supplemental_guidance || '',
        'Significance': control.significance || ''
      }));

      // Create a simple CSV for now (Excel can open CSV)
      const headers = Object.keys(excelData[0]);
      const csv = [
        headers.join(','),
        ...excelData.map(row => 
          headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') 
              ? `"${value}"` 
              : value;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `controls-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      setErrors(['Export failed']);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import/Export Controls</DialogTitle>
          <DialogDescription>
            Import new controls or export existing ones. Excel format is recommended for ease of use.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="excel">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel Import/Export
            </TabsTrigger>
            <TabsTrigger value="json">
              <FileJson className="w-4 h-4 mr-2" />
              JSON Import/Export
            </TabsTrigger>
          </TabsList>

          <TabsContent value="excel" className="space-y-4">
            {/* Export Section */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Export Controls</h3>
              <div className="flex gap-2">
                <Button onClick={handleExportExcel} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export to CSV/Excel
                </Button>
                <Button onClick={handleDownloadTemplate} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download Import Template
                </Button>
              </div>
            </div>

            {/* Import Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold">Import Controls</h3>
              
              {/* Upload File */}
              <div>
                <Label htmlFor="excel-file">Select Excel/CSV File</Label>
                <Input
                  id="excel-file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  className="mt-2 cursor-pointer"
                />
                {excelFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {excelFile.name}
                  </p>
                )}
              </div>

              {/* Import Mode */}
              <div>
                <Label>Import Mode</Label>
                <RadioGroup
                  value={importMode}
                  onValueChange={(value) => setImportMode(value as 'merge' | 'replace')}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="merge" id="merge-excel" />
                    <Label htmlFor="merge-excel" className="font-normal">
                      Merge - Add new controls and update existing ones
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="replace" id="replace-excel" />
                    <Label htmlFor="replace-excel" className="font-normal">
                      Replace - Delete all existing controls and import new ones
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Import Button */}
              <Button
                onClick={handleExcelImport}
                disabled={!excelFile || excelImportMutation.isPending}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {excelImportMutation.isPending ? 'Importing...' : 'Import from Excel'}
              </Button>
            </div>

            {/* Excel Format Info */}
            <Alert>
              <AlertDescription>
                <strong>Excel Format Columns:</strong>
                <ul className="list-disc list-inside mt-2 text-sm">
                  <li>Control ID (required) - e.g., AC-1</li>
                  <li>Family (required) - e.g., Access Control</li>
                  <li>Title (required) - Control title</li>
                  <li>Description - Detailed description</li>
                  <li>Baseline - Comma-separated: low,moderate,high</li>
                  <li>Priority - P1, P2, or P3</li>
                  <li>Framework - Default: NIST-800-53</li>
                  <li>Significance - Numeric value</li>
                </ul>
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="json" className="space-y-4">
            {/* Export Section */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3">Export Controls</h3>
              <Button onClick={handleExportJson} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export to JSON
              </Button>
            </div>

            {/* Import Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold">Import Controls</h3>

              {/* Import Mode */}
              <div>
                <Label>Import Mode</Label>
                <RadioGroup
                  value={importMode}
                  onValueChange={(value) => setImportMode(value as 'merge' | 'replace')}
                  className="mt-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="merge" id="merge-json" />
                    <Label htmlFor="merge-json" className="font-normal">
                      Merge - Add new controls and update existing ones
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="replace" id="replace-json" />
                    <Label htmlFor="replace-json" className="font-normal">
                      Replace - Delete all existing controls and import new ones
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* JSON Input */}
              <div>
                <Label htmlFor="import-data">Control Data (JSON)</Label>
                <Textarea
                  id="import-data"
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Paste your controls JSON here..."
                  className="mt-2 font-mono text-sm"
                  rows={10}
                />
              </div>

              {/* Import Button */}
              <Button
                onClick={handleJsonImport}
                disabled={!importData || importMutation.isPending}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" />
                {importMutation.isPending ? 'Importing...' : 'Import from JSON'}
              </Button>
            </div>

            {/* JSON Format Example */}
            <Alert>
              <AlertDescription>
                <strong>Expected JSON Format:</strong>
                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
{`{
  "controls": [
    {
      "id": "AC-1",
      "family": "Access Control",
      "title": "Access Control Policy and Procedures",
      "description": "The organization develops...",
      "baseline": ["low", "moderate", "high"],
      "priority": "P1",
      "framework": "NIST-800-53"
    }
  ]
}`}
                </pre>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {/* Error Display */}
        {errors.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errors.map((error, i) => (
                <div key={i}>{error}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}