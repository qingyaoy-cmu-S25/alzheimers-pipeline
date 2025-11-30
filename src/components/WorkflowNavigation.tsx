import { WorkflowStep, StepStatus, WorkflowState } from '../types';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  XCircle, 
  Database, 
  FlaskConical, 
  LineChart, 
  Brain, 
  Download,
  Settings
} from 'lucide-react';
import { cn } from './ui/utils';

interface WorkflowNavigationProps {
  currentStep: WorkflowStep;
  setCurrentStep: (step: WorkflowStep) => void;
  workflowState: WorkflowState;
  updateStepStatus: (step: WorkflowStep, status: StepStatus) => void;
  addOutput: (output: Omit<any, 'id' | 'timestamp' | 'addedToReport'>) => void;
  setCode: (code: string) => void;
}

interface Step {
  id: WorkflowStep;
  label: string;
  icon: any;
  description: string;
}

// Fixed steps from Figma design
const steps: Step[] = [
  {
    id: 'environment',
    label: 'Environment Check',
    icon: Settings,
    description: 'GPU/Memory/Package versions',
  },
  {
    id: 'import',
    label: 'Data Import/Preprocessing',
    icon: Database,
    description: 'CSV/TSV/Parquet/H5AD',
  },
  {
    id: 'qc',
    label: 'Quality Control',
    icon: FlaskConical,
    description: 'QC/EDA report generation',
  },
  {
    id: 'visualization',
    label: 'Visualization Wizard',
    icon: LineChart,
    description: 'UMAP/Volcano/Heatmap',
  },
  {
    id: 'modeling',
    label: 'Modeling/Training',
    icon: Brain,
    description: 'Pipeline templates + hyperparams',
  },
  {
    id: 'export',
    label: 'Export',
    icon: Download,
    description: 'Charts/Tables/Reports',
  },
];

const getStatusIcon = (status: StepStatus) => {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground" />;
  }
};

export function WorkflowNavigation({
  currentStep,
  setCurrentStep,
  workflowState,
  updateStepStatus,
  addOutput,
  setCode,
}: WorkflowNavigationProps) {
  const completedSteps = Object.values(workflowState).filter(s => s === 'success').length;
  const progress = (completedSteps / steps.length) * 100;

  return (
    <div className="h-full flex flex-col bg-card border-r">
      {/* Progress bar */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Workflow Progress</span>
          <span className="text-sm">{completedSteps}/{steps.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Workflow steps */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const status = workflowState[step.id];
            const isActive = currentStep === step.id;

            return (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg mb-2 transition-colors',
                  'hover:bg-accent',
                  isActive && 'bg-accent border border-border'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Status indicator */}
                  <div className="mt-0.5">
                    {getStatusIcon(status)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{step.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Quick actions */}
      <div className="p-4 border-t space-y-2">
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Download className="w-4 h-4 mr-2" />
          Save Project
        </Button>
      </div>
    </div>
  );
}
