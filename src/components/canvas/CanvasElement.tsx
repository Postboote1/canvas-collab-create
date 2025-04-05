
import React, { useState } from 'react';
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
  
  const renderElement = () => {
    switch (element.type) {
      case 'card':
        return (
          <div
            className={`absolute card-canvas rounded-md p-3 ${selected ? 'ring-2 ring-canvas-blue' : ''}`}
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height,
              backgroundColor: element.color,
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
          </div>
        );
        
      case 'text':
        return (
          <div
            className={`absolute ${selected ? 'ring-2 ring-canvas-blue' : ''}`}
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
                  color: element.color,
                  fontSize: element.fontSize ? `${element.fontSize}px` : '16px'
                }}
              >
                {element.content}
              </div>
            )}
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
            className={`absolute ${selected ? 'ring-2 ring-canvas-blue' : ''}`}
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
          </div>
        );
        
      case 'arrow':
        if (!element.fromId || !element.toId) return null;
        
        const fromElement = allElements.find(el => el.id === element.fromId);
        const toElement = allElements.find(el => el.id === element.toId);
        
        if (!fromElement || !toElement) return null;
        
        const fromX = fromElement.x + (fromElement.width || 0) / 2;
        const fromY = fromElement.y + (fromElement.height || 0) / 2;
        const toX = toElement.x + (toElement.width || 0) / 2;
        const toY = toElement.y + (toElement.height || 0) / 2;
        
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
          </svg>
        );
        
      default:
        return null;
    }
  };
  
  return renderElement();
};

export default CanvasElement;
