import React, { useEffect, useState } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { WorkflowNavigation } from './components/WorkflowNavigation';
import { CodeEditor } from './components/CodeEditor';
import { AIAssistant } from './components/AIAssistant';
import { Toaster } from './components/ui/sonner';
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
  const [notebookSteps, setNotebookSteps] = useState<PipelineStep[]>([]);
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const API_BASE = import.meta.env.VITE_API_BASE || '';

  // Load notebook cells and map them to workflow steps
  useEffect(() => {
    const fetchNotebookSteps = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/notebook/cells`);
        if (!res.ok) throw new Error('Failed to load notebook steps');
        const data = await res.json();
        const loadedSteps: PipelineStep[] = (data.steps || []).map((s: any) => ({
          id: `step-${s.stepNumber}`,
          title: s.title,
          description: s.description,
          status: 'pending' as const,
          notebookCellIndex: s.index,
        }));
        setNotebookSteps(loadedSteps);

        // Map workflow steps to notebook cells based on title/description matching
        const mapping: Record<WorkflowStep, number | null> = { ...workflowStepMapping };
        
        loadedSteps.forEach((step) => {
          const title = step.title.toLowerCase();
          const desc = step.description.toLowerCase();
          
          // Smart mapping based on keywords
          if ((title.includes('environment') || title.includes('check') || desc.includes('gpu') || desc.includes('memory')) && !mapping.environment) {
            mapping.environment = step.notebookCellIndex || null;
          } else if ((title.includes('import') || title.includes('load') || title.includes('data') || desc.includes('csv') || desc.includes('h5ad')) && !mapping.import) {
            mapping.import = step.notebookCellIndex || null;
          } else if ((title.includes('qc') || title.includes('quality') || title.includes('control')) && !mapping.qc) {
            mapping.qc = step.notebookCellIndex || null;
          } else if ((title.includes('visual') || title.includes('plot') || title.includes('chart') || desc.includes('umap')) && !mapping.visualization) {
            mapping.visualization = step.notebookCellIndex || null;
          } else if ((title.includes('model') || title.includes('train') || desc.includes('gnn') || desc.includes('neural')) && !mapping.modeling) {
            mapping.modeling = step.notebookCellIndex || null;
          } else if ((title.includes('export') || title.includes('save') || title.includes('download')) && !mapping.export) {
            mapping.export = step.notebookCellIndex || null;
          }
        });

        // Preload all codes
        const codeEntries: [string, string][] = await Promise.all(
          Object.entries(mapping).map(async ([workflowStep, cellIndex]) => {
            if (cellIndex === null) return [workflowStep, ''];
            try {
              const r = await fetch(`${API_BASE}/api/notebook/cell/${cellIndex}`);
              if (!r.ok) return [workflowStep, ''];
              const j = await r.json();
              return [workflowStep, j.source || ''];
            } catch {
              return [workflowStep, ''];
            }
          })
        );
        const codes = Object.fromEntries(codeEntries);
        setCodeMap(codes);
        
        // Set initial code for current step
        if (codes[currentStep]) {
          setCode(codes[currentStep]);
        }
      } catch (e) {
        console.error('Error loading steps from notebook', e);
      }
    };
    fetchNotebookSteps();
  }, []);

  // Update code when workflow step changes
  useEffect(() => {
    if (codeMap[currentStep]) {
      setCode(codeMap[currentStep]);
    }
  }, [currentStep, codeMap]);

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

  // Get the notebook cell index for current workflow step
  const getCurrentNotebookCellIndex = (): number | null => {
    // Find the mapping for current step
    const step = notebookSteps.find(s => {
      const title = s.title.toLowerCase();
      const desc = s.description.toLowerCase();
      const current = currentStep.toLowerCase();
      
      if (current === 'environment') {
        return title.includes('environment') || title.includes('check') || desc.includes('gpu') || desc.includes('memory');
      } else if (current === 'import') {
        return title.includes('import') || title.includes('load') || title.includes('data') || desc.includes('csv') || desc.includes('h5ad');
      } else if (current === 'qc') {
        return title.includes('qc') || title.includes('quality') || title.includes('control');
      } else if (current === 'visualization') {
        return title.includes('visual') || title.includes('plot') || title.includes('chart') || desc.includes('umap');
      } else if (current === 'modeling') {
        return title.includes('model') || title.includes('train') || desc.includes('gnn') || desc.includes('neural');
      } else if (current === 'export') {
        return title.includes('export') || title.includes('save') || title.includes('download');
      }
      return false;
    });
    
    return step?.notebookCellIndex ?? null;
  };

  // Convert WorkflowStep to PipelineStep for CodeEditor
  const getCurrentPipelineStep = (): PipelineStep | null => {
    const cellIndex = getCurrentNotebookCellIndex();
    if (cellIndex === null) return null;
    
    const step = notebookSteps.find(s => s.notebookCellIndex === cellIndex);
    if (step) return step;
    
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
      notebookCellIndex: cellIndex,
    };
  };

  const handleStepComplete = (stepId: string, success: boolean) => {
    // stepId might be a PipelineStep id or WorkflowStep
    // Check if it matches current workflow step, otherwise try to find matching workflow step
    let targetStep: WorkflowStep = currentStep;
    
    // Try to map stepId to workflow step
    if (stepId.startsWith('step-')) {
      // It's a notebook step ID, find which workflow step it corresponds to
      const notebookStep = notebookSteps.find(s => s.id === stepId);
      if (notebookStep) {
        const title = notebookStep.title.toLowerCase();
        const desc = notebookStep.description.toLowerCase();
        
        if (title.includes('environment') || title.includes('check') || desc.includes('gpu') || desc.includes('memory')) {
          targetStep = 'environment';
        } else if (title.includes('import') || title.includes('load') || title.includes('data') || desc.includes('csv') || desc.includes('h5ad')) {
          targetStep = 'import';
        } else if (title.includes('qc') || title.includes('quality') || title.includes('control')) {
          targetStep = 'qc';
        } else if (title.includes('visual') || title.includes('plot') || title.includes('chart') || desc.includes('umap')) {
          targetStep = 'visualization';
        } else if (title.includes('model') || title.includes('train') || desc.includes('gnn') || desc.includes('neural')) {
          targetStep = 'modeling';
        } else if (title.includes('export') || title.includes('save') || title.includes('download')) {
          targetStep = 'export';
        }
      }
    } else if (['environment', 'import', 'qc', 'visualization', 'modeling', 'export'].includes(stepId)) {
      targetStep = stepId as WorkflowStep;
    }
    
    // Update workflow state
    updateStepStatus(targetStep, success ? 'success' : 'error');
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>GPU: RTX 4090</span>
          <span>•</span>
          <span>Memory: 32GB</span>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="h-[calc(100vh-3.5rem)]">
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
  );
}

export default App;
