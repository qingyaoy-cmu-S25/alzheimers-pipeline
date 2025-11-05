import { WorkflowStep } from '../types';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

interface ParameterDrawerProps {
  currentStep: WorkflowStep;
}

export function ParameterDrawer({ currentStep }: ParameterDrawerProps) {
  const renderParameters = () => {
    switch (currentStep) {
      case 'environment':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>GPU Device</Label>
              <Select defaultValue="cuda:0">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cuda:0">CUDA:0 (RTX 4090)</SelectItem>
                  <SelectItem value="cpu">CPU</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Memory Limit (GB)</Label>
              <Input type="number" defaultValue="16" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-fix Dependencies</Label>
              <Switch defaultChecked />
            </div>
          </div>
        );

      case 'import':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>File Format</Label>
              <Select defaultValue="h5ad">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="h5ad">H5AD</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="tsv">TSV</SelectItem>
                  <SelectItem value="parquet">Parquet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-handle Missing Values</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>Type Inference</Label>
              <Switch defaultChecked />
            </div>
            <div className="space-y-2">
              <Label>Missing Value Threshold (%)</Label>
              <Slider defaultValue={[20]} max={100} step={1} />
            </div>
          </div>
        );

      case 'qc':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Min Genes</Label>
              <Input type="number" defaultValue="200" />
            </div>
            <div className="space-y-2">
              <Label>Min Cells</Label>
              <Input type="number" defaultValue="3" />
            </div>
            <div className="space-y-2">
              <Label>Max Mitochondrial % </Label>
              <Input type="number" defaultValue="20" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Batch Effect Detection</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>Generate Detailed Report</Label>
              <Switch defaultChecked />
            </div>
          </div>
        );

      case 'visualization':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Chart Type</Label>
              <Select defaultValue="umap">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="umap">UMAP</SelectItem>
                  <SelectItem value="tsne">t-SNE</SelectItem>
                  <SelectItem value="volcano">Volcano Plot</SelectItem>
                  <SelectItem value="heatmap">Heatmap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color Scheme</Label>
              <Select defaultValue="viridis">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viridis">Viridis</SelectItem>
                  <SelectItem value="plasma">Plasma</SelectItem>
                  <SelectItem value="rainbow">Rainbow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Point Size</Label>
              <Slider defaultValue={[5]} max={20} step={1} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show Legend</Label>
              <Switch defaultChecked />
            </div>
          </div>
        );

      case 'modeling':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Model Type</Label>
              <Select defaultValue="scanvi">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scanvi">scANVI</SelectItem>
                  <SelectItem value="scvi">scVI</SelectItem>
                  <SelectItem value="totalvi">totalVI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Learning Rate</Label>
              <Input type="number" step="0.0001" defaultValue="0.001" />
            </div>
            <div className="space-y-2">
              <Label>Epochs</Label>
              <Input type="number" defaultValue="100" />
            </div>
            <div className="space-y-2">
              <Label>Batch Size</Label>
              <Input type="number" defaultValue="128" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Early Stopping</Label>
              <Switch defaultChecked />
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select defaultValue="pdf">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Include Code</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>Generate Reproducible Script</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>Include Parameters</Label>
              <Switch defaultChecked />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mt-6">
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <div className="space-y-6 pr-4">
          {renderParameters()}
          
          <Separator />
          
          <div className="space-y-2">
            <Button className="w-full">Apply Parameters</Button>
            <Button variant="outline" className="w-full">
              Reset to Default
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
