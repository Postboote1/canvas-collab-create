
import React, { useState, useRef, useEffect } from 'react';
import { CanvasElement as ICanvasElement } from '@/contexts/CanvasContext';
import { Menu } from '@/components/ui/menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Palette, Maximize, Trash } from 'lucide-react';

interface CanvasElementProps {
  element: ICanvasElement;
  selected: boolean;
  onUpdateElement: (updates: Partial<ICanvasElement>) => void;
  onDeleteElement?: (id: string) => void;
  readOnly: boolean;
  allElements: ICanvasElement[];
}

const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  selected,
  onUpdateElement,
  onDeleteElement,
  readOnly,
  allElements
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  
  // Calculate minimum heights for cards based on content
  useEffect(() => {
    if (element.type === 'card' && elementRef.current && !isEditing && !isResizing) {
      const contentHeight = elementRef.current.scrollHeight;
      const currentHeight = element.height || 150;
      
      // If content height is greater than current height, update it
      if (contentHeight > currentHeight) {
        onUpdateElement({ height: contentHeight + 24 }); // Add some padding
      }
    }
  }, [element.content, element.type, isEditing, isResizing]);

  // Auto-resize textarea when editing
  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [isEditing, element.content]);
  
  const handleDoubleClick = () => {
    if (!readOnly && (element.type === 'card' || element.type === 'text')) {
      setIsEditing(true);
    }
  };
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateElement({ content: e.target.value });
    
    // Auto-resize textarea
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  };
  
  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleColorChange = (color: string) => {
    onUpdateElement({ color: color });
    setShowColorPicker(false);
  };
  
  const handleContextMenu = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    setShowColorPicker(true);
  };
  
  const handleResizeStart = (e: React.MouseEvent) => {
    if (readOnly) return;
    
    setIsResizing(true);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setOriginalDimensions({ 
      width: element.width || 200, 
      height: element.height || 150 
    });
    
    // Add event listeners for resize
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    
    // Prevent event propagation
    e.stopPropagation();
  };
  
  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - resizeStartPos.x;
    const deltaY = e.clientY - resizeStartPos.y;
    
    const newWidth = Math.max(100, originalDimensions.width + deltaX);
    const newHeight = Math.max(75, originalDimensions.height + deltaY);
    
    onUpdateElement({ 
      width: newWidth, 
      height: newHeight 
    });
  };
  
  const handleResizeEnd = () => {
    setIsResizing(false);
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
  
  const handleDelete = () => {
    if (onDeleteElement) {
      onDeleteElement(element.id);
    }
  };
  
  const renderResizeHandle = () => {
    if (!selected || readOnly || element.type === 'text' || element.type === 'drawing' || element.type === 'arrow') {
      return null;
    }
    
    return (
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize z-10 rounded-bl"
        onMouseDown={handleResizeStart}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleResizeStart(e);
        }}
      />
    );
  };

  const renderControlsMenu = () => {
    if (!selected || readOnly || element.type === 'drawing') {
      return null;
    }
    
    return (
      <div className="absolute -top-8 right-0 flex items-center gap-1 bg-background/80 backdrop-blur-sm border rounded p-1 shadow-md z-20">
        <Popover open={showColorPicker} onOpenChange={setShowColorPicker}>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full p-0">
              <Palette size={14} />
              <span className="sr-only">Change color</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium">Color</p>
              <div className="grid grid-cols-4 gap-2">
                {['#FFFFFF', '#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#000000'].map(color => (
                  <div
                    key={color}
                    className={`w-6 h-6 rounded cursor-pointer border ${element.color === color ? 'ring-2 ring-blue-500' : 'border-gray-300'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleColorChange(color)}
                  />
                ))}
              </div>
              <div className="mt-2">
                <input 
                  type="color" 
                  value={element.color || '#FFFFFF'} 
                  onChange={(e) => handleColorChange(e.target.value)} 
                  className="w-full h-6" 
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {(element.type === 'card' || element.type === 'image') && (
          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full p-0" onClick={handleResizeStart}>
            <Maximize size={14} />
            <span className="sr-only">Resize</span>
          </Button>
        )}
        
        <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full p-0 text-destructive" onClick={handleDelete}>
          <Trash size={14} />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    );
  };
  
  const getArrowCoordinates = () => {
    if (element.type !== 'arrow' || !element.fromId || !element.toId) return null;
    
    const fromElement = allElements.find(el => el.id === element.fromId);
    const toElement = allElements.find(el => el.id === element.toId);
    
    if (!fromElement || !toElement) return null;
    
    // Calculate boundaries of elements
    const fromRect = {
      left: fromElement.x,
      top: fromElement.y,
      right: fromElement.x + (fromElement.width || 100),
      bottom: fromElement.y + (fromElement.height || 50),
      centerX: fromElement.x + (fromElement.width || 100) / 2,
      centerY: fromElement.y + (fromElement.height || 50) / 2,
    };
    
    const toRect = {
      left: toElement.x,
      top: toElement.y,
      right: toElement.x + (toElement.width || 100),
      bottom: toElement.y + (toElement.height || 50),
      centerX: toElement.x + (toElement.width || 100) / 2,
      centerY: toElement.y + (toElement.height || 50) / 2,
    };
    
    // Find the shortest path for the arrow between the two elements
    const possiblePaths = [
      // From right edge to left edge
      {
        from: { x: fromRect.right, y: fromRect.centerY },
        to: { x: toRect.left, y: toRect.centerY }
      },
      // From left edge to right edge
      {
        from: { x: fromRect.left, y: fromRect.centerY },
        to: { x: toRect.right, y: toRect.centerY }
      },
      // From bottom edge to top edge
      {
        from: { x: fromRect.centerX, y: fromRect.bottom },
        to: { x: toRect.centerX, y: toRect.top }
      },
      // From top edge to bottom edge
      {
        from: { x: fromRect.centerX, y: fromRect.top },
        to: { x: toRect.centerX, y: toRect.bottom }
      }
    ];
    
    // Find the shortest path
    let shortestPath = possiblePaths[0];
    let shortestDistance = Math.hypot(
      shortestPath.to.x - shortestPath.from.x,
      shortestPath.to.y - shortestPath.from.y
    );
    
    for (let i = 1; i < possiblePaths.length; i++) {
      const distance = Math.hypot(
        possiblePaths[i].to.x - possiblePaths[i].from.x,
        possiblePaths[i].to.y - possiblePaths[i].from.y
      );
      
      if (distance < shortestDistance) {
        shortestDistance = distance;
        shortestPath = possiblePaths[i];
      }
    }
    
    return {
      fromX: shortestPath.from.x,
      fromY: shortestPath.from.y,
      toX: shortestPath.to.x,
      toY: shortestPath.to.y
    };
  };
  
  const renderElement = () => {
    switch (element.type) {
      case 'card':
        return (
          <div
            ref={elementRef}
            className={`absolute card-canvas rounded-md p-3 ${selected ? 'ring-2 ring-blue-500' : ''}`}
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              backgroundColor: element.color || '#ffffff',
              cursor: readOnly ? 'default' : 'move',
              minHeight: '75px',
              overflowY: 'auto'
            }}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
          >
            {isEditing ? (
              <textarea
                ref={textAreaRef}
                className="w-full h-full border-none resize-none focus:outline-none bg-transparent"
                value={element.content}
                onChange={handleContentChange}
                onBlur={handleBlur}
                autoFocus
                style={{ minHeight: '100%' }}
              />
            ) : (
              <div className="w-full h-full overflow-auto whitespace-pre-wrap break-words">
                {element.content}
              </div>
            )}
            {renderResizeHandle()}
            {selected && renderControlsMenu()}
          </div>
        );
        
      case 'text':
        return (
          <div
            className={`absolute ${selected ? 'ring-2 ring-blue-500' : ''}`}
            style={{
              left: element.x,
              top: element.y,
              cursor: readOnly ? 'default' : 'move'
            }}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
          >
            {isEditing ? (
              <textarea
                ref={textAreaRef}
                className="border-none resize-none focus:outline-none bg-transparent"
                value={element.content}
                onChange={handleContentChange}
                onBlur={handleBlur}
                autoFocus
              />
            ) : (
              <div
                style={{
                  color: element.color || '#000000',
                  fontSize: element.fontSize ? `${element.fontSize}px` : '16px'
                }}
              >
                {element.content}
              </div>
            )}
            {selected && renderControlsMenu()}
          </div>
        );
        
      case 'drawing':
        if (!element.points || element.points.length < 2) return null;
        
        return (
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{
              left: 0,
              top: 0
            }}
          >
            <polyline
              points={element.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={element.color || '#000000'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
        
      case 'image':
        return (
          <div
            ref={elementRef}
            className={`absolute ${selected ? 'ring-2 ring-blue-500' : ''}`}
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              cursor: readOnly ? 'default' : 'move'
            }}
            onContextMenu={handleContextMenu}
          >
            <img
              src={element.imageUrl}
              alt="Canvas element"
              className="w-full h-full object-contain"
            />
            {renderResizeHandle()}
            {selected && renderControlsMenu()}
          </div>
        );
        
      case 'arrow':
        const coords = getArrowCoordinates();
        
        if (!coords) return null;
        const { fromX, fromY, toX, toY } = coords;
        
        // Calculate direction and marker offset
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);
        const markerOffset = 8; // Offset for the arrowhead
        
        // Calculate the endpoint with offset to place arrowhead correctly
        const endX = toX - markerOffset * Math.cos(angle);
        const endY = toY - markerOffset * Math.sin(angle);
        
        return (
          <svg
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{
              left: 0,
              top: 0
            }}
          >
            {/* Arrow line */}
            <line
              x1={fromX}
              y1={fromY}
              x2={endX}
              y2={endY}
              stroke={element.color || '#000000'}
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
            
            {/* Arrow head */}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="0"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill={element.color || '#000000'}
                />
              </marker>
            </defs>
            
            {selected && renderControlsMenu()}
          </svg>
        );
        
      case 'shape':
        return (
          <div
            ref={elementRef}
            className={`absolute ${selected ? 'ring-2 ring-blue-500' : ''}`}
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              cursor: readOnly ? 'default' : 'move'
            }}
            onContextMenu={handleContextMenu}
          >
            <svg width="100%" height="100%" viewBox={`0 0 ${element.width} ${element.height}`}>
              {element.shapeType === 'circle' && (
                <circle
                  cx={element.width! / 2}
                  cy={element.height! / 2}
                  r={Math.min(element.width!, element.height!) / 2 - 2}
                  fill={element.color || '#ffffff'}
                  stroke="#000000"
                  strokeWidth="2"
                />
              )}
              {element.shapeType === 'triangle' && (
                <polygon
                  points={`${element.width! / 2},5 5,${element.height! - 5} ${element.width! - 5},${element.height! - 5}`}
                  fill={element.color || '#ffffff'}
                  stroke="#000000"
                  strokeWidth="2"
                />
              )}
              {element.shapeType === 'diamond' && (
                <polygon
                  points={`${element.width! / 2},5 ${element.width! - 5},${element.height! / 2} ${element.width! / 2},${element.height! - 5} 5,${element.height! / 2}`}
                  fill={element.color || '#ffffff'}
                  stroke="#000000"
                  strokeWidth="2"
                />
              )}
            </svg>
            {renderResizeHandle()}
            {selected && renderControlsMenu()}
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return renderElement();
};

export default CanvasElement;
