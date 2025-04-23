import React, { useState, ChangeEvent, useRef, useEffect } from 'react';
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
  Moon,
  Settings,
  Hand,
  Fingerprint,
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
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CanvasToolbarProps {
  activeTool: 'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow' | 'circle' | 'triangle' | 'diamond' | 'pan';
  setActiveTool: (tool: 'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow' | 'circle' | 'triangle' | 'diamond' | 'pan') => void;
  onSave: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly: boolean;
  scale: number;
  setScale: (scale: number) => void;
  activeColor: string;
  setActiveColor: (color: string) => void;
  touchDrawingMode?: boolean;
  setTouchDrawingMode?: (enabled: boolean) => void;
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
  setActiveColor,
  touchDrawingMode = false,
  setTouchDrawingMode = () => {}
}) => {
  const { exportAsImage, exportAsPDF, exportCanvasData, importCanvasData, clearCanvas, currentCanvas } = useCanvas();
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [touchSettings, setTouchSettings] = useState({
    fingerSize: 'medium',
    drawLatency: 'medium',
    gestureMode: 'standard',
  });
  
  // Track if we're using a touch device
  const [isTouchDevice] = useState(
    'ontouchstart' in window || navigator.maxTouchPoints > 0
  );
  
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  const tools = [
    // Add pan tool specifically for touch devices
    ...(isTouchDevice ? [{ name: 'Pan', tool: 'pan' as const, icon: <Hand size={18} />, tooltip: 'Pan the canvas' }] : []),
    { name: 'Select', tool: 'select' as const, icon: <MousePointer size={18} />, tooltip: 'Select and move objects' },
    { name: 'Card', tool: 'card' as const, icon: <Square size={18} />, tooltip: 'Add a text card' },
    { name: 'Text', tool: 'text' as const, icon: <Type size={18} />, tooltip: 'Add text' },
    { name: 'Draw', tool: 'draw' as const, icon: <Pencil size={18} />, tooltip: 'Free drawing' },
    { name: 'Image', tool: 'image' as const, icon: <Image size={18} />, tooltip: 'Add image' },
    { name: 'Arrow', tool: 'arrow' as const, icon: <ArrowRight size={18} />, tooltip: 'Connect objects with arrows' },
    { name: 'Circle', tool: 'circle' as const, icon: <Circle size={18} />, tooltip: 'Add circle shape' },
    { name: 'Triangle', tool: 'triangle' as const, icon: <Triangle size={18} />, tooltip: 'Add triangle shape' },
    { name: 'Diamond', tool: 'diamond' as const, icon: <Diamond size={18} />, tooltip: 'Add diamond shape' },
  ];
  
  // Scroll toolbar when active tool changes to ensure it's visible
  useEffect(() => {
    if (isMobile && toolbarRef.current) {
      const activeToolElement = toolbarRef.current.querySelector(`[data-tool="${activeTool}"]`);
      if (activeToolElement) {
        activeToolElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTool, isMobile]);
  
  // Update local storage with touch settings
  useEffect(() => {
    if (touchSettings) {
      localStorage.setItem('touchSettings', JSON.stringify(touchSettings));
    }
  }, [touchSettings]);
  
  // Load touch settings from local storage
  useEffect(() => {
    const savedSettings = localStorage.getItem('touchSettings');
    if (savedSettings) {
      try {
        setTouchSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error('Error loading touch settings:', e);
      }
    }
  }, []);
  
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
            if (importCanvasData(event.target.result)) {
              toast.success('Canvas imported successfully');
            }
          } catch (error) {
            console.error('Import error:', error);
            toast.error('Failed to import canvas: Invalid file format');
          }
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  };
  
  const handleExportCanvas = async () => {
    const data = await exportCanvasData();
    if (!data) return;
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentCanvas?.name || 'canvas'}_export.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Canvas exported successfully');
  };

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);
    
    // Switch to touch drawing mode automatically when drawing tool is selected on touch devices
    if (tool === 'draw' && isTouchDevice) {
      setTouchDrawingMode(true);
      toast.success(`Touch drawing mode enabled`);
    } else if (isTouchDevice) {
      setTouchDrawingMode(false);
    }
    
    toast.success(`${tool} tool selected`, {
      id: 'tool-selected',
      duration: 1000
    });
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
    <TooltipProvider delayDuration={isTouchDevice ? 500 : 300}>
      <Card className="border-b bg-card shadow-sm">
        <CardContent className={`p-2 ${isMobile ? 'overflow-x-auto' : 'flex flex-wrap'} items-center justify-between gap-2`}>
          <div 
            className={`flex items-center p-1 bg-muted/20 rounded-md ${isMobile ? 'overflow-x-auto touch-pan-x w-full' : 'flex-wrap'}`}
            ref={toolbarRef}
          >
            {!readOnly && tools.map(({ name, tool, icon, tooltip }) => (
              <Tooltip key={tool}>
                <TooltipTrigger asChild>
                  <Button
                    variant={activeTool === tool ? 'default' : 'ghost'}
                    size={isMobile ? 'sm' : 'default'}
                    onClick={() => handleToolClick(tool)}
                    className={`h-10 px-2 mr-1 ${activeTool === tool ? 'bg-primary text-primary-foreground' : ''} ${isMobile ? 'min-w-[40px]' : ''}`}
                    data-tool={tool}
                  >
                    {icon}
                    {!isMobile && <span className="ml-1">{name}</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{tooltip}</TooltipContent>
              </Tooltip>
            ))}
            
            {!readOnly && (
              <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size={isMobile ? 'sm' : 'default'}
                    className="relative h-10 min-w-[40px] ml-1"
                  >
                    <Palette size={18} />
                    <div 
                      className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-gray-300" 
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
                          className={`w-8 h-8 rounded cursor-pointer ${activeColor === color ? 'ring-2 ring-blue-500' : 'border border-gray-300'}`}
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
            
            {/* Touch mode toggle for drawing - only on touch devices */}
            {isTouchDevice && !readOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={touchDrawingMode ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setTouchDrawingMode(!touchDrawingMode)}
                    className={`h-10 px-2 ml-1 ${touchDrawingMode ? 'bg-green-500 text-white' : ''}`}
                  >
                    <Fingerprint size={18} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {touchDrawingMode ? 'Disable touch drawing' : 'Enable touch drawing'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {isMobile ? (
            <div className="flex justify-between w-full mt-2">
              <div className="flex items-center gap-1">
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
                <span className="text-xs text-muted-foreground w-10">{Math.round(scale * 100)}%</span>
              </div>
              
              {/* Mobile menu button */}
              <Popover open={showMobileMenu} onOpenChange={setShowMobileMenu}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto">
                    <Settings size={16} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60">
                  <div className="grid gap-2">
                    {!readOnly && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onSave}
                          className="justify-start"
                        >
                          <Save size={16} className="mr-2" />
                          Save Canvas
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearCanvas}
                          className="justify-start text-destructive"
                        >
                          <Trash size={16} className="mr-2" />
                          Clear Canvas
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start"
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
                          <Image size={16} className="mr-2" />
                          Upload Image
                        </Button>
                      </>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportAsImage}
                      className="justify-start"
                    >
                      <Download size={16} className="mr-2" />
                      Export as PNG
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportAsPDF}
                      className="justify-start"
                    >
                      <FileUp size={16} className="mr-2" />
                      Export as PDF
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCanvas}
                      className="justify-start"
                    >
                      <Download size={16} className="mr-2" />
                      Export Canvas
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleImportCanvas}
                      className="justify-start"
                    >
                      <FileUp size={16} className="mr-2" />
                      Import Canvas
                    </Button>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center">
                        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      </div>
                      <span className="text-sm">Dark mode</span>
                      <Switch
                        checked={theme === 'dark'}
                        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                      />
                    </div>
                    
                    {/* Touch settings dialog */}
                    {isTouchDevice && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="justify-start mt-2">
                            <Fingerprint size={16} className="mr-2" />
                            Touch Settings
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Touch Screen Settings</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div>
                              <label className="text-sm font-medium">Drawing Finger Size</label>
                              <div className="grid grid-cols-3 gap-2 mt-1">
                                {['small', 'medium', 'large'].map((size) => (
                                  <Button
                                    key={size}
                                    variant={touchSettings.fingerSize === size ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTouchSettings({...touchSettings, fingerSize: size})}
                                  >
                                    {size.charAt(0).toUpperCase() + size.slice(1)}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium">Drawing Latency</label>
                              <div className="grid grid-cols-3 gap-2 mt-1">
                                {['low', 'medium', 'high'].map((latency) => (
                                  <Button
                                    key={latency}
                                    variant={touchSettings.drawLatency === latency ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTouchSettings({...touchSettings, drawLatency: latency})}
                                  >
                                    {latency.charAt(0).toUpperCase() + latency.slice(1)}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-sm font-medium">Gesture Mode</label>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                {['standard', 'advanced'].map((mode) => (
                                  <Button
                                    key={mode}
                                    variant={touchSettings.gestureMode === mode ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setTouchSettings({...touchSettings, gestureMode: mode})}
                                  >
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <>
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
                
                {/* Touch settings for desktop */}
                {isTouchDevice && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Fingerprint size={16} className="mr-2" />
                        Touch Options
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Touch Screen Settings</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        {/* Same settings as mobile version */}
                        <div>
                          <label className="text-sm font-medium">Drawing Finger Size</label>
                          <div className="grid grid-cols-3 gap-2 mt-1">
                            {['small', 'medium', 'large'].map((size) => (
                              <Button
                                key={size}
                                variant={touchSettings.fingerSize === size ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTouchSettings({...touchSettings, fingerSize: size})}
                              >
                                {size.charAt(0).toUpperCase() + size.slice(1)}
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Drawing Latency</label>
                          <div className="grid grid-cols-3 gap-2 mt-1">
                            {['low', 'medium', 'high'].map((latency) => (
                              <Button
                                key={latency}
                                variant={touchSettings.drawLatency === latency ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTouchSettings({...touchSettings, drawLatency: latency})}
                              >
                                {latency.charAt(0).toUpperCase() + latency.slice(1)}
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Gesture Mode</label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {['standard', 'advanced'].map((mode) => (
                              <Button
                                key={mode}
                                variant={touchSettings.gestureMode === mode ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setTouchSettings({...touchSettings, gestureMode: mode})}
                              >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
              
              <div className="flex flex-wrap gap-1">
                {!readOnly && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={onSave}
                          className="h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          <Save size={18} className="mr-1" />
                          <span>Save</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Save Canvas</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="default"
                          onClick={handleClearCanvas}
                          className="h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          <Trash size={18} className="mr-1" />
                          <span>Clear</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">Clear Canvas</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="default"
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
                          <span>Upload</span>
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
                      size="default"
                      onClick={handleExportAsImage}
                      className="h-8 bg-blue-500 text-white hover:bg-blue-600"
                    >
                      <Download size={18} className="mr-1" />
                      <span>PNG</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Export as Image</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={handleExportAsPDF}
                      className="h-8 bg-red-500 text-white hover:bg-red-600"
                    >
                      <FileUp size={18} className="mr-1" />
                      <span>PDF</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Export as PDF</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={handleExportCanvas}
                      className="h-8 bg-green-500 text-white hover:bg-green-600"
                    >
                      <span>Export</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Export Canvas</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={handleImportCanvas}
                      className="h-8 bg-purple-500 text-white hover:bg-purple-600"
                    >
                      <span>Import</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Import Canvas</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default CanvasToolbar;