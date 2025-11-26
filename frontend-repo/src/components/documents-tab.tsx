import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SystemDocuments } from './system-documents';
import { DocumentProcessor } from './document-processor';
import { EvidenceUploadManager } from './evidence-upload-manager';
import { DocumentGenerator } from './document-generator';
import { FileText, Brain, Upload, FileDown } from 'lucide-react';

interface DocumentsTabProps {
  systemId: string;
}

export function DocumentsTab({ systemId }: DocumentsTabProps) {
  return (
    <Tabs defaultValue="generate" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="generate">
          <FileDown className="h-4 w-4 mr-2" />
          Generate SSP
        </TabsTrigger>
        <TabsTrigger value="documents">
          <FileText className="h-4 w-4 mr-2" />
          Generated Documents
        </TabsTrigger>
        <TabsTrigger value="evidence">
          <Upload className="h-4 w-4 mr-2" />
          Evidence & Artifacts
        </TabsTrigger>
        <TabsTrigger value="processing">
          <Brain className="h-4 w-4 mr-2" />
          Document Processing
        </TabsTrigger>
      </TabsList>

      <TabsContent value="generate" className="space-y-4">
        <DocumentGenerator systemId={systemId} />
      </TabsContent>

      <TabsContent value="documents" className="space-y-4">
        <SystemDocuments systemId={systemId} />
      </TabsContent>

      <TabsContent value="evidence" className="space-y-4">
        <EvidenceUploadManager systemId={systemId} />
      </TabsContent>

      <TabsContent value="processing" className="space-y-4">
        <DocumentProcessor systemId={systemId} />
      </TabsContent>
    </Tabs>
  );
}