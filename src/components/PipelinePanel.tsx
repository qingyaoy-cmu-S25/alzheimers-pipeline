import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { PipelineStep } from '../types';
import { cn } from './ui/utils';
import { Progress } from './ui/progress';

interface PipelinePanelProps {
  steps: PipelineStep[];
  currentStepId: string | null;
  onStepClick: (stepId: string) => void;
}

export const PipelinePanel: React.FC<PipelinePanelProps> = ({
  steps,
  currentStepId,
  onStepClick,
}) => {
  const getStatusIcon = (status: PipelineStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const progress = steps.length > 0 ? (completedSteps / steps.length) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-card border-r">
      {/* Progress bar */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Pipeline Steps</span>
          <span className="text-sm">{completedSteps}/{steps.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2">
          Click steps to view and execute code
        </p>
      </div>

      {/* Steps list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          {steps.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">No steps loaded</p>
              <p className="text-xs mt-1">Select a notebook to load pipeline steps</p>
            </div>
          ) : (
            steps.map((step, index) => {
              const isActive = currentStepId === step.id;

              return (
                <button
                  key={step.id}
                  onClick={() => onStepClick(step.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg mb-2 transition-colors',
                    'hover:bg-accent',
                    isActive && 'bg-accent border border-border'
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <div className="mt-0.5">
                      {getStatusIcon(step.status)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-xs font-medium flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium truncate">{step.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {step.description}
                      </p>
                      {step.executionCount && step.executionCount > 0 && (
                        <span className="text-xs text-muted-foreground mt-1 inline-block">
                          Executed {step.executionCount} time{step.executionCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
