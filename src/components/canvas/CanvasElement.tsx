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
import { Palette, Maximize, Trash, Pencil } from 'lucide-react';

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

  // Add state and refs for touch-and-hold behavior
  const [touchHoldTimer, setTouchHoldTimer] = useState<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const isTouchMoving = useRef(false);
  const touchMoveCount = useRef(0);

  // Add a variable for activeColor to track selected color in the picker
  const [activeColor, setActiveColor] = useState(element.color || '#FFFFFF');

  // Add a state variable to track which picker is being shown
  const [pickerSource, setPickerSource] = useState<'toolbar' | 'contextmenu' | null>(null);

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

  // Add a listener for the edit event we'll dispatch
  useEffect(() => {
    const handleEditEvent = (e: CustomEvent) => {
      if (e.detail.elementId === element.id && (element.type === 'text' || element.type === 'card')) {
        setIsEditing(true);
        // Focus the textarea after a short delay to ensure it's rendered
        setTimeout(() => {
          if (textAreaRef.current) {
            textAreaRef.current.focus();
          }
        }, 50);
      }
    };

    window.addEventListener('canvas-element-edit', handleEditEvent as EventListener);
    
    return () => {
      window.removeEventListener('canvas-element-edit', handleEditEvent as EventListener);
    };
  }, [element.id, element.type]);

  const handleDoubleClick = () => {
    if (!readOnly && (element.type === 'card' || element.type === 'text')) {
      setIsEditing(true);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateElement({ 
      content: e.target.value,
      x: element.x,    // Preserve position
      y: element.y,    // Preserve position
      width: element.width,  // Preserve width
      height: element.height // Preserve height
    });
  
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
    setActiveColor(color); // Update the active color in state
    onUpdateElement({ 
      color: color,
      x: element.x,    // Preserve position
      y: element.y,    // Preserve position
      width: element.width,  // Preserve width
      height: element.height // Preserve height
    });
    setShowColorPicker(false);
    setPickerSource(null);
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

  // Improve touch handling for elements
  const handleTouchStart = (e: React.TouchEvent) => {
    if (readOnly) return;
    
    // Prevent default to avoid unwanted scrolling or zooming
    e.stopPropagation();
    
    // Set this element as selected when touched
    onSelectElement(element.id);
    
    // Store touch position for later use
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    touchMoveCount.current = 0;
    isTouchMoving.current = false;
    
    // Set up touch hold timer for move gesture (500ms)
    if (touchHoldTimer) clearTimeout(touchHoldTimer);
    
    const timer = setTimeout(() => {
      // If user hasn't moved much during the hold time, enter drag mode
      if (!isTouchMoving.current && touchMoveCount.current < 5) {
        // Dispatch custom event to enter drag mode
        window.dispatchEvent(new CustomEvent('element-touch-hold', {
          detail: { 
            elementId: element.id,
            x: touch.clientX,
            y: touch.clientY
          }
        }));
        
        // Visual feedback that element is movable
        if (elementRef.current) {
          elementRef.current.style.transition = 'transform 0.2s ease';
          elementRef.current.style.transform = 'scale(1.05)';
          
          // Reset after animation
          setTimeout(() => {
            if (elementRef.current) {
              elementRef.current.style.transition = '';
              elementRef.current.style.transform = '';
            }
          }, 300);
        }
      }
    }, 500); // 500ms hold time
    
    setTouchHoldTimer(timer);
  };

  // Track touch movement to detect if user is scrolling vs holding
  const handleTouchMove = (e: React.TouchEvent) => {
    if (readOnly || !touchStartPos.current) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    
    // If moved more than 10px in any direction, consider it a move rather than a hold
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      isTouchMoving.current = true;
    }
    
    touchMoveCount.current++;
  };

  // Clean up touch handling
  const handleTouchEnd = () => {
    if (touchHoldTimer) {
      clearTimeout(touchHoldTimer);
      setTouchHoldTimer(null);
    }
    
    touchStartPos.current = null;
    isTouchMoving.current = false;
    touchMoveCount.current = 0;
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

  // Fix toolbar positioning to prevent it from being cut off
  const renderControlsMenu = () => {
    if (!selected || readOnly) {
      return null;
    }

    // Determine if we should position the toolbar above or below based on element position
    const isMobile = window.innerWidth <= 768;
    const isNearTop = element.y < 100; // Check if element is near the top of the viewport
    
    return (
      <div 
        className={`absolute ${isNearTop ? 'top-full mt-2' : '-top-12'} right-0 flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded p-1 shadow-md z-20`}
        style={{
          maxWidth: isMobile ? '100%' : 'auto',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
        }}
      >
        {/* Fix color picker to ensure it renders properly */}
        {element.type !== 'drawing' && (
          <Popover 
            open={showColorPicker && pickerSource === 'toolbar'} 
            onOpenChange={(open) => {
              if (open) {
                setShowColorPicker(true);
                setPickerSource('toolbar');
              } else if (pickerSource === 'toolbar') {
                setShowColorPicker(false);
                setPickerSource(null);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 rounded-full p-0"
                onClick={() => {
                  setShowColorPicker(!showColorPicker || pickerSource !== 'toolbar');
                  setPickerSource(showColorPicker && pickerSource === 'toolbar' ? null : 'toolbar');
                }}
              >
                <Palette size={16} />
                <span className="sr-only">Change color</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-auto p-0" 
              onInteractOutside={(e) => e.preventDefault()} // Prevent outside clicks from closing
              onEscapeKeyDown={(e) => e.preventDefault()} // Prevent ESC from closing
            >
              {renderColorPicker('toolbar')}
            </PopoverContent>
          </Popover>
        )}

        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full p-0 text-destructive" onClick={handleDelete}>
          <Trash size={16} />
          <span className="sr-only">Delete</span>
        </Button>
        
        {/* Add edit button for text and card elements */}
        {(element.type === 'text' || element.type === 'card') && (
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full p-0" onClick={() => setIsEditing(true)}>
            <Pencil size={16} />
            <span className="sr-only">Edit</span>
          </Button>
        )}
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
      const distance = Math.hypot(possiblePaths[i].to.x - possiblePaths[i].from.x, possiblePaths[i].from.y - possiblePaths[i].to.y);
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
        <ContextMenuContent className="w-auto">
          {(element.type === 'card' || element.type === 'text' || element.type === 'image' || element.type === 'shape') && (
            <>
              <Popover 
                open={showColorPicker && pickerSource === 'contextmenu'} 
                onOpenChange={(open) => {
                  if (open) {
                    setShowColorPicker(true);
                    setPickerSource('contextmenu');
                  } else if (pickerSource === 'contextmenu') {
                    // Only close if we're the active picker
                    setShowColorPicker(false);
                    setPickerSource(null);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <ContextMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      setShowColorPicker(true);
                      setPickerSource('contextmenu');
                    }}
                  >
                    Change Color
                  </ContextMenuItem>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 mt-1" onInteractOutside={(e) => {
                  // Prevent outside clicks from closing the popover
                  e.preventDefault();
                }}>
                  {renderColorPicker('contextmenu')}
                </PopoverContent>
              </Popover>
              
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

  const renderColorPicker = (source: 'toolbar' | 'contextmenu') => {
    return (
      <div 
        className="p-3 bg-background border rounded shadow-md w-48"
        onClick={(e) => e.stopPropagation()} // Stop click from closing the popover
        onMouseMove={(e) => e.stopPropagation()} // Prevent mouse move from closing popover
      >
        <p className="text-sm font-medium mb-2">Choose Color</p>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {['#FFFFFF', '#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#000000'].map(color => (
            <div
              key={color}
              className={`w-8 h-8 rounded cursor-pointer ${color === activeColor ? 'ring-2 ring-blue-500' : 'border border-gray-300'}`}
              style={{ backgroundColor: color }}
              onClick={() => {
                handleColorChange(color);
                // Don't close the popover automatically - let user explicitly close it
              }}
            />
          ))}
        </div>
        <div>
          <input 
            type="color" 
            value={activeColor} 
            onChange={(e) => {
              handleColorChange(e.target.value);
              // Don't close the popover automatically
            }} 
            className="w-full" 
          />
        </div>
        <Button 
          className="w-full mt-2" 
          size="sm" 
          onClick={() => {
            setShowColorPicker(false);
            setPickerSource(null);
          }}
        >
          Close
        </Button>
      </div>
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
            onMouseDown={(e) => { if (!readOnly) onSelectElement(element.id); }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
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
