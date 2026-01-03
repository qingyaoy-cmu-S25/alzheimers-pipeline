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
import { ChartView } from './ChartView';
import D3Sandbox from './D3Sandbox';
import type { ChartPayload } from '../lib/chart-utils';
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
        type: 'image',
        title: 'Plot Output',
        content: {
          data: output.content,
          format: output.format || 'png',
        },
      };
    case 'html':
      return {
        type: 'html',
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
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [chartModalPayload, setChartModalPayload] = useState<ChartPayload | null>(null);
  const [chartModalD3Code, setChartModalD3Code] = useState<string | null>(null);
  const [chartModalD3Data, setChartModalD3Data] = useState<any>(null);

  // Infer sensible fields from preview records when recommendation lacks fields
  const inferFieldsFromRecords = (records: any[], recName = ''): string[] => {
    if (!records || !Array.isArray(records) || records.length === 0) return [];
    const sample = records.find(r => r && typeof r === 'object') || records[0];
    if (!sample || typeof sample !== 'object') return [];
    const keys = Object.keys(sample);

    // Score numeric columns
    const numericKeys: string[] = [];
    const categoricalKeys: string[] = [];
    keys.forEach(k => {
      let numericCount = 0;
      for (let i = 0; i < Math.min(20, records.length); i++) {
        const v = records[i]?.[k];
        if (v === null || v === undefined || v === '') continue;
        if (!isNaN(Number(v))) numericCount++;
      }
      if (numericCount >= Math.min(3, records.length)) numericKeys.push(k);
      else categoricalKeys.push(k);
    });

    const name = (recName || '').toLowerCase();
    if (name.includes('scatter')) {
      if (numericKeys.length >= 2) return [numericKeys[0], numericKeys[1]];
      if (numericKeys.length >= 1 && categoricalKeys.length >= 1) return [categoricalKeys[0], numericKeys[0]];
    }
    if (name.includes('pie')) {
      if (categoricalKeys.length >= 1) return [categoricalKeys[0]];
      if (numericKeys.length >= 1) return [numericKeys[0]];
    }
    if (name.includes('group') || name.includes('stack')) {
      if (categoricalKeys.length >= 1) {
        const second = categoricalKeys[1] || numericKeys[0] || keys[1];
        return [categoricalKeys[0], second].filter(Boolean) as string[];
      }
    }

    // default heuristic: categorical x, numeric y
    if (categoricalKeys.length >= 1 && numericKeys.length >= 1) return [categoricalKeys[0], numericKeys[0]];
    if (numericKeys.length >= 2) return [numericKeys[0], numericKeys[1]];
    // fallback to first two keys
    return keys.slice(0, 2);
  };
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

            {/* Code editor (FileUploader disabled - always show code editor) */}
            <div className="flex-1 p-4 overflow-auto">
              {false && currentStep.title.toLowerCase().includes('visual') ? (
                <FileUploader
                  onFileUpload={async (file, parsed) => {
                    toast.success(`File ${file.name} uploaded successfully`);
                    try {
                      let bodyData: any = null;
                      const name = file.name.toLowerCase();
                      const ext = '.' + name.split('.').pop()?.toLowerCase();
                      if (parsed && parsed.headers && parsed.rows) {
                        // Frontend already parsed into { headers, rows }
                        bodyData = parsed;
                      } else {
                        // Fallback: read raw CSV text from file
                        if (ext !== '.h5' && ext !== '.h5ad') {
                          const text = await file.text();
                          bodyData = text;
                        }
                      }
                      let response = null;
                      if (ext === '.h5ad' || ext === '.h5') {
                        const formData = new FormData();
                        formData.append("file", file);
                        response = await fetch("/api/process_h5ad", { method: "POST", body: formData })
                      } else {

                        
                        response = await fetch(`${API_BASE}/api/process_data`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ data: bodyData }),
                        });
                      }


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
                          d3_js: r.d3_js || undefined, // Include d3_js if present from backend
                        }));

                        addOutput({
                          type: 'recommendations',
                          title: 'AI Visualization Recommendations',
                          content: {
                            dataInfo: result.dataInfo,
                            recommendations: recs,
                            // include preview records so Generate can use them
                            records: result.preview || [],
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
                  acceptedFileTypes={['.csv', '.xlsx', '.xls', '.h5ad', '.h5']}
                  maxFileSize={10 * 1024 * 1024 * 1024} // 1GB
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
            onGenerateChart={(output, recommendation) => {
              const records = output.content?.records || [];

              // Ensure recommendation has fields; infer from records if missing
              const fields = (recommendation.fields && recommendation.fields.length)
                ? recommendation.fields
                : inferFieldsFromRecords(records, recommendation.name || recommendation.title || '');

              const recWithFields = { ...recommendation, fields };

              // If recommendation provides d3_js, preview it in the global modal (do not add to outputs)
              if (recWithFields.d3_js) {
                const code = recWithFields.d3_js as string;
                const dataForCode = records || [];
                setChartModalD3Code(code);
                setChartModalD3Data(dataForCode);
                setChartModalPayload(null);
                setChartModalOpen(true);
                return;
              }

              // If no d3_js is present, show error so model/back-end can be adjusted
              addOutput({ type: 'error', title: 'Chart Error', content: { message: 'AI did not provide D3 code for this recommendation.', stack: '' } });
            }}
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

      {/* Chart Preview Dialog */}
<AlertDialog open={chartModalOpen} onOpenChange={setChartModalOpen}>
  <AlertDialogContent className="max-w-6xl w-full h-[80vh] flex flex-col">
    <AlertDialogHeader>
      <AlertDialogTitle>Chart Preview</AlertDialogTitle>
      <AlertDialogDescription>
        Preview of the generated visualization. Close to continue.
      </AlertDialogDescription>
    </AlertDialogHeader>

    {/* */}
    <div className="mt-2 flex-1 min-h-0">
      {chartModalD3Code && (
        <D3Sandbox
          code={chartModalD3Code}
          data={chartModalD3Data}
          height="100%"
          useIframe={false}
        />
      )}
    </div>

    <AlertDialogFooter>
      <AlertDialogCancel>Close</AlertDialogCancel>
      <AlertDialogAction onClick={() => setChartModalOpen(false)}>Done</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>


    </div>
  );
}
