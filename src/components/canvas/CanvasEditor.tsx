
import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCanvas, CanvasElement as CanvasElementType } from '@/contexts/CanvasContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import CanvasToolbar from './CanvasToolbar';
import CanvasElement from './CanvasElement';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface CanvasEditorProps {
  readOnly?: boolean;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({ readOnly = false }) => {
  const { user } = useAuth();
  const { currentCanvas, addElement, updateElement, deleteElement, saveCanvas } = useCanvas();
  const { isConnected, connect, disconnect, sendMessage } = useWebSocket();
  
  const [activeTool, setActiveTool] = useState<'select' | 'card' | 'text' | 'draw' | 'image' | 'arrow' | 'circle' | 'triangle' | 'diamond'>('select');
  const [activeColor, setActiveColor] = useState('#000000');
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [arrowStart, setArrowStart] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewportPosition, setViewportPosition] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartPosition, setPanStartPosition] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Connect to WebSocket when canvas changes
  useEffect(() => {
    if (currentCanvas && user) {
      connect(currentCanvas.id, user.id);
      
      return () => {
        disconnect();
      };
    }
  }, [currentCanvas, user, connect, disconnect]);
  
  // Auto-save every 30 seconds
  useEffect(() => {
    if (!readOnly && currentCanvas) {
      const interval = setInterval(() => {
        saveCanvas();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [readOnly, currentCanvas, saveCanvas]);
  
  // Handle mouse down on canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || readOnly) return;
    
    // Handle right-click (contextmenu is handled separately)
    if (e.button === 2) {
      // Right mouse button for panning the canvas
      e.preventDefault();
      setIsPanning(true);
      setPanStartPosition({ x: e.clientX, y: e.clientY });
      return;
    }
    
    // Handle left-click
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale + viewportPosition.x;
    const y = (e.clientY - rect.top) / scale + viewportPosition.y;
    
    if (activeTool === 'select') {
      // Check if we're clicking on an element
      const clickedElement = currentCanvas?.elements.find(element => {
        if (element.type === 'card' || element.type === 'text' || element.type === 'image' || element.type === 'shape') {
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
      const newCard: Omit<CanvasElementType, 'id'> = {
        type: 'card',
        content: 'New Card',
        x,
        y,
        width: 200,
        height: 150,
        color: activeColor
      };
      
      addElement(newCard);
      toast.success('Card added', {
        position: 'bottom-center',
      });
      
      if (isConnected) {
        sendMessage({
          type: 'addElement',
          payload: newCard,
          canvasId: currentCanvas!.id
        });
      }
      
      // Reset to select tool after adding a card
      setActiveTool('select');
    } else if (activeTool === 'text') {
      const newText: Omit<CanvasElementType, 'id'> = {
        type: 'text',
        content: 'Double-click to edit',
        x,
        y,
        fontSize: 16,
        color: activeColor
      };
      
      addElement(newText);
      toast.success('Text added', {
        position: 'bottom-center',
      });
      
      if (isConnected) {
        sendMessage({
          type: 'addElement',
          payload: newText,
          canvasId: currentCanvas!.id
        });
      }
      
      // Reset to select tool after adding text
      setActiveTool('select');
    } else if (activeTool === 'draw') {
      setIsDrawing(true);
      setDrawingPoints([{ x, y }]);
    } else if (activeTool === 'arrow') {
      // Find element under the cursor
      const element = currentCanvas?.elements.find(el => {
        if (el.type === 'card' || el.type === 'text' || el.type === 'image' || el.type === 'shape') {
          return (
            x >= el.x &&
            x <= el.x + (el.width || 0) &&
            y >= el.y &&
            y <= el.y + (el.height || 0)
          );
        }
        return false;
      });
      
      if (element) {
        if (arrowStart) {
          // If we already have a start point, create the arrow
          const startElement = currentCanvas?.elements.find(el => el.id === arrowStart);
          
          if (startElement && startElement.id !== element.id) {
            const newArrow: Omit<CanvasElementType, 'id'> = {
              type: 'arrow',
              x: startElement.x + (startElement.width || 0) / 2,
              y: startElement.y + (startElement.height || 0) / 2,
              fromId: startElement.id,
              toId: element.id,
              color: activeColor
            };
            
            addElement(newArrow);
            
            if (isConnected) {
              sendMessage({
                type: 'addElement',
                payload: newArrow,
                canvasId: currentCanvas!.id
              });
            }
            
            setArrowStart(null);
            // Toast to indicate arrow was created
            toast.success('Arrow created', {
              position: 'bottom-center',
            });
            // Reset to select tool after adding an arrow
            setActiveTool('select');
          } else {
            toast.error("Can't connect an element to itself", {
              position: 'bottom-center',
            });
          }
        } else {
          // Set the start element
          setArrowStart(element.id);
          toast.info('Now click on another element to create an arrow', {
            position: 'bottom-center',
          });
        }
      } else {
        toast.error('Please click on an element to create an arrow', {
          position: 'bottom-center',
        });
      }
    } else if (activeTool === 'circle' || activeTool === 'triangle' || activeTool === 'diamond') {
      const newShape: Omit<CanvasElementType, 'id'> = {
        type: 'shape',
        shapeType: activeTool,
        x,
        y,
        width: 100,
        height: 100,
        color: activeColor
      };
      
      addElement(newShape);
      toast.success(`${activeTool} shape added`, {
        position: 'bottom-center',
      });
      
      if (isConnected) {
        sendMessage({
          type: 'addElement',
          payload: newShape,
          canvasId: currentCanvas!.id
        });
      }
      
      // Reset to select tool after adding a shape
      setActiveTool('select');
    } else if (activeTool === 'image' && fileInputRef.current) {
      // Trigger file input click when image tool is active
      fileInputRef.current.click();
    }
  };
  
  // Handle mouse move on canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || readOnly) return;
    
    // Handle panning with right mouse button
    if (isPanning) {
      const deltaX = e.clientX - panStartPosition.x;
      const deltaY = e.clientY - panStartPosition.y;
      
      setViewportPosition(prev => ({
        x: prev.x - deltaX / scale,
        y: prev.y - deltaY / scale
      }));
      
      setPanStartPosition({
        x: e.clientX,
        y: e.clientY
      });
      
      return;
    }
    
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
  
  // Handle mouse up on canvas
  const handleCanvasMouseUp = () => {
    if (readOnly) return;
    
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    if (isDrawing && activeTool === 'draw' && drawingPoints.length > 1) {
      const newDrawing: Omit<CanvasElementType, 'id'> = {
        type: 'drawing',
        points: drawingPoints,
        x: drawingPoints[0].x,
        y: drawingPoints[0].y,
        color: activeColor
      };
      
      addElement(newDrawing);
      toast.success('Drawing added', {
        position: 'bottom-center',
      });
      
      if (isConnected) {
        sendMessage({
          type: 'addElement',
          payload: newDrawing,
          canvasId: currentCanvas!.id
        });
      }
      
      // Reset to select tool after drawing
      setActiveTool('select');
    }
    
    setIsDrawing(false);
    setDrawingPoints([]);
    setIsDragging(false);
  };
  
  // Handle context menu (right-click)
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    
    // Prevent the default context menu
    e.preventDefault();
  };
  
  // Handle canvas wheel for both zooming and scrolling
  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prevScale => Math.max(0.1, Math.min(prevScale * delta, 5)));
    } else {
      // Pan
      e.preventDefault();
      setViewportPosition(prev => ({
        x: prev.x + e.deltaX / scale,
        y: prev.y + e.deltaY / scale
      }));
    }
  };
  
  // Handle element deletion
  const handleDeleteElement = (id: string) => {
    deleteElement(id);
    toast.success('Element deleted', {
      position: 'bottom-center',
    });
    
    if (isConnected) {
      sendMessage({
        type: 'deleteElement',
        payload: id,
        canvasId: currentCanvas!.id
      });
    }
    
    setSelectedElement(null);
  };
  
  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !canvasRef.current || readOnly) return;
    
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (!event.target?.result) return;
      
      const rect = canvasRef.current!.getBoundingClientRect();
      const centerX = ((window.innerWidth / 2) - rect.left) / scale + viewportPosition.x;
      const centerY = ((window.innerHeight / 2) - rect.top) / scale + viewportPosition.y;
      
      const newImage: Omit<CanvasElementType, 'id'> = {
        type: 'image',
        x: centerX - 100,
        y: centerY - 75,
        width: 200,
        height: 150,
        imageUrl: event.target.result as string
      };
      
      addElement(newImage);
      toast.success('Image added', {
        position: 'bottom-center',
      });
      
      if (isConnected) {
        sendMessage({
          type: 'addElement',
          payload: newImage,
          canvasId: currentCanvas!.id
        });
      }
      
      // Reset to select tool after adding an image
      setActiveTool('select');
    };
    
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleExportAsImage = () => {
    if (!contentRef.current) {
      toast.error('Canvas not ready');
      return;
    }

    const tempScale = scale;
    setScale(1);
    
    // Wait for the next render with correct scale before capturing
    setTimeout(() => {
      html2canvas(contentRef.current!, {
        backgroundColor: 'white',
        scale: window.devicePixelRatio,
        allowTaint: true,
        useCORS: true,
      }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${currentCanvas?.name || 'canvas'}_export.png`;
        link.href = imgData;
        link.click();
        
        // Restore scale
        setScale(tempScale);
        toast.success('Canvas exported as image');
      }).catch(err => {
        console.error('Export failed:', err);
        toast.error('Failed to export canvas');
        setScale(tempScale);
      });
    }, 100);
  };

  const handleExportAsPDF = () => {
    if (!contentRef.current) {
      toast.error('Canvas not ready');
      return;
    }

    const tempScale = scale;
    setScale(1);
    
    // Wait for the next render with correct scale before capturing
    setTimeout(() => {
      html2canvas(contentRef.current!, {
        backgroundColor: 'white',
        scale: window.devicePixelRatio,
        allowTaint: true,
        useCORS: true,
      }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${currentCanvas?.name || 'canvas'}_export.pdf`);
        
        // Restore scale
        setScale(tempScale);
        toast.success('Canvas exported as PDF');
      }).catch(err => {
        console.error('Export failed:', err);
        toast.error('Failed to export canvas');
        setScale(tempScale);
      });
    }, 100);
  };

  useEffect(() => {
    if (!currentCanvas) return;
    
    // Pass these methods to window object for external access
    if (typeof window !== 'undefined') {
      window.__canvasExportMethods = {
        exportAsImage: handleExportAsImage,
        exportAsPDF: handleExportAsPDF
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__canvasExportMethods;
      }
    };
  }, [currentCanvas, handleExportAsImage, handleExportAsPDF]);
  
  return (
    <div className="flex flex-col h-full dark:bg-zinc-800">
      <CanvasToolbar 
        activeTool={activeTool} 
        setActiveTool={setActiveTool} 
        onSave={() => saveCanvas()}
        onImageUpload={handleImageUpload}
        readOnly={readOnly}
        scale={scale}
        setScale={setScale}
        activeColor={activeColor}
        setActiveColor={setActiveColor}
      />
      
      <div 
        className="relative flex-grow overflow-hidden"
        onWheel={handleCanvasWheel}
      >
        <div 
          ref={canvasRef}
          className="absolute w-full h-full canvas-background dark:bg-zinc-900"
          style={{
            width: currentCanvas?.isInfinite ? '100000px' : '100%',
            height: currentCanvas?.isInfinite ? '100000px' : '100%',
            transform: `scale(${scale}) translate(${-viewportPosition.x}px, ${-viewportPosition.y}px)`,
            transformOrigin: '0 0'
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onContextMenu={handleContextMenu}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            if (touch) {
              const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
              });
              handleCanvasMouseDown(mouseEvent as unknown as React.MouseEvent<HTMLDivElement>);
            }
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            if (touch) {
              const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
              });
              handleCanvasMouseMove(mouseEvent as unknown as React.MouseEvent<HTMLDivElement>);
            }
          }}
          onTouchEnd={() => {
            handleCanvasMouseUp();
          }}
        >
          <div ref={contentRef} className="absolute top-0 left-0 w-full h-full">
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
                onDeleteElement={handleDeleteElement}
                readOnly={readOnly}
                allElements={currentCanvas.elements}
              />
            ))}
          </div>
          
          {/* Draw current stroke */}
          {isDrawing && drawingPoints.length > 1 && (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
              <polyline
                points={drawingPoints.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={activeColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          
          {/* Draw arrow connection indicator */}
          {arrowStart && (
            <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none z-50">
              <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-md">
                Click on another element to create an arrow
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Hidden file input for image uploads */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />
      
      {isConnected && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm animate-pulse-light z-50">
          Live: Connected
        </div>
      )}
    </div>
  );
};

export default CanvasEditor;
