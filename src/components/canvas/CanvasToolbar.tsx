
// @allowedFileUpdate src/components/canvas/CanvasToolbar.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, Maximize, Square, Text, Image, Pencil, ArrowRight, PanelRightOpen, Move, Circle, Triangle, MousePointer } from 'lucide-react';
import { toast } from 'sonner';

interface CanvasToolbarProps {
  activeTool: 'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow' | 'circle' | 'triangle' | 'diamond' | 'frame';
  setActiveTool: (tool: 'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow' | 'circle' | 'triangle' | 'diamond' | 'frame') => void;
  onSave: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
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
  readOnly = false,
  scale,
  setScale,
  activeColor,
  setActiveColor
}) => {
  const handleZoomIn = () => {
    setScale(Math.min(5, scale * 1.2));
  };

  const handleZoomOut = () => {
    setScale(Math.max(0.1, scale * 0.8));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveColor(e.target.value);
  };

  const handleClick = (tool: typeof activeTool) => {
    if (readOnly) {
      toast.error('Canvas is in read-only mode');
      return;
    }
    
    setActiveTool(tool);
    
    if (tool === 'select') {
      toast.info('Select and move elements', {
        position: 'bottom-center',
        duration: 1000,
      });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border-b dark:border-zinc-700">
      <div className="flex items-center gap-1 flex-wrap">
        <Button
          type="button"
          size="icon"
          variant={activeTool === 'select' ? 'default' : 'ghost'}
          onClick={() => handleClick('select')}
          className="h-8 w-8"
          title="Select (S)"
        >
          <MousePointer size={16} />
        </Button>
        
        <Button
          type="button"
          size="icon"
          variant={activeTool === 'card' ? 'default' : 'ghost'}
          onClick={() => handleClick('card')}
          className="h-8 w-8"
          title="Add Card (C)"
          disabled={readOnly}
        >
          <Square size={16} />
        </Button>
        
        <Button
          type="button"
          size="icon"
          variant={activeTool === 'text' ? 'default' : 'ghost'}
          onClick={() => handleClick('text')}
          className="h-8 w-8"
          title="Add Text (T)"
          disabled={readOnly}
        >
          <Text size={16} />
        </Button>
        
        <Button
          type="button"
          size="icon"
          variant={activeTool === 'draw' ? 'default' : 'ghost'}
          onClick={() => handleClick('draw')}
          className="h-8 w-8"
          title="Draw (D)"
          disabled={readOnly}
        >
          <Pencil size={16} />
        </Button>
        
        <Button
          type="button"
          size="icon"
          variant={activeTool === 'image' ? 'default' : 'ghost'}
          onClick={() => handleClick('image')}
          className="h-8 w-8"
          title="Add Image (I)"
          disabled={readOnly}
        >
          <Image size={16} />
        </Button>
        
        <Button
          type="button"
          size="icon"
          variant={activeTool === 'arrow' ? 'default' : 'ghost'}
          onClick={() => handleClick('arrow')}
          className="h-8 w-8"
          title="Connect Elements with Arrow (A)"
          disabled={readOnly}
        >
          <ArrowRight size={16} />
        </Button>
        
        <Button
          type="button"
          size="icon"
          variant={activeTool === 'circle' ? 'default' : 'ghost'}
          onClick={() => handleClick('circle')}
          className="h-8 w-8"
          title="Add Circle"
          disabled={readOnly}
        >
          <Circle size={16} />
        </Button>
        
        <Button
          type="button"
          size="icon"
          variant={activeTool === 'triangle' ? 'default' : 'ghost'}
          onClick={() => handleClick('triangle')}
          className="h-8 w-8"
          title="Add Triangle"
          disabled={readOnly}
        >
          <Triangle size={16} />
        </Button>
        
        <Button
          type="button"
          size="icon"
          variant={activeTool === 'frame' ? 'default' : 'ghost'}
          onClick={() => handleClick('frame')}
          className="h-8 w-8"
          title="Add Frame (F)"
          disabled={readOnly}
        >
          <PanelRightOpen size={16} />
        </Button>
        
        <input 
          type="color" 
          value={activeColor}
          onChange={handleColorChange}
          className="h-8 w-8 rounded-sm cursor-pointer border-0"
          title="Select Color"
          disabled={readOnly}
        />
      </div>

      <div className="flex-1"></div>
      
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="outline" onClick={handleZoomOut} className="h-8 px-1.5" title="Zoom Out">
          <span className="mr-1">-</span>
        </Button>
        <Button 
          type="button" 
          size="sm" 
          variant="outline" 
          onClick={handleResetZoom} 
          className="h-8 px-2"
          title="Reset Zoom"
        >
          {Math.round(scale * 100)}%
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleZoomIn} className="h-8 px-1.5" title="Zoom In">
          <span className="mr-1">+</span>
        </Button>
      </div>
      
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          className="h-8"
          onClick={onSave}
          disabled={readOnly}
        >
          <Save size={16} className="mr-1" />
          Save
        </Button>
      </div>
    </div>
  );
};

export default CanvasToolbar;
