import { OutputItem } from '../types';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { 
  FileText, 
  BarChart3, 
  Table as TableIcon, 
  Terminal, 
  AlertCircle, 
  X,
  CheckSquare,
  Square,
  Download,
  Sparkles,
  Lightbulb,
  ArrowRight
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { cn } from './ui/utils';
import { ChartView } from './ChartView';
import D3Sandbox from './D3Sandbox';

interface OutputPanelProps {
  outputs: OutputItem[];
  toggleReportItem: (id: string) => void;
  removeOutput: (id: string) => void;
  onGenerateChart?: (output: OutputItem, recommendation: any) => void;
}

export function OutputPanel({ outputs, toggleReportItem, removeOutput, onGenerateChart }: OutputPanelProps) {
  const getIcon = (type: OutputItem['type']) => {
    switch (type) {
      case 'chart':
        return <BarChart3 className="w-4 h-4" />;
      case 'table':
        return <TableIcon className="w-4 h-4" />;
      case 'log':
        return <Terminal className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      case 'recommendations':
        return <Lightbulb className="w-4 h-4 text-yellow-500" />;
    }
  };

  const renderOutput = (output: OutputItem) => {
    switch (output.type) {
      case 'log':
        return (
          <pre className="text-xs font-mono bg-muted p-3 rounded whitespace-pre-wrap">
            {output.content}
          </pre>
        );
      
      case 'table':
        return (
          <div className="space-y-2">
            <div className="flex gap-4 text-sm">
              <span>Shape: {output.content.shape[0]} × {output.content.shape[1]}</span>
              <span>Missing: {output.content.missing}</span>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    {output.content.head[0].map((col: string, i: number) => (
                      <TableHead key={i}>{col}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {output.content.head.slice(1).map((row: any[], i: number) => (
                    <TableRow key={i}>
                      {row.map((cell: any, j: number) => (
                        <TableCell key={j}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      
      case 'chart':
        return (
          <div className="rounded-lg">
            <ChartView payload={output.content} />
          </div>
        );

      case 'd3':
        return (
          <div className="rounded-lg">
            <D3Sandbox code={output.content.code} data={output.content.data || []} height={320} useIframe={false} />
          </div>
        );
      
      case 'error':
        return (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{output.content.message}</AlertDescription>
            </Alert>
            <pre className="text-xs font-mono bg-muted p-3 rounded overflow-x-auto">
              {output.content.stack}
            </pre>
            {/* <Button variant="outline" size="sm" className="w-full">
              <Sparkles className="w-4 h-4 mr-2" />
              Explain & Fix
            </Button> */}
          </div>
        );
      
      case 'recommendations':
        return (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start gap-3 pb-3 border-b">
              <Sparkles className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm">
                  Based on your data characteristics, I recommend the following visualizations:
                </p>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Samples: {output.content.dataInfo.samples}</span>
                  <span>Features: {output.content.dataInfo.features}</span>
                  <span>Type: {output.content.dataInfo.type}</span>
                </div>
              </div>
            </div>

            {/* Recommendations (list + footer inside one scrollable container) */}
            <div className="space-y-3 max-h-[40vh] overflow-auto pr-2">
              {output.content.recommendations.map((rec: any, index: number) => (
                <Card key={index} className="p-4 hover:bg-accent/50 transition-colors border-2">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm">{rec.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {rec.confidence}% match
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed break-words">
                        {rec.reason}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(rec.tags || []).map((tag: string, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => onGenerateChart && onGenerateChart(output, rec)}
                      >
                        <ArrowRight className="w-3 h-3 mr-2" />
                        Generate {rec.name}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {/* Footer tip moved inside scrollable container so it can be scrolled into view */}
              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg mt-2">
                <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Click on any recommendation to automatically generate the code and parameters for that visualization.
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">Output</span>
          {outputs.length > 0 && (
            <Badge variant="secondary">{outputs.length}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {outputs.filter(o => o.addedToReport).length} added to report
          </span>
        </div>
      </div>

      {/* Outputs */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 min-h-0 overflow-auto">
          {outputs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No output yet
            </div>
          ) : (
            outputs.map((output) => (
              <Card key={output.id} className="p-4">
                {/* Output header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getIcon(output.type)}
                    <span className="text-sm">{output.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {output.timestamp.toLocaleTimeString()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleReportItem(output.id)}
                    >
                      {output.addedToReport ? (
                        <CheckSquare className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeOutput(output.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Output content */}
                {renderOutput(output)}

                {/* Actions */}
                {output.type === 'chart' && (
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export Image
                    </Button>
                    <Button variant="outline" size="sm">
                      <FileText className="w-4 h-4 mr-2" />
                      Generate Caption
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
