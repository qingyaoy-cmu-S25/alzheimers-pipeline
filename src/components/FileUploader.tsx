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

  const parseCSV = (text: string) => {
    // 处理不同的换行符
    console.log('text', text);
    
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n').filter(line => line.trim());
    console.log('after split lines:', lines);
    console.log('lines', lines);
    
    const separator = ',';  // 使用固定的逗号分隔符

    const formatNumber = (value: string) => {
      // 检查是否为数字
      const trimmed = value.trim();
      if (!trimmed) return '';
      
      const num = parseFloat(trimmed);
      if (isNaN(num)) return trimmed;
      
      // 根据数值大小选择合适的格式化方式
      if (Math.abs(num) < 0.001) {
        return num.toExponential(4);  // 非常小的数使用科学计数法
      } else if (Math.abs(num) > 1000) {
        return num.toLocaleString('en-US', { maximumFractionDigits: 2 }); // 大数使用千分位
      } else if (num === Math.floor(num)) {
        return num.toString(); // 整数
      } else {
        return num.toFixed(6); // 保持6位小数
      }
    };

    const parseRow = (row: string, isHeader: boolean) => {
      if (!row) return [];
      
      const cells = row.split(separator).map(cell => cell.trim());
      console.log('cells before format:', cells);
      
      // 如果是数据行（非表头），格式化数字
      if (!isHeader) {
        return cells.map(cell => {
          if (!cell) return '';
          return formatNumber(cell);
        });
      }
      
      return cells;
    };

    const headers = parseRow(lines[0], true);
    const rows = lines.slice(1, 6).map(line => parseRow(line, false));

    return { headers, rows };
  };

  const handleFileRead = async (file: File) => {
    try {
      const text = await file.text();
      
      const parsedData = parseCSV(text);
      setPreview(parsedData);
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {preview.headers.map((header, i) => (
                      <TableHead key={i} className="whitespace-nowrap min-w-[150px] font-mono">{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell 
                          key={j} 
                        //   className={`whitespace-nowrap font-mono ${j === 0 ? 'text-left' : 'text-right'}`}
                        >
                          {cell}
                        </TableCell>
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