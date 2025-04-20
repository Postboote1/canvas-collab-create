import React, { useState, useRef, useEffect } from 'react';
import { CanvasElement as ICanvasElement } from '@/contexts/CanvasContext';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '@/components/ui/context-menu';
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
  onSelectElement: (id: string | null) => void;
}

const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  selected,
  onUpdateElement,
  onDeleteElement,
  readOnly,
  allElements,
  onSelectElement
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
  }, [element.content, element.type, isEditing, isResizing, onUpdateElement, element.height]);

  // Auto-resize textarea when editing
  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [isEditing, element.content]);

  // Cleanup event listeners when component unmounts or when resizing stops
  useEffect(() => {
    const handleResizeMoveGlobal = (e: MouseEvent) => {
      if (isResizing) {
        handleResizeMove(e);
      }
    };
    const handleResizeEndGlobal = () => {
      if (isResizing) {
        handleResizeEnd();
      }
    };

    // Only add the event listeners if we're currently resizing
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMoveGlobal);
      window.addEventListener('mouseup', handleResizeEndGlobal);

      // Cleanup
      return () => {
        window.removeEventListener('mousemove', handleResizeMoveGlobal);
        window.removeEventListener('mouseup', handleResizeEndGlobal);
      };
    }
  }, [isResizing]);

  // MOVED TO TOP LEVEL: Separate effect for image cleanup
  useEffect(() => {
    // Cleanup effect for component unmount or element change
    return () => {
      // If this is an image element that's being removed, help trigger cleanup
      if (element.type === 'image' && element.imageUrl) {
        // Signal that this image can be cleaned up on next cycle
        window.dispatchEvent(new CustomEvent('image-element-removed', { 
          detail: { elementId: element.id }
        }));
      }
    };
  }, [element.id, element.type, element.imageUrl]);

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
    // Context menu is handled by the ContextMenu component trigger
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (readOnly) return;

    e.stopPropagation(); // Stop propagation for resize handle specifically
    e.preventDefault();
    setIsResizing(true);
    setResizeStartPos({ x: e.clientX, y: e.clientY });
    setOriginalDimensions({
      width: element.width || 200,
      height: element.height || 150
    });
  };

  const handleResizeMove = (e: MouseEvent) => {
    const deltaX = e.clientX - resizeStartPos.x;
    const deltaY = e.clientY - resizeStartPos.y;
  
    const newWidth = Math.max(100, originalDimensions.width + deltaX);
    const newHeight = Math.max(75, originalDimensions.height + deltaY);
  
    // CRITICAL FIX: Always include x/y coordinates with resize updates
    // This prevents element from disappearing during resize operations
    onUpdateElement({
      width: newWidth,
      height: newHeight,
      x: element.x,    // Include current position
      y: element.y     // Include current position
    });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
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
        className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 cursor-se-resize z-10 rounded-bl flex items-center justify-center"
        onMouseDown={handleResizeStart} // Keep stopPropagation here
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (touch) {
            const mouseEvent = new MouseEvent('mousedown', {
              clientX: touch.clientX,
              clientY: touch.clientY
            });
            handleResizeStart(mouseEvent as unknown as React.MouseEvent<HTMLDivElement>);
          }
          e.stopPropagation(); // Keep stopPropagation here
        }}
      >
        <Maximize size={14} className="text-white" />
      </div>
    );
  };

  const renderControlsMenu = () => {
    if (!selected || readOnly) {
      return null;
    }

    return (
      <div className="absolute -top-8 right-0 flex items-center gap-1 bg-background/80 backdrop-blur-sm border rounded p-1 shadow-md z-20">
        {element.type !== 'drawing' && (
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
        )}

        {(element.type === 'card' || element.type === 'image' || element.type === 'shape') && (
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
      { from: { x: fromRect.right, y: fromRect.centerY }, to: { x: toRect.left, y: toRect.centerY } },
      { from: { x: fromRect.left, y: fromRect.centerY }, to: { x: toRect.right, y: toRect.centerY } },
      { from: { x: fromRect.centerX, y: fromRect.bottom }, to: { x: toRect.centerX, y: toRect.top } },
      { from: { x: fromRect.centerX, y: fromRect.top }, to: { x: toRect.centerX, y: toRect.bottom } }
    ];

    let shortestPath = possiblePaths[0];
    let shortestDistance = Math.hypot(shortestPath.to.x - shortestPath.from.x, shortestPath.to.y - shortestPath.from.y);

    for (let i = 1; i < possiblePaths.length; i++) {
      const distance = Math.hypot(possiblePaths[i].to.x - possiblePaths[i].from.x, possiblePaths[i].to.y - possiblePaths[i].from.y);
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

  const renderContextMenu = (children: React.ReactNode) => {
    if (readOnly) {
      return children;
    }

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {(element.type === 'card' || element.type === 'text' || element.type === 'image' || element.type === 'shape') && (
            <>
              <ContextMenuItem onClick={() => setShowColorPicker(true)}>
                Change Color
              </ContextMenuItem>
              {(element.type === 'card' || element.type === 'image' || element.type === 'shape') && (
                <ContextMenuItem onClick={handleResizeStart}>
                  Resize
                </ContextMenuItem>
              )}
            </>
          )}
          <ContextMenuItem onClick={handleDelete} className="text-destructive">
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  const renderElement = () => {
    switch (element.type) {
      case 'card':
        return renderContextMenu(
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
              overflowY: 'auto',
              position: 'absolute'
            }}
            onDoubleClick={handleDoubleClick}
            onMouseDown={(e) => { /* Removed stopPropagation */ if (!readOnly) onSelectElement(element.id); }}
            onTouchStart={(e) => { /* Removed stopPropagation */ if (!readOnly) onSelectElement(element.id); }}
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
        return renderContextMenu(
          <div
            className={`absolute ${selected ? 'ring-2 ring-blue-500' : ''}`}
            style={{
              left: element.x,
              top: element.y,
              cursor: readOnly ? 'default' : 'move',
              position: 'absolute'
            }}
            onDoubleClick={handleDoubleClick}
            onMouseDown={(e) => { /* Removed stopPropagation */ if (!readOnly) onSelectElement(element.id); }}
            onTouchStart={(e) => { /* Removed stopPropagation */ if (!readOnly) onSelectElement(element.id); }}
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
            style={{ left: 0, top: 0 }}
          >
            <polyline
              points={element.points.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={element.color || '#000000'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        );

      case 'image':
        return renderContextMenu(
          <div
            ref={elementRef}
            className={`absolute ${selected ? 'ring-2 ring-blue-500' : ''}`}
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              cursor: readOnly ? 'default' : 'move',
              position: 'absolute'
            }}
            onMouseDown={(e) => { 
              e.preventDefault(); // Prevent browser drag operation
              if (!readOnly) onSelectElement(element.id); 
            }}
            onTouchStart={(e) => { 
              e.preventDefault(); // Prevent browser drag operation
              if (!readOnly) onSelectElement(element.id); 
            }}
          >
            <img
              src={element.imageUrl}
              alt="Canvas element"
              className="w-full h-full object-contain"
              draggable="false" // Prevent default browser dragging
              onDragStart={(e) => e.preventDefault()} // Additional protection
            />
            {renderResizeHandle()}
            {selected && renderControlsMenu()}
          </div>
        );

      case 'arrow':
        const coords = getArrowCoordinates();
        if (!coords) return null;
        const { fromX, fromY, toX, toY } = coords;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const angle = Math.atan2(dy, dx);
        const markerOffset = 8;
        const endX = toX - markerOffset * Math.cos(angle);
        const endY = toY - markerOffset * Math.sin(angle);

        return renderContextMenu(
          <svg
            className={`absolute top-0 left-0 w-full h-full pointer-events-none ${selected ? 'cursor-pointer' : ''}`}
            style={{ left: 0, top: 0 }}
          >
            <line
              x1={fromX}
              y1={fromY}
              x2={endX}
              y2={endY}
              stroke={element.color || '#000000'}
              strokeWidth={selected ? "4" : "2"}
              markerEnd="url(#arrowhead)"
              pointerEvents="stroke"
              onMouseDown={(e) => { e.stopPropagation(); if (!readOnly) onSelectElement(element.id); }} // Keep stopPropagation for line selection
              onTouchStart={(e) => { e.stopPropagation(); if (!readOnly) onSelectElement(element.id); }} // Keep stopPropagation for line selection
              style={{ cursor: readOnly ? 'default' : 'pointer' }}
            />
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={element.color || '#000000'} />
              </marker>
            </defs>
            {selected && renderControlsMenu()}
          </svg>
        );

      case 'shape':
        return renderContextMenu(
          <div
            ref={elementRef}
            className={`absolute ${selected ? 'ring-2 ring-blue-500' : ''}`}
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              cursor: readOnly ? 'default' : 'move',
              position: 'absolute'
            }}
            onMouseDown={(e) => { /* Removed stopPropagation */ if (!readOnly) onSelectElement(element.id); }}
            onTouchStart={(e) => { /* Removed stopPropagation */ if (!readOnly) onSelectElement(element.id); }}
          >
            <svg width="100%" height="100%" viewBox={`0 0 ${element.width || 100} ${element.height || 100}`}>
              {element.shapeType === 'circle' && (
                <circle cx={(element.width || 100) / 2} cy={(element.height || 100) / 2} r={Math.min(element.width || 100, element.height || 100) / 2 - 2} fill={element.color || '#ffffff'} stroke="#000000" strokeWidth="2" />
              )}
              {element.shapeType === 'triangle' && (
                <polygon points={`${(element.width || 100) / 2},5 5,${(element.height || 100) - 5} ${(element.width || 100) - 5},${(element.height || 100) - 5}`} fill={element.color || '#ffffff'} stroke="#000000" strokeWidth="2" />
              )}
              {element.shapeType === 'diamond' && (
                <polygon points={`${(element.width || 100) / 2},5 ${(element.width || 100) - 5},${(element.height || 100) / 2} ${(element.width || 100) / 2},${(element.height || 100) - 5} 5,${(element.height || 100) / 2}`} fill={element.color || '#ffffff'} stroke="#000000" strokeWidth="2" />
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
