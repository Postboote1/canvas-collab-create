import React, { useState, ChangeEvent } from 'react';
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
  Trash,
  Palette,
  Circle,
  Triangle,
  Diamond,
  Sun,
  Moon
} from 'lucide-react';
import { useCanvas } from '@/contexts/CanvasContext';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface CanvasToolbarProps {
  activeTool: 'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow' | 'circle' | 'triangle' | 'diamond';
  setActiveTool: (tool: 'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow' | 'circle' | 'triangle' | 'diamond') => void;
  onSave: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly: boolean;
  scale: number;
  setScale: (scale: number) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
}

const CanvasToolbar: React.FC<CanvasToolbarProps> = ({
  activeTool,
  setActiveTool,
  onSave,
  onImageUpload,
  readOnly,
  scale,
  setScale,
  activeColor,
  setActiveColor
}) => {
  const { exportAsImage, exportAsPDF, exportCanvasData, importCanvasData, clearCanvas } = useCanvas();
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  
  const tools = [
    { name: 'Select', tool: 'select' as const, icon: <MousePointer size={18} />, tooltip: 'Select and move objects' },
    { name: 'Card', tool: 'card' as const, icon: <Square size={18} />, tooltip: 'Add a text card' },
    { name: 'Text', tool: 'text' as const, icon: <Type size={18} />, tooltip: 'Add text' },
    { name: 'Draw', tool: 'draw' as const, icon: <Pencil size={18} />, tooltip: 'Free drawing' },
    { name: 'Image', tool: 'image' as const, icon: <Image size={18} />, tooltip: 'Add image' },
    { name: 'Arrow', tool: 'arrow' as const, icon: <ArrowRight size={18} />, tooltip: 'Connect objects with arrows' },
    { name: 'Circle', tool: 'circle' as const, icon: <Circle size={18} />, tooltip: 'Add circle shape' },
    { name: 'Triangle', tool: 'triangle' as const, icon: <Triangle size={18} />, tooltip: 'Add triangle shape' },
    { name: 'Diamond', tool: 'diamond' as const, icon: <Diamond size={18} />, tooltip: 'Add diamond shape' }
  ];
  
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

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);
    toast.success(`${tool} tool selected`);
  };
  
  const handleExportAsImage = () => {
    if (typeof window !== 'undefined' && window.__canvasExportMethods) {
      window.__canvasExportMethods.exportAsImage();
    } else {
      exportAsImage();
    }
  };
  
  const handleExportAsPDF = () => {
    if (typeof window !== 'undefined' && window.__canvasExportMethods) {
      window.__canvasExportMethods.exportAsPDF();
    } else {
      exportAsPDF();
    }
  };
  
  const handleClearCanvas = () => {
    if (window.confirm('Are you sure you want to clear the canvas? This action cannot be undone.')) {
      clearCanvas();
      toast.success('Canvas cleared');
    }
  };
  
  return (
    <TooltipProvider delayDuration={300}>
      <Card className="border-b bg-card shadow-sm">
        <CardContent className="p-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {!readOnly && (
              <div className="flex flex-wrap items-center p-1 bg-muted/20 rounded-md">
                {tools.map(({ name, tool, icon, tooltip }) => (
                  <Tooltip key={tool}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={activeTool === tool ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => handleToolClick(tool)}
                        className={`h-8 px-2 ${activeTool === tool ? 'bg-primary text-primary-foreground' : ''}`}
                      >
                        {icon}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{tooltip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
            
            {!readOnly && (
              <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="relative h-8"
                  >
                    <Palette size={18} />
                    <div 
                      className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-gray-300" 
                      style={{ backgroundColor: activeColor }}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3">
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium">Color</p>
                    <div className="grid grid-cols-4 gap-2">
                      {['#FFFFFF', '#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#000000'].map(color => (
                        <div
                          key={color}
                          className={`w-6 h-6 rounded cursor-pointer ${activeColor === color ? 'ring-2 ring-blue-500' : 'border border-gray-300'}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setActiveColor(color)}
                        />
                      ))}
                    </div>
                    <div>
                      <input 
                        type="color" 
                        value={activeColor} 
                        onChange={(e) => setActiveColor(e.target.value)} 
                        className="w-full" 
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <ZoomOut size={14} className="text-muted-foreground" />
            <Slider
              className="w-24"
              value={[scale * 100]}
              min={10}
              max={200}
              step={5}
              onValueChange={(value) => setScale(value[0] / 100)}
            />
            <ZoomIn size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground w-12">{Math.round(scale * 100)}%</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <Switch
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                className="ml-1"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {!readOnly && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onSave}
                      className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Save size={18} className="mr-1" />
                      Save
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Save Canvas</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleClearCanvas}
                      className="h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Trash size={18} className="mr-1" />
                      Clear
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Clear Canvas</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 cursor-pointer"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (ev: Event) => {
                          onImageUpload(ev as unknown as ChangeEvent<HTMLInputElement>);
                        };
                        input.click();
                      }}
                    >
                      <Image size={18} className="mr-1" />
                      Upload
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Upload Image</TooltipContent>
                </Tooltip>
              </>
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAsImage}
                  className="h-8 bg-blue-500 text-white hover:bg-blue-600"
                >
                  <Download size={18} className="mr-1" />
                  PNG
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Export as Image</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportAsPDF}
                  className="h-8 bg-red-500 text-white hover:bg-red-600"
                >
                  <FileUp size={18} className="mr-1" />
                  PDF
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Export as PDF</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCanvas}
                  className="h-8 bg-green-500 text-white hover:bg-green-600"
                >
                  Export
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Export Canvas</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportCanvas}
                  className="h-8 bg-purple-500 text-white hover:bg-purple-600"
                >
                  Import
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Import Canvas</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default CanvasToolbar;
