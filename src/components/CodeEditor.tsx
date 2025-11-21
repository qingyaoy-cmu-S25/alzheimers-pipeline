import { useState, useEffect, useRef } from 'react';
import { PipelineStep, CellOutput, OutputItem } from '../types';
import { Button } from './ui/button';
import Editor from '@monaco-editor/react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './ui/resizable';
import { Play, Settings, Save, Download, Sparkles, RotateCcw } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { ParameterDrawer } from './ParameterDrawer';
import { OutputPanel } from './OutputPanel';
import { FileUploader } from './FileUploader';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { useDarkMode } from '../darkmode';

interface CodeEditorProps {
  currentStep: PipelineStep | null; // Changed to PipelineStep
  code: string;
  setCode: (code: string) => void;
  outputs: OutputItem[];
  onStepComplete?: (stepId: string, success: boolean) => void;
  onCodeChange?: (code: string) => void;
  onSendErrorToChat?: (errorMessage: string) => void;
  addOutput: (output: Omit<OutputItem, 'id' | 'timestamp' | 'addedToReport'>) => void;
  toggleReportItem: (id: string) => void;
  removeOutput: (id: string) => void;
}

// Convert CellOutput to OutputItem
const convertCellOutputToOutputItem = (output: CellOutput, index: number): Omit<OutputItem, 'id' | 'timestamp' | 'addedToReport'> => {
  switch (output.type) {
    case 'stream':
    case 'text':
      return {
        type: 'log',
        title: `Output ${index + 1}`,
        content: output.content,
      };
    case 'error':
      return {
        type: 'error',
        title: `Error: ${output.ename || 'Execution Error'}`,
        content: {
          message: output.evalue || output.content,
          stack: output.traceback?.join('\n') || '',
        },
      };
    case 'image':
      return {
        type: 'chart',
        title: 'Plot Output',
        content: `data:image/${output.format || 'png'};base64,${output.content}`,
      };
    case 'html':
      return {
        type: 'log',
        title: 'HTML Output',
        content: output.content,
      };
    default:
      return {
        type: 'log',
        title: 'Output',
        content: JSON.stringify(output, null, 2),
      };
  }
};

export function CodeEditor({
  currentStep,
  code,
  setCode,
  outputs,
  onStepComplete,
  onCodeChange,
  onSendErrorToChat,
  addOutput,
  toggleReportItem,
  removeOutput,
}: CodeEditorProps) {
  const { isDark } = useDarkMode();
  const [isRunning, setIsRunning] = useState(false);
  const [isRestartingKernel, setIsRestartingKernel] = useState(false);
  const [showRestartConfirmation, setShowRestartConfirmation] = useState(false);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const API_BASE = import.meta.env.VITE_API_BASE || '';
  
  // Update theme when isDark changes
  useEffect(() => {
    if (monacoRef.current) {
      const theme = isDark ? 'vs-dark' : 'custom-white';
      // Use monaco.editor.setTheme() directly - this updates all editors
      try {
        const monaco = monacoRef.current;
        monaco.editor.setTheme(theme);
        console.log('Monaco theme updated to:', theme, 'isDark:', isDark);
      } catch (error) {
        console.error('Error setting Monaco theme:', error);
      }
    }
  }, [isDark]);
  
  // Notify parent when code changes
  useEffect(() => {
    if (onCodeChange && code) {
      onCodeChange(code);
    }
  }, [code, onCodeChange]);

  const executeCode = async () => {
    if (!currentStep || !code) {
      toast.error('No step selected or code is empty');
      return;
    }

    setIsRunning(true);
    const startTime = Date.now();

    try {
      const response = await fetch(`${API_BASE}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          cell_id: currentStep.notebookCellIndex !== undefined
            ? currentStep.notebookCellIndex
            : parseInt(currentStep.id.split('-')[1] || '0')
        })
      });

      const endTime = Date.now();
      const executionTime = (endTime - startTime) / 1000;

      if (response.ok) {
        const result = await response.json();
        
        // Check if execution was successful
        const hasError = result.outputs && result.outputs.some((output: any) => output.type === 'error');
        const success = result.status === 'ok' && !hasError;

        // Convert outputs to OutputItem format
        if (result.outputs && result.outputs.length > 0) {
          result.outputs.forEach((output: CellOutput, index: number) => {
            addOutput(convertCellOutputToOutputItem(output, index));
          });
        }

        // Handle errors - send to chat if available
        if (hasError && onSendErrorToChat) {
          const errorOutput = result.outputs.find((o: any) => o.type === 'error');
          if (errorOutput) {
            const errorMessage = `Please explain this error: ${errorOutput.ename || 'Error'}: ${errorOutput.evalue || errorOutput.content}`;
            onSendErrorToChat(errorMessage);
          }
        }

        // Notify parent about completion
        if (onStepComplete) {
          onStepComplete(currentStep.id, success);
        }

        if (success) {
          toast.success(`Execution completed in ${executionTime.toFixed(2)}s`);
        } else {
          toast.error('Execution completed with errors');
        }
      } else {
        throw new Error('Execution failed');
      }
    } catch (error) {
      console.error('Error executing code:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      addOutput({
        type: 'error',
        title: 'Execution Error',
        content: {
          message: errorMessage,
          stack: '',
        },
      });

      if (onStepComplete) {
        onStepComplete(currentStep.id, false);
      }

      toast.error(`Execution failed: ${errorMessage}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRestartKernel = async () => {
    setShowRestartConfirmation(false);
    setIsRestartingKernel(true);

    try {
      const response = await fetch(`${API_BASE}/api/restart_kernel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'restarted') {
          // Clear all outputs
          outputs.forEach(output => removeOutput(output.id));
          
          // Show success message
          addOutput({
            type: 'log',
            title: 'Kernel Restarted',
            content: '✓ Kernel restarted successfully.\n\nAll variables and imports have been cleared.\nYou may need to re-run previous cells.',
          });
          
          toast.success('Kernel restarted successfully');
        }
      } else {
        throw new Error('Failed to restart kernel');
      }
    } catch (error) {
      console.error('Error restarting kernel:', error);
      toast.error(`Failed to restart kernel: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRestartingKernel(false);
    }
  };

  const generateRecommendations = () => {
    toast.success('AI recommendations generated!');
    addOutput({
      type: 'recommendations',
      title: 'AI Visualization Recommendations',
      content: {
        dataInfo: {
          samples: 5000,
          features: 2000,
          type: 'Single-cell RNA-seq',
        },
        recommendations: [
          {
            name: 'UMAP Dimensionality Reduction',
            confidence: 95,
            reason: 'Your dataset has high-dimensional features (2000 genes) with 5000 cells. UMAP is ideal for visualizing cell-type clustering and identifying distinct populations in single-cell data.',
            tags: ['Clustering', 'Cell Types', 'Dimensionality Reduction'],
          },
        ],
      },
    });
  };

  if (!currentStep) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-lg font-medium mb-2">No Step Selected</h3>
          <p>Select a pipeline step from the left panel to view and execute its code</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <ResizablePanelGroup direction="vertical">
        {/* Code area */}
        <ResizablePanel defaultSize={40} minSize={25}>
          <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="h-12 border-b flex items-center justify-between px-4 bg-card">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{currentStep.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Parameters
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Parameter Settings</SheetTitle>
                    </SheetHeader>
                    <ParameterDrawer currentStep={currentStep.title as any} />
                  </SheetContent>
                </Sheet>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowRestartConfirmation(true)}
                  disabled={isRestartingKernel}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {isRestartingKernel ? 'Restarting...' : 'Restart Kernel'}
                </Button>
                <Button 
                  size="sm" 
                  onClick={executeCode}
                  disabled={isRunning || !code}
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isRunning ? 'Running...' : 'Run'}
                </Button>
              </div>
            </div>

            {/* Code editor or File uploader */}
            <div className="flex-1 p-4 overflow-auto">
              {currentStep.title.toLowerCase().includes('visual') ? (
                <FileUploader 
                  onFileUpload={async (file, parsed) => {
                    toast.success(`File ${file.name} uploaded successfully`);
                    try {
                      let bodyData: any = null;

                      if (parsed && parsed.headers && parsed.rows) {
                        // Frontend already parsed into { headers, rows }
                        bodyData = parsed;
                      } else {
                        // Fallback: read raw CSV text from file
                        const text = await file.text();
                        bodyData = text;
                      }

                      // 调用后端API处理数据
                      const response = await fetch(`${API_BASE}/api/process_data`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ data: bodyData }),
                      });

                      if (!response.ok) {
                        const text = await response.text();
                        throw new Error(`Server error: ${response.status} ${text}`);
                      }

                      const result = await response.json();

                      // Add recommendations output if present
                      if (result.recommendations) {
                        const recs = (result.recommendations || []).map((r: any) => ({
                          name: r.name || r.title || 'Chart',
                          confidence: r.confidence || r.score || 80,
                          reason: r.reason || r.explanation || '',
                          tags: r.tags || [],
                          fields: r.fields || r.columns || [],
                        }));

                        addOutput({
                          type: 'recommendations',
                          title: 'AI Visualization Recommendations',
                          content: {
                            dataInfo: result.dataInfo,
                            recommendations: recs,
                          },
                        });
                      } else if (result.recommendations_text || result.parse_error) {
                        const message = result.recommendations_text || 'Failed to parse AI response';
                        const stack = result.parse_error || '';
                        addOutput({
                          type: 'error',
                          title: 'AI Recommendation Error',
                          content: { message, stack },
                        });
                      }

                    } catch (error) {
                      console.error('Error processing file:', error);
                      toast.error(`Error processing file: ${error}`);
                      addOutput({
                        type: 'error',
                        title: 'Processing Error',
                        content: { message: String(error), stack: '' },
                      });
                    }
                  }}
                  acceptedFileTypes={['.csv', '.xlsx', '.xls']}
                  maxFileSize={10 * 1024 * 1024} // 10MB
                />
              ) : (
                <Editor
                  key={`editor-theme-${isDark ? 'dark' : 'light'}`}
                  height="100%"
                  language="python"
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  theme={isDark ? 'vs-dark' : 'custom-white'}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 4,
                    wordWrap: 'on',
                    padding: { top: 16, bottom: 16 },
                  }}
                  beforeMount={(monaco) => {
                    // Define custom white theme - ensure it's always defined
                    try {
                      monaco.editor.defineTheme('custom-white', {
                        base: 'vs',
                        inherit: true,
                        rules: [],
                        colors: {
                          'editor.background': '#ffffff',
                          'editor.foreground': '#000000',
                        }
                      });
                    } catch (error) {
                      // Theme might already be defined
                    }
                  }}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor;
                    monacoRef.current = monaco;
                    // Set theme after mount using the current isDark value
                    const theme = isDark ? 'vs-dark' : 'custom-white';
                    monaco.editor.setTheme(theme);
                    console.log('Editor mounted with theme:', theme, 'isDark:', isDark);
                  }}
                />
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle />

        {/* Output area */}
        <ResizablePanel defaultSize={60} minSize={35}>
          <OutputPanel
            outputs={outputs}
            toggleReportItem={toggleReportItem}
            removeOutput={removeOutput}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Restart Kernel Confirmation Dialog */}
      <AlertDialog open={showRestartConfirmation} onOpenChange={setShowRestartConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restart Kernel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restart the Python kernel and clear all variables, imports, and state.
              You will need to re-run any cells to restore the previous state.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestartKernel}>Restart Kernel</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
