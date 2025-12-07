import React from 'react';
import { X, Settings, Moon, Sun } from 'lucide-react';
import { NotebookSelector } from './NotebookSelector';
import { WorkspaceFiles } from './WorkspaceFiles';
import { SidebarSection } from './Sidebar';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

interface Notebook {
  filename: string;
  size: number;
  modified_at: string;
  is_current: boolean;
}

interface SidePanelProps {
  activeSection: SidebarSection;
  onClose: () => void;
  // Notebook props
  notebooks?: Notebook[];
  currentNotebook?: string;
  onUploadNotebook?: (file: File) => Promise<void>;
  onSelectNotebook?: (filename: string) => Promise<void>;
  onDeleteNotebook?: (filename: string) => Promise<void>;
  onRefreshNotebooks?: () => Promise<void>;
  // Dark mode props
  isDark?: boolean;
  toggleDarkMode?: (value?: boolean) => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({
  activeSection,
  onClose,
  notebooks,
  currentNotebook,
  onUploadNotebook,
  onSelectNotebook,
  onDeleteNotebook,
  onRefreshNotebooks,
  isDark = false,
  toggleDarkMode,
}) => {
  if (!activeSection) return null;

  const titles: Record<Exclude<SidebarSection, null>, string> = {
    notebooks: 'Notebooks',
    files: 'Workspace Files',
    settings: 'Settings',
    'citation-network': 'Citation Network',
  };

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
        <h2 className="text-sm font-semibold text-foreground">
          {titles[activeSection]}
        </h2>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted rounded transition-colors"
          title="Close panel"
          aria-label="Close"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeSection === 'notebooks' && (
          <NotebookSelector
            notebooks={notebooks || []}
            currentNotebook={currentNotebook || ''}
            onUpload={onUploadNotebook || (() => Promise.resolve())}
            onSelect={onSelectNotebook || (() => Promise.resolve())}
            onDelete={onDeleteNotebook || (() => Promise.resolve())}
            onRefresh={onRefreshNotebooks || (() => Promise.resolve())}
          />
        )}

        {activeSection === 'files' && (
          <WorkspaceFiles />
        )}

        {activeSection === 'settings' && (
          <div className="p-4 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Appearance</h3>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  {isDark ? (
                    <Moon className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Sun className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <Label htmlFor="dark-mode-toggle" className="text-sm font-medium text-foreground cursor-pointer">
                      Dark Mode
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isDark ? 'Dark theme is enabled' : 'Light theme is enabled'}
                    </p>
                  </div>
                </div>
                <Switch
                  id="dark-mode-toggle"
                  checked={isDark}
                  onCheckedChange={(checked) => toggleDarkMode?.(checked)}
                  aria-label="Toggle dark mode"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
