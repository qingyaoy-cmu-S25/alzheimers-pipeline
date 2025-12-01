import React, { useState, useEffect } from 'react';
import { Upload, File, Trash2, RefreshCw, FileText, FileCode, Folder } from 'lucide-react';

interface WorkspaceFile {
  filename: string;
  size: number;
  modified_at: string;
}

export const WorkspaceFiles: React.FC = () => {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API_BASE = import.meta.env.VITE_API_BASE || '';

  const fetchFiles = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/workspace/files`);
      if (!res.ok) throw new Error('Failed to fetch files');
      const data = await res.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error fetching workspace files:', error);
      setError('Failed to load files');
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/api/workspace/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Upload failed');
      }

      await fetchFiles();
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete ${filename}?`)) return;

    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/workspace/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Delete failed');
      }

      await fetchFiles();
    } catch (error: any) {
      console.error('Delete error:', error);
      setError(error.message || 'Delete failed');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py':
        return <FileCode className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
      case 'csv':
      case 'json':
      case 'txt':
        return <FileText className="w-4 h-4 text-green-500 dark:text-green-400" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={fetchFiles}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Refresh"
            disabled={uploading}
          >
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${uploading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Upload Button */}
        <label className={`
          flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium
          transition-colors cursor-pointer
          ${uploading
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }
        `}>
          <Upload className="w-4 h-4" />
          <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = ''; // Reset input
            }}
            disabled={uploading}
          />
        </label>
        <p className="text-xs text-muted-foreground mt-2">
          Upload CSV, JSON, Python scripts, or any files
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-8 text-center">
            <Folder className="w-16 h-16 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-1">No files uploaded yet</p>
            <p className="text-xs text-muted-foreground/80">Upload datasets, scripts, or any files to access them in notebooks</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {files.map((file) => (
              <div
                key={file.filename}
                className="p-3 hover:bg-muted flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getFileIcon(file.filename)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate" title={file.filename}>
                      {file.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(file.filename)}
                  className="p-1 hover:bg-destructive/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {files.length > 0 && (
        <div className="p-3 border-t border-border bg-muted/50">
          <p className="text-xs text-muted-foreground">
            {files.length} file{files.length !== 1 ? 's' : ''} in workspace
          </p>
        </div>
      )}
    </div>
  );
};
