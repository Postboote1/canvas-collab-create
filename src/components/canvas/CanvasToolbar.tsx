
import React from 'react';
import { Button } from '@/components/ui/button';
import {
  MousePointer,
  Square,
  Type,
  Pencil,
  Image,
  ArrowRight,
  Save,
  Download,
  FileUp,
  ZoomIn,
  ZoomOut,
  Trash
} from 'lucide-react';
import { useCanvas } from '@/contexts/CanvasContext';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

interface CanvasToolbarProps {
  activeTool: 'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow';
  setActiveTool: (tool: 'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow') => void;
  onSave: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly: boolean;
  scale: number;
  setScale: (scale: number) => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  activeTool,
  setActiveTool,
  onSave,
  onImageUpload,
  readOnly,
  scale,
  setScale
}) => {
  const { exportAsImage, exportAsPDF, exportCanvasData, importCanvasData, clearCanvas } = useCanvas();
  
  const tools = [
    { name: 'Select', tool: 'select', icon: <MousePointer size={18} /> },
    { name: 'Card', tool: 'card', icon: <Square size={18} /> },
    { name: 'Text', tool: 'text', icon: <Type size={18} /> },
    { name: 'Draw', tool: 'draw', icon: <Pencil size={18} /> },
    { name: 'Image', tool: 'image', icon: <Image size={18} /> },
    { name: 'Arrow', tool: 'arrow', icon: <ArrowRight size={18} /> }
  ] as const;
  
  const handleImportCanvas = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          try {
            const success = importCanvasData(event.target.result);
            if (success) {
              toast.success('Canvas imported successfully');
            }
          } catch (error) {
            toast.error('Failed to import canvas: Invalid file format');
          }
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  };
  
  const handleExportCanvas = () => {
    const data = exportCanvasData();
    if (!data) return;
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'canvas_export.json';
    link.click();
    URL.revokeObjectURL(url);
    
    toast.success('Canvas exported successfully');
  };
  
  return (
    <div className="border-b bg-white p-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-1">
        {!readOnly && tools.map(({ name, tool, icon }) => (
          <Button
            key={tool}
            variant={activeTool === tool ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool(tool)}
            title={name}
          >
            {icon}
          </Button>
        ))}
      </div>
      
      <div className="flex items-center gap-2">
        <ZoomOut size={14} className="text-gray-500" />
        <Slider
          className="w-24"
          value={[scale * 100]}
          min={10}
          max={200}
          step={5}
          onValueChange={(value) => setScale(value[0] / 100)}
        />
        <ZoomIn size={14} className="text-gray-500" />
        <span className="text-xs text-gray-500 w-12">{Math.round(scale * 100)}%</span>
      </div>
      
      <div className="flex flex-wrap gap-1">
        {!readOnly && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              title="Save Canvas"
            >
              <Save size={18} />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={clearCanvas}
              title="Clear Canvas"
            >
              <Trash size={18} />
            </Button>
            
            <label>
              <Button
                variant="outline"
                size="sm"
                title="Upload Image"
                asChild
              >
                <span>
                  <Image size={18} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onImageUpload}
                  />
                </span>
              </Button>
            </label>
          </>
        )}
        
        <Button
          variant="outline"
          size="sm"
          onClick={exportAsImage}
          title="Export as Image"
        >
          <Download size={18} />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={exportAsPDF}
          title="Export as PDF"
        >
          <FileUp size={18} />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCanvas}
          title="Export Canvas"
        >
          Export
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportCanvas}
          title="Import Canvas"
        >
          Import
        </Button>
      </div>
    </div>
  );
};

export default CanvasToolbar;
