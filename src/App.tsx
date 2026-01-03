import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import { CodeEditor } from './components/CodeEditor';
import { AIAssistant } from './components/AIAssistant';
import { Sidebar, SidebarSection } from './components/Sidebar';
import { SidePanel } from './components/SidePanel';
import { Toaster } from './components/ui/sonner';
import { useDarkMode } from './darkmode';
import { ChatMessage, OutputItem, PipelineStep } from './types';
import { PipelinePanel } from './components/PipelinePanel';
import { CitationNetworkPage } from './components/CitationNetwork';

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    content: 'Hello! I\'m your AI assistant for Alzheimer\'s disease research. I can help you understand the pipeline, modify code, or answer questions about the analysis.',
    role: 'assistant',
    timestamp: new Date()
  }
];

function App() {
  const { isDark, toggleDarkMode } = useDarkMode();
  // Dynamic steps from notebook
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [initialCodes, setInitialCodes] = useState<Record<string, string>>({});

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [code, setCode] = useState<string>('');
  const [outputs, setOutputs] = useState<OutputItem[]>([]);
  const [activeSection, setActiveSection] = useState<SidebarSection>(null);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [currentNotebook, setCurrentNotebook] = useState<string>('');
  const [notebookVersion, setNotebookVersion] = useState<number>(0);
  const [systemInfo, setSystemInfo] = useState<{
    cpu?: { name: string; cores: number; threads: number };
    memory?: { total_gb: number; available_gb: number; used_percent: number };
    gpu?: { name: string; memory_mb?: number } | null;
  } | null>(null);
  const API_BASE = import.meta.env.VITE_API_BASE || '';

  // Load steps dynamically from backend (current notebook)
  const fetchSteps = useCallback(async () => {
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
      setSteps(loadedSteps);

      // Always select first step when loading new notebook
      if (loadedSteps.length > 0) {
        setCurrentStepId(loadedSteps[0].id);
      }

      // Preload all codes once
      const codeEntries: [string, string][] = await Promise.all(
        loadedSteps.map(async (st) => {
          if (st.notebookCellIndex === undefined) return [st.id, ''];
          try {
            const r = await fetch(`${API_BASE}/api/notebook/cell/${st.notebookCellIndex}`);
            if (!r.ok) return [st.id, ''];
            const j = await r.json();
            return [st.id, j.source || ''];
          } catch {
            return [st.id, ''];
          }
        })
      );
      const codes = Object.fromEntries(codeEntries);
      setInitialCodes(codes);

      // Set initial code for first step
      if (loadedSteps.length > 0 && codes[loadedSteps[0].id]) {
        setCode(codes[loadedSteps[0].id]);
      }
    } catch (e) {
      console.error('Error loading steps from notebook', e);
    }
  }, [API_BASE]); // Removed currentStepId dependency to prevent unnecessary re-renders

  // Update code when step changes
  useEffect(() => {
    if (currentStepId && initialCodes[currentStepId]) {
      setCode(initialCodes[currentStepId]);
    }
  }, [currentStepId, initialCodes]);

  // Handle step completion - update status
  const handleStepComplete = (stepId: string, success: boolean) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId
        ? {
            ...step,
            status: success ? 'completed' : 'error',
            executionCount: (step.executionCount || 0) + 1
          }
        : step
    ));
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

  // Counter for unique IDs
  const outputIdCounter = useRef(0);

  const addOutput = (output: Omit<OutputItem, 'id' | 'timestamp' | 'addedToReport'>) => {
    outputIdCounter.current += 1;
    const newOutput: OutputItem = {
      ...output,
      id: `output-${Date.now()}-${outputIdCounter.current}`,
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

    // Clear current state before loading new notebook
    setSteps([]);
    setInitialCodes({});
    setCurrentStepId(null);
    setCode('');

    setCurrentNotebook(filename);
    setNotebookVersion(prev => prev + 1);

    // Reload notebooks to update is_current flags
    const data = await fetch(`${API_BASE}/api/notebooks`);
    if (data.ok) {
      const notebookData = await data.json();
      setNotebooks(notebookData.notebooks || []);
    }

    // Reload steps from new notebook
    await fetchSteps();
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

  // Get current step from steps array
  const getCurrentStep = (): PipelineStep | null => {
    if (!currentStepId) return null;
    return steps.find(s => s.id === currentStepId) || null;
  };

  // Load steps when notebook changes
  useEffect(() => {
    if (currentNotebook) {
      fetchSteps();
    }
  }, [currentNotebook, notebookVersion]);

  // Fetch system info on mount
  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/system/info`);
        if (res.ok) {
          const data = await res.json();
          setSystemInfo(data);
        }
      } catch (error) {
        console.error('Failed to fetch system info:', error);
      }
    };
    fetchSystemInfo();
  }, [API_BASE]);

  return (
    <div className="h-screen w-screen bg-background overflow-hidden">
      <Toaster />
      
      {/* Header */}
      <div className="h-14 border-b bg-card flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-xs">
            SA
          </div>
          <h1 className="text-lg font-semibold">ScholarAgent</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {systemInfo ? (
              <>
                {systemInfo.gpu && (
                  <>
                    <span>GPU: {systemInfo.gpu.name}</span>
                    <span>•</span>
                  </>
                )}
                <span>Memory: {systemInfo.memory?.total_gb || '?'}GB</span>
                <span>•</span>
                <span>CPU: {systemInfo.cpu?.cores || '?'} cores</span>
              </>
            ) : (
              <span>Loading system info...</span>
            )}
          </div>
        </div>
      </div>

      {/* Citation Network Full Page View */}
      {activeSection === 'citation-network' ? (
        <CitationNetworkPage
          onBack={() => setActiveSection(null)}
        />
      ) : (
        /* Main layout with Sidebar and SidePanel */
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
              isDark={isDark}
              toggleDarkMode={toggleDarkMode}
            />
          )}

          {/* Three-column layout */}
          <div className="flex-1 min-w-0">
            <ResizablePanelGroup direction="horizontal">
              {/* Left Panel - Pipeline Steps (dynamic from notebook) */}
              <ResizablePanel id="pipeline-panel" order={1} defaultSize={20} minSize={15} maxSize={25}>
                <PipelinePanel
                  steps={steps}
                  currentStepId={currentStepId}
                  onStepClick={(stepId) => setCurrentStepId(stepId)}
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Middle Panel - Code & Output */}
              <ResizablePanel id="code-panel" order={2} defaultSize={50} minSize={30} maxSize={60}>
                <CodeEditor
                  currentStep={getCurrentStep()}
                  code={code}
                  setCode={setCode}
                  outputs={outputs}
                  onStepComplete={handleStepComplete}
                  onCodeChange={(newCode) => setCode(newCode)}
                  onSendErrorToChat={handleSendErrorToChat}
                  addOutput={addOutput}
                  toggleReportItem={toggleReportItem}
                  removeOutput={removeOutput}
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right Panel - AI Assistant */}
              <ResizablePanel id="ai-panel" order={3} defaultSize={30} minSize={20} maxSize={40}>
                <AIAssistant
                  currentStep={getCurrentStep()}
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
      )}
    </div>
  );
}

export default App;
