import React, { useEffect, useState } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { WorkflowNavigation } from './components/WorkflowNavigation';
import { CodeEditor } from './components/CodeEditor';
import { AIAssistant } from './components/AIAssistant';
import { Sidebar, SidebarSection } from './components/Sidebar';
import { SidePanel } from './components/SidePanel';
import { Toaster } from './components/ui/sonner';
import { Button } from './components/ui/button';
import { useDarkMode } from './darkmode';
import { WorkflowStep, StepStatus, WorkflowState, ChatMessage, OutputItem, PipelineStep } from './types';

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    content: 'Hello! I\'m your AI assistant for Alzheimer\'s disease research. I can help you understand the pipeline, modify code, or answer questions about the analysis.',
    role: 'assistant',
    timestamp: new Date()
  }
];

// Mapping from WorkflowStep to notebook cell indices (will be loaded dynamically)
// This maps the fixed workflow steps to notebook cells
const workflowStepMapping: Record<WorkflowStep, number | null> = {
  environment: null,
  import: null,
  qc: null,
  visualization: null,
  modeling: null,
  export: null,
};

function App() {
  const { isDark, toggleDarkMode } = useDarkMode();
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('environment');
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    environment: 'pending',
    import: 'pending',
    qc: 'pending',
    visualization: 'pending',
    modeling: 'pending',
    export: 'pending',
  });
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [code, setCode] = useState<string>('');
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [activeSection, setActiveSection] = useState<SidebarSection>(null);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [currentNotebook, setCurrentNotebook] = useState<string>('');
  // const [notebookSteps, setNotebookSteps] = useState<PipelineStep[]>([]);
  // const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const API_BASE = import.meta.env.VITE_API_BASE || '';

  // // Load notebook cells and map them to workflow steps
  // useEffect(() => {
  //   // const fetchNotebookSteps = async () => {
  //   //   try {
  //   //     const res = await fetch(`${API_BASE}/api/notebook/cells`);
  //   //     if (!res.ok) throw new Error('Failed to load notebook steps');
  //   //     const data = await res.json();
  //   //     const loadedSteps: PipelineStep[] = (data.steps || []).map((s: any) => ({
  //   //       id: `step-${s.stepNumber}`,
  //   //       title: s.title,
  //   //       description: s.description,
  //   //       status: 'pending' as const,
  //   //       notebookCellIndex: s.index,
  //   //     }));
  //   //     setNotebookSteps(loadedSteps);

  //   //     // Map workflow steps to notebook cells based on title/description matching
  //   //     const mapping: Record<WorkflowStep, number | null> = { ...workflowStepMapping };
        
  //   //     loadedSteps.forEach((step) => {
  //   //       const title = step.title.toLowerCase();
  //   //       const desc = step.description.toLowerCase();
          
  //   //       // Smart mapping based on keywords
  //   //       if ((title.includes('environment') || title.includes('check') || desc.includes('gpu') || desc.includes('memory')) && !mapping.environment) {
  //   //         mapping.environment = step.notebookCellIndex || null;
  //   //       } else if ((title.includes('import') || title.includes('load') || title.includes('data') || desc.includes('csv') || desc.includes('h5ad')) && !mapping.import) {
  //   //         mapping.import = step.notebookCellIndex || null;
  //   //       } else if ((title.includes('qc') || title.includes('quality') || title.includes('control')) && !mapping.qc) {
  //   //         mapping.qc = step.notebookCellIndex || null;
  //   //       } else if ((title.includes('visual') || title.includes('plot') || title.includes('chart') || desc.includes('umap')) && !mapping.visualization) {
  //   //         mapping.visualization = step.notebookCellIndex || null;
  //   //       } else if ((title.includes('model') || title.includes('train') || desc.includes('gnn') || desc.includes('neural')) && !mapping.modeling) {
  //   //         mapping.modeling = step.notebookCellIndex || null;
  //   //       } else if ((title.includes('export') || title.includes('save') || title.includes('download')) && !mapping.export) {
  //   //         mapping.export = step.notebookCellIndex || null;
  //   //       }
  //   //     });

  //   //     // Preload all codes
  //   //     const codeEntries: [string, string][] = await Promise.all(
  //   //       Object.entries(mapping).map(async ([workflowStep, cellIndex]) => {
  //   //         if (cellIndex === null) return [workflowStep, ''];
  //   //         try {
  //   //           const r = await fetch(`${API_BASE}/api/notebook/cell/${cellIndex}`);
  //   //           if (!r.ok) return [workflowStep, ''];
  //   //           const j = await r.json();
  //   //           return [workflowStep, j.source || ''];
  //   //         } catch {
  //   //           return [workflowStep, ''];
  //   //         }
  //   //       })
  //   //     );
  //   //     const codes = Object.fromEntries(codeEntries);
  //   //     setCodeMap(codes);
        
  //   //     // Set initial code for current step
  //   //     if (codes[currentStep]) {
  //   //       setCode(codes[currentStep]);
  //   //     }
  //   //   } catch (e) {
  //   //     console.error('Error loading steps from notebook', e);
  //   //   }
  //   // };
  //   // fetchNotebookSteps();
  // }, []);

  // Update code when workflow step changes
  // useEffect(() => {
  //   if (codeMap[currentStep]) {
  //     setCode(codeMap[currentStep]);
  //   }
  // }, [currentStep, codeMap]);

  const updateStepStatus = (step: WorkflowStep, status: StepStatus) => {
    setWorkflowState(prev => ({
      ...prev,
      [step]: status,
    }));
  };

  const handleSendMessage = (content: string, role: 'user' | 'assistant' = 'user') => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      content,
      role,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, message]);
  };

  const handleSendErrorToChat = (errorMessage: string) => {
    handleSendMessage(errorMessage);
    setTimeout(() => {
      const event = new CustomEvent('sendErrorMessage', { 
        detail: { message: errorMessage, code: code } 
      });
      window.dispatchEvent(event);
    }, 100);
  };

  const addOutput = (output: Omit<OutputItem, 'id' | 'timestamp' | 'addedToReport'>) => {
    const newOutput: OutputItem = {
      ...output,
      id: Date.now().toString(),
      timestamp: new Date(),
      addedToReport: false,
    };
    setOutputs(prev => [...prev, newOutput]);
  };

  const toggleReportItem = (id: string) => {
    setOutputs(prev =>
      prev.map(item =>
        item.id === id ? { ...item, addedToReport: !item.addedToReport } : item
      )
    );
  };

  const removeOutput = (id: string) => {
    setOutputs(prev => prev.filter(item => item.id !== id));
  };

  // Load notebooks on mount and when section changes
  useEffect(() => {
    const loadNotebooks = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notebooks`);
        if (res.ok) {
          const data = await res.json();
          setNotebooks(data.notebooks || []);
          setCurrentNotebook(data.current || '');
        } else {
          console.warn('Failed to load notebooks:', res.status, res.statusText);
        }
      } catch (error) {
        console.error('Failed to load notebooks (backend may not be running):', error);
        // Don't show error to user - backend might not be running yet
      }
    };
    // Only load if notebooks section is active or on initial mount
    if (activeSection === 'notebooks' || activeSection === null) {
      loadNotebooks();
    }
  }, [API_BASE, activeSection]);

  // Notebook handlers
  const handleUploadNotebook = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/notebooks/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to upload notebook: ${res.status} ${errorText}`);
    }
    // Reload notebooks
    const data = await fetch(`${API_BASE}/api/notebooks`);
    if (data.ok) {
      const notebookData = await data.json();
      setNotebooks(notebookData.notebooks || []);
      setCurrentNotebook(notebookData.current || '');
    }
  };

  const handleSelectNotebook = async (filename: string) => {
    const res = await fetch(`${API_BASE}/api/notebooks/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to select notebook: ${res.status} ${errorText}`);
    }
    setCurrentNotebook(filename);
    // Reload notebooks to update is_current flags
    const data = await fetch(`${API_BASE}/api/notebooks`);
    if (data.ok) {
      const notebookData = await data.json();
      setNotebooks(notebookData.notebooks || []);
    }
  };

  const handleDeleteNotebook = async (filename: string) => {
    const res = await fetch(`${API_BASE}/api/notebooks/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to delete notebook: ${res.status} ${errorText}`);
    }
    // Reload notebooks
    const data = await fetch(`${API_BASE}/api/notebooks`);
    if (data.ok) {
      const notebookData = await data.json();
      setNotebooks(notebookData.notebooks || []);
      setCurrentNotebook(notebookData.current || '');
    }
  };

  const handleRefreshNotebooks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notebooks`);
      if (res.ok) {
        const data = await res.json();
        setNotebooks(data.notebooks || []);
        setCurrentNotebook(data.current || '');
      } else {
        console.warn('Failed to refresh notebooks:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('Failed to refresh notebooks (backend may not be running):', error);
      throw error; // Re-throw so NotebookSelector can show error to user
    }
  };

  // Get the notebook cell index for current workflow step
  // const getCurrentNotebookCellIndex = (): number | null => {
  //   // Find the mapping for current step
  //   const step = notebookSteps.find(s => {
  //     const title = s.title.toLowerCase();
  //     const desc = s.description.toLowerCase();
  //     const current = currentStep.toLowerCase();
      
  //     if (current === 'environment') {
  //       return title.includes('environment') || title.includes('check') || desc.includes('gpu') || desc.includes('memory');
  //     } else if (current === 'import') {
  //       return title.includes('import') || title.includes('load') || title.includes('data') || desc.includes('csv') || desc.includes('h5ad');
  //     } else if (current === 'qc') {
  //       return title.includes('qc') || title.includes('quality') || title.includes('control');
  //     } else if (current === 'visualization') {
  //       return title.includes('visual') || title.includes('plot') || title.includes('chart') || desc.includes('umap');
  //     } else if (current === 'modeling') {
  //       return title.includes('model') || title.includes('train') || desc.includes('gnn') || desc.includes('neural');
  //     } else if (current === 'export') {
  //       return title.includes('export') || title.includes('save') || title.includes('download');
  //     }
  //     return false;
  //   });
    
  //   return step?.notebookCellIndex ?? null;
  // };

  // Convert WorkflowStep to PipelineStep for CodeEditor
  const getCurrentPipelineStep = (): PipelineStep | null => {
    
    // Create a temporary PipelineStep from workflow step
    const stepLabels: Record<WorkflowStep, { title: string; description: string }> = {
      environment: { title: 'Environment Check', description: 'GPU/Memory/Package versions' },
      import: { title: 'Data Import/Preprocessing', description: 'CSV/TSV/Parquet/H5AD' },
      qc: { title: 'Quality Control', description: 'QC/EDA report generation' },
      visualization: { title: 'Visualization Wizard', description: 'UMAP/Volcano/Heatmap' },
      modeling: { title: 'Modeling/Training', description: 'Pipeline templates + hyperparams' },
      export: { title: 'Export', description: 'Charts/Tables/Reports' },
    };
    
    const label = stepLabels[currentStep];
    
    return {
      id: currentStep,
      title: label.title,
      description: label.description,
      status: workflowState[currentStep] === 'success' ? 'completed' : workflowState[currentStep] === 'error' ? 'error' : workflowState[currentStep] === 'running' ? 'running' : 'pending',
      // notebookCellIndex: cellIndex,
    };
  };

  const handleStepComplete = (stepId: string, success: boolean) => {
    // stepId might be a PipelineStep id or WorkflowStep
    // Check if it matches current workflow step, otherwise try to find matching workflow step
    return;
  };

  return (
    <div className="h-screen w-screen bg-background overflow-hidden">
      <Toaster />
      
      {/* Header */}
      <div className="h-14 border-b bg-card flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
            Bio
          </div>
          <h1 className="text-lg font-semibold">Biomedical Workflow Platform</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>GPU: RTX 4090</span>
            <span>•</span>
            <span>Memory: 32GB</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleDarkMode()}
            className="flex items-center gap-2"
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
                </svg>
                <span className="text-sm">Dark</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"></circle>
                  <path d="M12 2v2"></path>
                  <path d="M12 20v2"></path>
                  <path d="m4.93 4.93 1.41 1.41"></path>
                  <path d="m17.66 17.66 1.41 1.41"></path>
                  <path d="M2 12h2"></path>
                  <path d="M20 12h2"></path>
                  <path d="m6.34 17.66-1.41 1.41"></path>
                  <path d="m19.07 4.93-1.41 1.41"></path>
                </svg>
                <span className="text-sm">Light</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main layout with Sidebar and SidePanel */}
      <div className="h-[calc(100vh-3.5rem)] flex">
        {/* Sidebar - Fixed width on the far left */}
        <Sidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />

        {/* SidePanel - Appears when a section is active */}
        {activeSection && (
          <SidePanel
            activeSection={activeSection}
            onClose={() => setActiveSection(null)}
            notebooks={notebooks}
            currentNotebook={currentNotebook}
            onUploadNotebook={handleUploadNotebook}
            onSelectNotebook={handleSelectNotebook}
            onDeleteNotebook={handleDeleteNotebook}
            onRefreshNotebooks={handleRefreshNotebooks}
          />
        )}

        {/* Three-column layout */}
        <div className="flex-1">
          <ResizablePanelGroup direction="horizontal">
            {/* Left Panel - Workflow Navigation */}
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
              <WorkflowNavigation
                currentStep={currentStep}
                setCurrentStep={setCurrentStep}
                workflowState={workflowState}
                updateStepStatus={updateStepStatus}
                addOutput={addOutput}
                setCode={setCode}
              />
            </ResizablePanel>

          <ResizableHandle />

          {/* Middle Panel - Code & Output */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <CodeEditor
              currentStep={getCurrentPipelineStep()}
              code={code}
              setCode={setCode}
              outputs={outputs}
              onStepComplete={handleStepComplete}
              onCodeChange={(code) => setCode(code)}
              onSendErrorToChat={handleSendErrorToChat}
              addOutput={addOutput}
              toggleReportItem={toggleReportItem}
              removeOutput={removeOutput}
            />
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel - AI Assistant */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
            <AIAssistant
              currentStep={getCurrentPipelineStep()}
              outputs={outputs}
              code={code}
              messages={messages}
              onSendMessage={handleSendMessage}
              currentCode={code}
            />
          </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}

export default App;
