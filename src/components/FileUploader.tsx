import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

interface FileUploaderProps {
  onFileUpload: (file: File) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
}

export function FileUploader({ 
  onFileUpload, 
  acceptedFileTypes = ['.csv', '.xlsx', '.xls'],
  maxFileSize = 5 * 1024 * 1024 // 5MB default
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{headers: string[]; rows: string[][]} | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > maxFileSize) {
      setError(`File size exceeds ${maxFileSize / 1024 / 1024}MB limit`);
      return false;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(fileExtension)) {
      setError(`File type not supported. Please upload: ${acceptedFileTypes.join(', ')}`);
      return false;
    }

    return true;
  };

  const handleFileRead = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\\n');
      const headers = lines[0].split(',');
      const previewRows = lines.slice(1, 6).map(line => line.split(','));
      
      setPreview({
        headers,
        rows: previewRows
      });
      
      onFileUpload(file);
      setError(null);
    } catch (err) {
      setError('Error reading file. Please try again.');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) {
      handleFileRead(file);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      handleFileRead(file);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8
          flex flex-col items-center justify-center space-y-4
          transition-colors duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
        `}
      >
        <Upload className="w-12 h-12 text-gray-400" />
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Drag and drop your file here, or{' '}
            <label className="text-blue-500 hover:text-blue-700 cursor-pointer">
              browse
              <input
                type="file"
                className="hidden"
                accept={acceptedFileTypes.join(',')}
                onChange={handleFileInput}
              />
            </label>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Supported formats: {acceptedFileTypes.join(', ')} (up to {maxFileSize / 1024 / 1024}MB)
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {preview && (
        <div className="border rounded-lg">
          <div className="p-4 border-b bg-muted">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Data Preview</h3>
            </div>
          </div>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.headers.map((header, i) => (
                    <TableHead key={i}>{header}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row, i) => (
                  <TableRow key={i}>
                    {row.map((cell, j) => (
                      <TableCell key={j}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}