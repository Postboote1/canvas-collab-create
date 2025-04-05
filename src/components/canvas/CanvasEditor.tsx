
import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCanvas, CanvasElement } from '@/contexts/CanvasContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import CanvasToolbar from './CanvasToolbar';
import CanvasElement from './CanvasElement';
import { toast } from 'sonner';

interface CanvasEditorProps {
  readOnly?: boolean;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({ readOnly = false }) => {
  const { user } = useAuth();
  const { currentCanvas, addElement, updateElement, saveCanvas } = useCanvas();
  const { isConnected, connect, disconnect, sendMessage } = useWebSocket();
  
  const [activeTool, setActiveTool] = useState<'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow'>('select');
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [arrowStart, setArrowStart] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewportPosition, setViewportPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Connect to WebSocket when canvas changes
  useEffect(() => {
    if (currentCanvas && user) {
      connect(currentCanvas.id, user.id);
      
      return () => {
        disconnect();
      };
    }
  }, [currentCanvas, user]);
  
  // Auto-save every 30 seconds
  useEffect(() => {
    if (!readOnly && currentCanvas) {
      const interval = setInterval(() => {
        saveCanvas();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [readOnly, currentCanvas, saveCanvas]);
  
  // Handle canvas mouse interactions
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || readOnly) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale + viewportPosition.x;
    const y = (e.clientY - rect.top) / scale + viewportPosition.y;
    
    if (activeTool === 'select') {
      // Check if we're clicking on an element
      const clickedElement = currentCanvas?.elements.find(element => {
        if (element.type === 'card' || element.type === 'text' || element.type === 'image') {
          return (
            x >= element.x &&
            x <= element.x + (element.width || 0) &&
            y >= element.y &&
            y <= element.y + (element.height || 0)
          );
        }
        return false;
      });
      
      if (clickedElement) {
        setSelectedElement(clickedElement.id);
        setIsDragging(true);
        setDragOffset({
          x: x - clickedElement.x,
          y: y - clickedElement.y
        });
      } else {
        setSelectedElement(null);
      }
    } else if (activeTool === 'card') {
      const newCard: Omit<CanvasElement, 'id'> = {
        type: 'card',
        content: 'New Card',
        x,
        y,
        width: 200,
        height: 150,
        color: '#ffffff'
      };
      
      addElement(newCard);
      
      if (isConnected) {
        sendMessage({
          type: 'addElement',
          payload: newCard,
          canvasId: currentCanvas!.id
        });
      }
    } else if (activeTool === 'text') {
      const newText: Omit<CanvasElement, 'id'> = {
        type: 'text',
        content: 'Double-click to edit',
        x,
        y,
        fontSize: 16,
        color: '#000000'
      };
      
      addElement(newText);
      
      if (isConnected) {
        sendMessage({
          type: 'addElement',
          payload: newText,
          canvasId: currentCanvas!.id
        });
      }
    } else if (activeTool === 'draw') {
      setIsDrawing(true);
      setDrawingPoints([{ x, y }]);
    } else if (activeTool === 'arrow') {
      if (arrowStart) {
        // If we already have a start point, create the arrow
        const startElement = currentCanvas?.elements.find(el => el.id === arrowStart);
        const endElement = currentCanvas?.elements.find(element => {
          if (element.type === 'card' || element.type === 'text' || element.type === 'image') {
            return (
              x >= element.x &&
              x <= element.x + (element.width || 0) &&
              y >= element.y &&
              y <= element.y + (element.height || 0)
            );
          }
          return false;
        });
        
        if (startElement && endElement && startElement.id !== endElement.id) {
          const newArrow: Omit<CanvasElement, 'id'> = {
            type: 'arrow',
            x: startElement.x + (startElement.width || 0) / 2,
            y: startElement.y + (startElement.height || 0) / 2,
            fromId: startElement.id,
            toId: endElement.id,
            color: '#000000'
          };
          
          addElement(newArrow);
          
          if (isConnected) {
            sendMessage({
              type: 'addElement',
              payload: newArrow,
              canvasId: currentCanvas!.id
            });
          }
        }
        
        setArrowStart(null);
      } else {
        // Get the element we're starting from
        const element = currentCanvas?.elements.find(element => {
          if (element.type === 'card' || element.type === 'text' || element.type === 'image') {
            return (
              x >= element.x &&
              x <= element.x + (element.width || 0) &&
              y >= element.y &&
              y <= element.y + (element.height || 0)
            );
          }
          return false;
        });
        
        if (element) {
          setArrowStart(element.id);
          toast.info('Now click on another element to create an arrow');
        }
      }
    }
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || readOnly) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale + viewportPosition.x;
    const y = (e.clientY - rect.top) / scale + viewportPosition.y;
    
    if (isDrawing && activeTool === 'draw') {
      setDrawingPoints([...drawingPoints, { x, y }]);
    } else if (isDragging && selectedElement) {
      const element = currentCanvas?.elements.find(el => el.id === selectedElement);
      
      if (element) {
        const newX = x - dragOffset.x;
        const newY = y - dragOffset.y;
        
        updateElement(selectedElement, { x: newX, y: newY });
        
        if (isConnected) {
          sendMessage({
            type: 'updateElement',
            payload: {
              id: selectedElement,
              updates: { x: newX, y: newY }
            },
            canvasId: currentCanvas!.id
          });
        }
      }
    }
  };
  
  const handleCanvasMouseUp = () => {
    if (readOnly) return;
    
    if (isDrawing && activeTool === 'draw' && drawingPoints.length > 1) {
      const newDrawing: Omit<CanvasElement, 'id'> = {
        type: 'drawing',
        points: drawingPoints,
        x: drawingPoints[0].x,
        y: drawingPoints[0].y,
        color: '#000000'
      };
      
      addElement(newDrawing);
      
      if (isConnected) {
        sendMessage({
          type: 'addElement',
          payload: newDrawing,
          canvasId: currentCanvas!.id
        });
      }
    }
    
    setIsDrawing(false);
    setDrawingPoints([]);
    setIsDragging(false);
  };
  
  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      // Zoom
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prevScale => Math.max(0.1, Math.min(prevScale * delta, 5)));
    } else {
      // Pan
      setViewportPosition(prev => ({
        x: prev.x + e.deltaX / scale,
        y: prev.y + e.deltaY / scale
      }));
    }
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !canvasRef.current || readOnly) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (!event.target?.result) return;
      
      const center = {
        x: (window.innerWidth / 2 - viewportPosition.x) / scale,
        y: (window.innerHeight / 2 - viewportPosition.y) / scale
      };
      
      const newImage: Omit<CanvasElement, 'id'> = {
        type: 'image',
        x: center.x - 100,
        y: center.y - 75,
        width: 200,
        height: 150,
        imageUrl: event.target.result as string
      };
      
      addElement(newImage);
      
      if (isConnected) {
        sendMessage({
          type: 'addElement',
          payload: newImage,
          canvasId: currentCanvas!.id
        });
      }
    };
    
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  
  return (
    <div className="flex flex-col h-full">
      <CanvasToolbar 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
        onSave={() => saveCanvas()}
        onImageUpload={handleImageUpload}
        readOnly={readOnly}
        scale={scale}
        setScale={setScale}
      />
      
      <div 
        className="relative flex-grow overflow-hidden"
        onWheel={handleCanvasWheel}
      >
        <div 
          ref={canvasRef}
          className={`absolute ${currentCanvas?.isInfinite ? 'infinite-canvas' : 'w-full h-full'} canvas-background`}
          style={{
            transform: `scale(${scale}) translate(${-viewportPosition.x}px, ${-viewportPosition.y}px)`,
            transformOrigin: '0 0'
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          {/* Draw current elements */}
          {currentCanvas?.elements.map(element => (
            <CanvasElement 
              key={element.id}
              element={element}
              selected={element.id === selectedElement}
              onUpdateElement={(updates) => {
                updateElement(element.id, updates);
                
                if (isConnected) {
                  sendMessage({
                    type: 'updateElement',
                    payload: {
                      id: element.id,
                      updates
                    },
                    canvasId: currentCanvas.id
                  });
                }
              }}
              readOnly={readOnly}
              allElements={currentCanvas.elements}
            />
          ))}
          
          {/* Draw current stroke */}
          {isDrawing && drawingPoints.length > 1 && (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <polyline
                points={drawingPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          
          {/* Draw connection indicator when creating an arrow */}
          {arrowStart && (
            <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none z-50">
              <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-md">
                Click on another element to create an arrow
              </div>
            </div>
          )}
        </div>
      </div>
      
      {isConnected && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm animate-pulse-light">
          Live: {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      )}
    </div>
  );
};

export default CanvasEditor;
