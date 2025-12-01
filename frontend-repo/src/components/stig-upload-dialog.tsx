import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';

interface STIGUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: () => void;
}

interface UploadProgress {
  status: 'idle' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  message: string;
  result?: {
    imported: number;
    skipped: number;
    errors?: string[];
  };
}

export function STIGUploadDialog({ open, onOpenChange, onUploadComplete }: STIGUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [stigType, setStigType] = useState<string>('');
  const [impactLevel, setImpactLevel] = useState<string>('');
  const [ruleType, setRuleType] = useState<'stig' | 'jsig'>('stig');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    status: 'idle',
    progress: 0,
    message: ''
  });
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadProgress({ status: 'idle', progress: 0, message: '' });
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !stigType || !impactLevel) {
      toast({
        title: "Missing Information",
        description: "Please select a file, STIG type, and impact level.",
        variant: "destructive"
      });
      return;
    }

    setUploadProgress({
      status: 'uploading',
      progress: 10,
      message: 'Uploading STIG file...'
    });

    try {
      const formData = new FormData();
      formData.append('stigFile', selectedFile);
      formData.append('stigType', stigType);
      formData.append('impactLevel', impactLevel);
      formData.append('ruleType', ruleType);

      setUploadProgress({
        status: 'uploading',
        progress: 30,
        message: 'Processing file...'
      });

      const response = await apiRequest('POST', '/api/assessment/stig/import', formData);

      setUploadProgress({
        status: 'processing',
        progress: 60,
        message: 'Importing STIG rules...'
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      setUploadProgress({
        status: 'success',
        progress: 100,
        message: 'Import completed successfully!',
        result
      });

      toast({
        title: "STIG Import Successful",
        description: `Imported ${result.imported} rules, skipped ${result.skipped} duplicates.`
      });

      // Call completion callback after a short delay
      setTimeout(() => {
        onUploadComplete?.();
        handleReset();
      }, 2000);

    } catch (error) {
      console.error('STIG upload error:', error);
      setUploadProgress({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Upload failed'
      });

      toast({
        title: "STIG Import Failed",
        description: "Failed to import STIG file. Please check the file format and try again.",
        variant: "destructive"
      });
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setStigType('');
    setImpactLevel('');
    setRuleType('stig');
    setUploadProgress({ status: 'idle', progress: 0, message: '' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleClose = () => {
    if (uploadProgress.status !== 'uploading' && uploadProgress.status !== 'processing') {
      onOpenChange(false);
      handleReset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import STIG/JSIG Rules
          </DialogTitle>
          <DialogDescription>
            Upload STIG or JSIG documents to import security rules and map them to NIST 800-53 controls.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Select STIG/JSIG File</CardTitle>
              <CardDescription>
                Supported formats: JSON, XML, XCCDF, CKL, or CKLB files from DISA STIG repositories and STIG Viewer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="stig-file">Upload File</Label>
                  <Input
                    id="stig-file"
                    type="file"
                    accept=".json,.xml,.xccdf,.ckl,.cklb"
                    onChange={handleFileSelect}
                    disabled={uploadProgress.status === 'uploading' || uploadProgress.status === 'processing'}
                  />
                </div>
                
                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Configuration Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Configure Import Settings</CardTitle>
              <CardDescription>
                Specify the STIG type and impact level for proper rule classification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="stig-type">STIG Type</Label>
                  <Select value={stigType} onValueChange={setStigType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select STIG type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RHEL-8-STIG">Red Hat Enterprise Linux 8</SelectItem>
                      <SelectItem value="WIN-19-STIG">Windows 19 Server</SelectItem>
                      <SelectItem value="WIN-10-STIG">Windows 10</SelectItem>
                      <SelectItem value="UBUNTU-20-STIG">Ubuntu 20.04 LTS</SelectItem>
                      <SelectItem value="CISCO-IOS-STIG">Cisco IOS</SelectItem>
                      <SelectItem value="GENERAL-STIG">General Application</SelectItem>
                      <SelectItem value="CUSTOM">Custom STIG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="impact-level">Impact Level</Label>
                  <Select value={impactLevel} onValueChange={setImpactLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select impact level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="rule-type">Rule Type</Label>
                  <Select value={ruleType} onValueChange={(value: 'stig' | 'jsig') => setRuleType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stig">STIG (Security Technical Implementation Guide)</SelectItem>
                      <SelectItem value="jsig">JSIG (Joint STIG Implementation Guide)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upload Progress */}
          {uploadProgress.status !== 'idle' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {uploadProgress.status === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {uploadProgress.status === 'error' && <AlertCircle className="h-5 w-5 text-red-600" />}
                  {(uploadProgress.status === 'uploading' || uploadProgress.status === 'processing') && (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  )}
                  Import Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Progress value={uploadProgress.progress} className="w-full" />
                  <p className="text-sm text-muted-foreground">{uploadProgress.message}</p>
                  
                  {uploadProgress.result && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg">
                      <div>
                        <span className="text-sm font-medium">Imported: </span>
                        <span className="text-sm text-green-600">{uploadProgress.result.imported}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">Skipped: </span>
                        <span className="text-sm text-yellow-600">{uploadProgress.result.skipped}</span>
                      </div>
                    </div>
                  )}
                  
                  {uploadProgress.result?.errors && uploadProgress.result.errors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-800 mb-2">Import Errors:</p>
                      <ul className="text-sm text-red-700 space-y-1">
                        {uploadProgress.result.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploadProgress.status === 'uploading' || uploadProgress.status === 'processing'}
            >
              {uploadProgress.status === 'success' ? 'Close' : 'Cancel'}
            </Button>
            
            <div className="flex gap-2">
              {uploadProgress.status !== 'idle' && uploadProgress.status !== 'success' && (
                <Button variant="outline" onClick={handleReset}>
                  <X className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              )}
              
              <Button
                onClick={handleUpload}
                disabled={
                  !selectedFile || 
                  !stigType || 
                  !impactLevel || 
                  uploadProgress.status === 'uploading' || 
                  uploadProgress.status === 'processing' ||
                  uploadProgress.status === 'success'
                }
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadProgress.status === 'uploading' || uploadProgress.status === 'processing' 
                  ? 'Importing...' 
                  : 'Import STIG'
                }
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}