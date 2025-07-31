import React, { useState } from 'react';
import { PipelinePanel } from './components/PipelinePanel';
import { NotebookPanel } from './components/NotebookPanel';
import { ChatPanel } from './components/ChatPanel';
import { PipelineStep, ChatMessage } from './types';

// Pipeline steps for Alzheimer's disease analysis
const initialSteps: PipelineStep[] = [
  {
    id: 'step-1',
    title: 'Load Dataset',
    description: 'Download and load Alzheimer\'s disease dataset',
    status: 'pending'
  },
  {
    id: 'step-2',
    title: 'Gene Mapping',
    description: 'Map gene IDs to symbols using MyGene API',
    status: 'pending'
  },
  {
    id: 'step-3',
    title: 'Data Preprocessing',
    description: 'Normalize and filter gene expression data',
    status: 'pending'
  },
  {
    id: 'step-4',
    title: 'Model Training',
    description: 'Train GNN model with reinforcement learning',
    status: 'pending'
  },
  {
    id: 'step-5',
    title: 'Performance Metrics',
    description: 'Evaluate model performance and generate plots',
    status: 'pending'
  }
];

const initialMessages: ChatMessage[] = [
  {
    id: '1',
    content: 'Hello! I\'m your AI assistant for Alzheimer\'s disease research. I can help you understand the pipeline, modify code, or answer questions about the analysis.',
    role: 'assistant',
    timestamp: new Date()
  }
];

function App() {
  const [steps, setSteps] = useState<PipelineStep[]>(initialSteps);
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [currentCode, setCurrentCode] = useState<string>(''); // Add state for current cell code

  const handleStepClick = (stepId: string) => {
    setCurrentStepId(stepId);
  };

  const handleStepComplete = (stepId: string, success: boolean) => {
    console.log(`Step ${stepId} ${success ? 'completed successfully' : 'failed'}`);
    
    // Update step status based on success/failure
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

  // Function to update current code from NotebookView
  const handleCodeChange = (code: string) => {
    setCurrentCode(code);
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel - Pipeline Steps */}
      <div className="w-1/5 border-r border-gray-200 bg-white">
        <PipelinePanel 
          steps={steps}
          currentStepId={currentStepId}
          onStepClick={handleStepClick}
        />
      </div>

      {/* Center Panel - Code Execution */}
      <div className="flex-1 flex flex-col">
        <NotebookPanel
          currentStep={currentStepId ? steps.find(s => s.id === currentStepId) || null : null}
          stepResult={null}
          onStepComplete={handleStepComplete}
          onCodeChange={handleCodeChange} // Pass the code change handler
        />
      </div>

      {/* Right Panel - Chat */}
      <div className="w-1/4 border-l border-gray-200 bg-white">
        <ChatPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          currentCode={currentCode} // Pass current code to ChatPanel
        />
      </div>
    </div>
  );
}

export default App;