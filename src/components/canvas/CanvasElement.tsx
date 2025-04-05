
import React, { useState, useRef } from 'react';
import { CanvasElement as ICanvasElement } from '@/contexts/CanvasContext';

interface CanvasElementProps {
  element: ICanvasElement;
  selected: boolean;
  onUpdateElement: (updates: Partial<ICanvasElement>) => void;
  readOnly: boolean;
  allElements: ICanvasElement[];
}

const CanvasElement: React.FC<CanvasElementProps> = ({
  element,
  selected,
  onUpdateElement,
  readOnly,
  allElements
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [originalDimensions, setOriginalDimensions] = useState({ width: 0, height: 0 });
  const elementRef = useRef<HTMLDivElement>(null);
  
  const handleDoubleClick = () => {
    if (!readOnly && (element.type === 'card' || element.type === 'text')) {
      setIsEditing(true);
    }
  };
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateElement({ content: e.target.value });
  };
  
  const handleBlur = () => {
    setIsEditing(false);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateElement({ color: e.target.value });
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
  
  const renderResizeHandle = () => {
    if (!selected || readOnly || element.type === 'text' || element.type === 'drawing' || element.type === 'arrow') {
      return null;
    }
    
    return (
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize z-10 rounded-bl"
        onMouseDown={handleResizeStart}
      />
    );
  };

  const renderColorPicker = () => {
    if (!selected || readOnly || element.type === 'drawing' || element.type === 'image') {
      return null;
    }
    
    return (
      <div className="absolute -top-8 left-0 bg-white border rounded p-1 shadow-md z-10">
        <input 
          type="color" 
          value={element.color || '#ffffff'} 
          onChange={handleColorChange}
          className="w-6 h-6 cursor-pointer"
        />
      </div>
    );
  };
  
  const getArrowCoordinates = () => {
    if (element.type !== 'arrow' || !element.fromId || !element.toId) return null;
    
    const fromElement = allElements.find(el => el.id === element.fromId);
    const toElement = allElements.find(el => el.id === element.toId);
    
    if (!fromElement || !toElement) return null;
    
    // Calculate center points
    const fromCenterX = fromElement.x + (fromElement.width || 0) / 2;
    const fromCenterY = fromElement.y + (fromElement.height || 0) / 2;
    const toCenterX = toElement.x + (toElement.width || 0) / 2;
    const toCenterY = toElement.y + (toElement.height || 0) / 2;
    
    // Calculate direction vector
    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len === 0) return null;
    
    const nx = dx / len;
    const ny = dy / len;
    
    // Find intersection points with element boundaries
    const fromWidth = fromElement.width || 0;
    const fromHeight = fromElement.height || 0;
    const toWidth = toElement.width || 0;
    const toHeight = toElement.height || 0;
    
    // Calculate intersection with from element
    let fromX, fromY;
    
    if (Math.abs(nx) * fromHeight > Math.abs(ny) * fromWidth) {
      // Intersect with left or right side
      const side = nx > 0 ? 1 : -1;
      fromX = fromCenterX + side * fromWidth / 2;
      fromY = fromCenterY + (ny / nx) * side * fromWidth / 2;
    } else {
      // Intersect with top or bottom side
      const side = ny > 0 ? 1 : -1;
      fromY = fromCenterY + side * fromHeight / 2;
      fromX = fromCenterX + (nx / ny) * side * fromHeight / 2;
    }
    
    // Calculate intersection with to element
    let toX, toY;
    
    if (Math.abs(nx) * toHeight > Math.abs(ny) * toWidth) {
      // Intersect with left or right side
      const side = nx > 0 ? -1 : 1;
      toX = toCenterX + side * toWidth / 2;
      toY = toCenterY + (ny / nx) * side * toWidth / 2;
    } else {
      // Intersect with top or bottom side
      const side = ny > 0 ? -1 : 1;
      toY = toCenterY + side * toHeight / 2;
      toX = toCenterX + (nx / ny) * side * toHeight / 2;
    }
    
    return { fromX, fromY, toX, toY };
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
              cursor: readOnly ? 'default' : 'move'
            }}
            onDoubleClick={handleDoubleClick}
          >
            {isEditing ? (
              <textarea
                className="w-full h-full border-none resize-none focus:outline-none bg-transparent"
                value={element.content}
                onChange={handleContentChange}
                onBlur={handleBlur}
                autoFocus
              />
            ) : (
              <div className="w-full h-full overflow-auto whitespace-pre-wrap break-words">
                {element.content}
              </div>
            )}
            {renderResizeHandle()}
            {selected && renderColorPicker()}
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
          >
            {isEditing ? (
              <textarea
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
            {selected && renderColorPicker()}
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
          >
            <img
              src={element.imageUrl}
              alt="Canvas element"
              className="w-full h-full object-contain"
            />
            {renderResizeHandle()}
          </div>
        );
        
      case 'arrow':
        const coords = getArrowCoordinates();
        
        if (!coords) return null;
        const { fromX, fromY, toX, toY } = coords;
        
        // Calculate arrow head coordinates
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const arrowHeadLength = 15;
        
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
              x2={toX}
              y2={toY}
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
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill={element.color || '#000000'}
                />
              </marker>
            </defs>
            {selected && (
              <foreignObject x={fromX} y={fromY} width="30" height="30" transform={`translate(-35, -15)`}>
                <div className="bg-white border rounded p-1 shadow-md">
                  <input 
                    type="color" 
                    value={element.color || '#000000'} 
                    onChange={handleColorChange}
                    className="w-6 h-6 cursor-pointer"
                  />
                </div>
              </foreignObject>
            )}
          </svg>
        );
        
      default:
        return null;
    }
  };
  
  return renderElement();
};

export default CanvasElement;
