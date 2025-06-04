import { useState, useRef } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface UploadStatus {
  message: string;
  recordsProcessed?: number;
  totalRows?: number;
  objectCount?: number;
}

interface ObjectCSVUploadProps {
  onUploadComplete: () => void;
}

export default function ObjectCSVUpload({ onUploadComplete }: ObjectCSVUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please select a CSV file');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      const response = await fetch('/api/upload-objects-csv', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Upload failed');
      }

      setUploadStatus(result);
      toast({
        title: "Objects uploaded successfully",
        description: `Processed ${result.recordsProcessed} Salesforce objects`,
      });
      
      onUploadComplete();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
      <CardHeader>
        <CardTitle className="flex items-center text-blue-900 dark:text-blue-100">
          <Database className="h-5 w-5 mr-2" />
          Upload Salesforce Objects CSV
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30'
              : 'border-blue-300 dark:border-blue-600'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-2">
                Upload Objects Data
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                Drag and drop your Salesforce Objects CSV file here, or click to browse
              </p>
              
              <Button 
                onClick={triggerFileSelect}
                disabled={isUploading}
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900/30"
              >
                <FileText className="h-4 w-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Choose File'}
              </Button>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Expected Format Info */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Expected CSV Format:</h4>
          <p className="text-xs text-blue-700 dark:text-blue-300 font-mono">
            Label, ApiName, Description, PluralLabel, KeyPrefix, IsCustom, Tags, SharingModel
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Example: Account, Account, Stores company information, Accounts, 001, FALSE, Sales, ReadWrite
          </p>
        </div>

        {/* Upload Status */}
        {uploadStatus && (
          <Alert className="mt-4 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              {uploadStatus.message}
              {uploadStatus.recordsProcessed && (
                <div className="mt-2 text-sm">
                  <p>Records processed: {uploadStatus.recordsProcessed}</p>
                  <p>Total rows: {uploadStatus.totalRows}</p>
                  <p>Objects added: {uploadStatus.objectCount}</p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Upload Error */}
        {uploadError && (
          <Alert className="mt-4 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}