import React, { useState, useRef } from 'react';
import { Upload, FileText, Check, Trash2, Loader2 } from 'lucide-react';

interface Notebook {
  filename: string;
  size: number;
  modified_at: string;
  is_current: boolean;
}

interface NotebookSelectorProps {
  notebooks: Notebook[];
  currentNotebook: string;
  onUpload: (file: File) => Promise<void>;
  onSelect: (filename: string) => Promise<void>;
  onDelete: (filename: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}

export const NotebookSelector: React.FC<NotebookSelectorProps> = ({
  notebooks,
  currentNotebook,
  onUpload,
  onSelect,
  onDelete,
  onRefresh,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ipynb')) {
      setUploadError('Please select a .ipynb file');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      await onUpload(file);
      await onRefresh();
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelect = async (filename: string) => {
    if (filename === currentNotebook) return;
    try {
      await onSelect(filename);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to select notebook:', error);
    }
  };

  const handleDelete = async (filename: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
      await onDelete(filename);
      await onRefresh();
    } catch (error) {
      console.error('Failed to delete notebook:', error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 border-b border-border bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Notebook</span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".ipynb"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {uploadError && (
        <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
          {uploadError}
        </div>
      )}

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-2 bg-muted border border-border rounded hover:bg-muted/80 transition-colors"
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground truncate">{currentNotebook}</span>
          </div>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {notebooks.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No notebooks available
              </div>
            ) : (
              notebooks.map((notebook) => (
                <div
                  key={notebook.filename}
                  onClick={() => handleSelect(notebook.filename)}
                  className={`flex items-center justify-between p-3 hover:bg-muted cursor-pointer border-b border-border last:border-b-0 ${
                    notebook.is_current ? 'bg-primary/10' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {notebook.filename}
                      </span>
                      {notebook.is_current && (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatSize(notebook.size)} • {formatDate(notebook.modified_at)}
                    </div>
                  </div>
                  {!notebook.is_current && (
                    <button
                      onClick={(e) => handleDelete(notebook.filename, e)}
                      className="ml-2 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Delete notebook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
