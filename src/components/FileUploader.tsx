import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';

interface FileUploaderProps {
  onFileUpload: (file: File, parsed?: { headers: string[]; rows: string[][] }) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
}

export function FileUploader({ 
  onFileUpload, 
  acceptedFileTypes = ['.csv', '.xlsx', '.xls', '.h5ad', '.h5'],
  maxFileSize = 1000 * 1024 * 1024
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);

  /** =============================
   *  Detect + Validate File
   * ============================ */
  const validateFile = (file: File): boolean => {
    if (file.size > maxFileSize) {
      setError(`File size exceeds ${maxFileSize / 1024 / 1024}MB limit`);
      return false;
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(ext)) {
      setError(`File type not supported. Please upload: ${acceptedFileTypes.join(', ')}`);
      return false;
    }
    return true;
  };

  /** =============================
   *  CSV Parser (unchanged)
   * ============================ */
  const parseCSV = (text: string) => {
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim());
    const separator = ',';

    const formatNumber = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return '';
      const num = parseFloat(trimmed);
      if (isNaN(num)) return trimmed;
      if (Math.abs(num) < 0.001) return num.toExponential(4);
      if (Math.abs(num) > 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
      if (num === Math.floor(num)) return num.toString();
      return num.toFixed(6);
    };

    const parseRow = (row: string, isHeader: boolean) => {
      const cells = row.split(separator).map(cell => cell.trim());
      return isHeader ? cells : cells.map(formatNumber);
    };

    const headers = parseRow(lines[0], true);
    const rows = lines.slice(1, 6).map(line => parseRow(line, false));
    return { headers, rows };
  };

  /** =============================
   *  Main File Reader
   * ============================ */
const handleFileRead = async (file: File) => {
  try {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();

    if (ext === ".h5ad") {
      // 只上传到服务器，不在前端解析
      const formData = new FormData();
      formData.append("file", file);
      onFileUpload(file);
      setError(null);
      return;
    }

    // ---- handle CSV / XLS / XLSX ----
    const text = await file.text();
    const parsedData = parseCSV(text);
    setPreview(parsedData);
    onFileUpload(file, parsedData);
    setError(null);

  } catch (err) {
    console.error(err);
    setError('Error reading file. Please try again.');
  }
};


  /** =============================
   *  Upload Handlers
   * ============================ */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && validateFile(file)) handleFileRead(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) handleFileRead(file);
  };

  /** =============================
   *  UI
   * ============================ */
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.headers.map((header, i) => (
                      <TableHead key={i} className="whitespace-nowrap min-w-[150px] font-mono">
                        {header}
                      </TableHead>
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
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
