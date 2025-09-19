// Core pipeline interfaces
export interface PipelineStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  executionCount?: number;
  notebookCellIndex?: number; // absolute notebook cell index for this step
}

// Chat system interfaces
export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

// Code execution interfaces
export interface CellOutput {
  type: 'stream' | 'text' | 'error' | 'image' | 'html';
  content: string;
  name?: string;
  format?: string;
  ename?: string;
  evalue?: string;
  traceback?: string[];
}

// Legacy interface for compatibility (can be removed later)
export interface StepResult {
  code: string;
  output: string;
  executionTime?: number;
  hasChart?: boolean;
  chartData?: any;
}