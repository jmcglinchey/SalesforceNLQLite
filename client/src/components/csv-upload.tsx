import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface UploadStatus {
  message: string;
  recordsProcessed?: number;
  totalRows?: number;
  fieldCount?: number;
}

interface CSVUploadProps {
  onUploadComplete: () => void;
}

export default function CSVUpload({ onUploadComplete }: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError('File size must be less than 50MB');
      return;
    }

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);

    try {
      const formData = new FormData();
      formData.append('csvFile', file);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await apiRequest('POST', '/api/upload-csv', formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      setUploadStatus(result);
      
      toast({
        title: "Upload successful",
        description: `Processed ${result.recordsProcessed} records from ${result.totalRows} rows`,
      });

      onUploadComplete();

    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : 'Failed to upload CSV file',
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetUpload = () => {
    setUploadStatus(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload Salesforce Data</span>
        </CardTitle>
        <CardDescription>
          Upload a CSV file containing your Salesforce field metadata to start querying
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!uploadStatus && !error && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-900 mb-2">
              Drop your CSV file here
            </p>
            <p className="text-sm text-slate-600 mb-4">
              or click to browse and select a file
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="mx-auto"
            >
              Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {isUploading && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Upload className="h-4 w-4 animate-pulse" />
              <span className="text-sm font-medium">Uploading and processing...</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={resetUpload}>
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {uploadStatus && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <p className="font-medium">{uploadStatus.message}</p>
                <p className="text-sm text-slate-600">
                  Processed {uploadStatus.recordsProcessed} valid records from {uploadStatus.totalRows} total rows
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={resetUpload}>
                Upload Another
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-6 p-4 bg-slate-50 rounded-lg">
          <h4 className="text-sm font-medium text-slate-900 mb-2">Expected CSV Format:</h4>
          <div className="text-xs text-slate-600 space-y-1">
            <p><strong>Required columns:</strong> fieldLabel, fieldApiName, objectLabel, objectApiName, dataType</p>
            <p><strong>Optional columns:</strong> description, helpText, formula, picklistValues, tags, isRequired, isCustom</p>
            <p><strong>Example:</strong> fieldLabel,fieldApiName,objectLabel,objectApiName,dataType,description</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}