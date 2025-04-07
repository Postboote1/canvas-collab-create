// src/components/canvas/CanvasEditor.tsx
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
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]); // Removed pressure
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

    // Handle right-click for canvas panning
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      setPanStartPosition({ x: e.clientX, y: e.clientY });
      return;
    }

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
        // Add check for arrow type if needed for selection
        // if (element.type === 'arrow') { ... }
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
      setDrawingPoints([{ x, y }]); // Start drawing with the first point
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
              x: 0, // Position doesn't strictly matter for arrows
              y: 0,
              fromId: startElement.id,
              toId: element.id,
              color: '#000000' // Default arrow color
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
            toast.success('Arrow created', {
              position: 'bottom-center',
            });
            setActiveTool('select');
          } else {
            toast.error("Can't connect an element to itself", {
              position: 'bottom-center',
            });
            setArrowStart(null); // Reset if connection failed
          }
        } else {
          // Set the start element
          setArrowStart(element.id);
          toast.info('Now click on another element to create an arrow', {
            position: 'bottom-center',
          });
        }
      } else {
        // If clicking empty space while arrow tool is active, reset arrow start
        if (arrowStart) {
          setArrowStart(null);
          toast.info('Arrow creation cancelled', {
            position: 'bottom-center',
          });
        } else {
          toast.error('Please click on an element to start an arrow', {
            position: 'bottom-center',
          });
        }
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

      setActiveTool('select');
    } else if (activeTool === 'image' && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle touch start for mobile and stylus input
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!canvasRef.current || readOnly) return;

    const touch = e.touches[0];
    if (!touch) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / scale + viewportPosition.x;
    const y = (touch.clientY - rect.top) / scale + viewportPosition.y;

    if (activeTool === 'draw') {
      setIsDrawing(true);
      setDrawingPoints([{ x, y }]); // Start drawing
      e.preventDefault(); // Prevent scrolling while drawing
    }
    // Simulate mouse down for other tools or selection/dragging
    else if (activeTool === 'select' || activeTool === 'arrow') {
       const mouseEvent = new MouseEvent('mousedown', {
         clientX: touch.clientX,
         clientY: touch.clientY,
         button: 0 // Simulate left click
       });
       handleCanvasMouseDown(mouseEvent as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  // Handle mouse move on canvas with improved panning
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || readOnly) return;

    // Improved panning with right mouse button
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

      return; // Don't process other move events while panning
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale + viewportPosition.x;
    const y = (e.clientY - rect.top) / scale + viewportPosition.y;

    if (isDrawing && activeTool === 'draw') {
      setDrawingPoints([...drawingPoints, { x, y }]); // Add point to current drawing
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

  // Handle touch move for mobile and stylus input
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!canvasRef.current || readOnly || !isDrawing) return;

    const touch = e.touches[0];
    if (!touch) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / scale + viewportPosition.x;
    const y = (touch.clientY - rect.top) / scale + viewportPosition.y;

    if (activeTool === 'draw') {
      setDrawingPoints([...drawingPoints, { x, y }]); // Add point
      e.preventDefault(); // Prevent scrolling while drawing
    }
     // Simulate mouse move for dragging
    else if (isDragging && selectedElement) {
       const mouseEvent = new MouseEvent('mousemove', {
         clientX: touch.clientX,
         clientY: touch.clientY
       });
       handleCanvasMouseMove(mouseEvent as unknown as React.MouseEvent<HTMLDivElement>);
    }
  };

  // Handle mouse up on canvas
  const handleCanvasMouseUp = () => {
    if (readOnly) return;

    if (isPanning) {
      setIsPanning(false);
      return; // Don't process other mouse up events if panning just ended
    }

    if (isDrawing && activeTool === 'draw' && drawingPoints.length > 1) {
      const newDrawing: Omit<CanvasElementType, 'id'> = {
        type: 'drawing',
        points: drawingPoints,
        x: 0, // Or calculate bounding box if needed
        y: 0,
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

      // REMOVED: setActiveTool('select'); // Don't reset tool after drawing
    }

    setIsDrawing(false);
    setDrawingPoints([]);
    setIsDragging(false);
    // Don't reset arrowStart here, allow user to click another element
  };

  // Handle context menu (right-click)
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    e.preventDefault(); // Prevent default context menu
  };

  // Handle canvas wheel for zooming and panning
  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;

    e.preventDefault(); // Prevent page scroll

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate world coordinates before zoom/pan
    const worldXBefore = mouseX / scale + viewportPosition.x;
    const worldYBefore = mouseY / scale + viewportPosition.y;

    let newScale = scale;
    let newViewportX = viewportPosition.x;
    let newViewportY = viewportPosition.y;

    if (e.ctrlKey || e.metaKey) { // Zooming
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      newScale = Math.max(0.1, Math.min(scale * delta, 5));
    } else { // Panning
      newViewportX += e.deltaX / scale;
      newViewportY += e.deltaY / scale;
    }

    // Calculate world coordinates after zoom/pan
    const worldXAfter = mouseX / newScale + newViewportX;
    const worldYAfter = mouseY / newScale + newViewportY;

    // Adjust viewport position to keep mouse position stable during zoom
    if (e.ctrlKey || e.metaKey) {
        newViewportX += (worldXBefore - worldXAfter);
        newViewportY += (worldYBefore - worldYAfter);
    }

    setScale(newScale);
    setViewportPosition({ x: newViewportX, y: newViewportY });
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
        payload: { id }, // Send id in payload object
        canvasId: currentCanvas!.id
      });
    }

    setSelectedElement(null);
    if (arrowStart === id) {
      setArrowStart(null); // Cancel arrow creation if start element is deleted
    }
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !canvasRef.current || readOnly) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      if (!event.target?.result) return;

      const rect = canvasRef.current!.getBoundingClientRect();
      // Place image in the center of the current view
      const centerX = (rect.width / 2) / scale + viewportPosition.x;
      const centerY = (rect.height / 2) / scale + viewportPosition.y;

      const newImage: Omit<CanvasElementType, 'id'> = {
        type: 'image',
        x: centerX - 100, // Center based on default size
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

      setActiveTool('select');
    };

    reader.readAsDataURL(file);
    e.target.value = ''; // Clear input
  };

  // --- Export Functions ---
  const handleExportAsImage = () => {
    if (!contentRef.current) {
      toast.error('Canvas content not ready for export');
      return;
    }

    // Temporarily reset scale and position for accurate capture
    const originalScale = scale;
    const originalPosition = { ...viewportPosition };
    // TODO: Calculate actual bounds of content instead of resetting to 0,0
    // For now, reset to capture from top-left; might miss content
    setScale(1);
    setViewportPosition({ x: 0, y: 0 });

    setTimeout(() => {
      html2canvas(contentRef.current!, {
        backgroundColor: null, // Transparent background
        scale: window.devicePixelRatio,
        allowTaint: true,
        useCORS: true,
        // TODO: Set width/height/x/y based on calculated content bounds
      }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${currentCanvas?.name || 'canvas'}_export.png`;
        link.href = imgData;
        link.click();
        toast.success('Canvas exported as image');
      }).catch(err => {
        console.error('Image export failed:', err);
        toast.error('Failed to export canvas as image');
      }).finally(() => {
        // Restore original scale and position
        setScale(originalScale);
        setViewportPosition(originalPosition);
      });
    }, 100);
  };

  const handleExportAsPDF = () => {
    if (!contentRef.current) {
      toast.error('Canvas content not ready for export');
      return;
    }

    const originalScale = scale;
    const originalPosition = { ...viewportPosition };
    // TODO: Calculate actual bounds
    setScale(1);
    setViewportPosition({ x: 0, y: 0 });

    setTimeout(() => {
      html2canvas(contentRef.current!, {
        backgroundColor: '#ffffff', // White background for PDF
        scale: window.devicePixelRatio * 2, // Higher scale for PDF quality
        allowTaint: true,
        useCORS: true,
        // TODO: Set width/height/x/y based on calculated content bounds
      }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'l' : 'p',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${currentCanvas?.name || 'canvas'}_export.pdf`);
        toast.success('Canvas exported as PDF');
      }).catch(err => {
        console.error('PDF export failed:', err);
        toast.error('Failed to export canvas as PDF');
      }).finally(() => {
        setScale(originalScale);
        setViewportPosition(originalPosition);
      });
    }, 100);
  };

  // Expose export methods globally
  useEffect(() => {
    if (!currentCanvas) return;
    if (typeof window !== 'undefined') {
      (window as any).__canvasExportMethods = {
        exportAsImage: handleExportAsImage,
        exportAsPDF: handleExportAsPDF
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__canvasExportMethods;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCanvas, scale, viewportPosition]); // Re-bind if scale/position changes


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
        className="relative flex-grow overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleCanvasWheel}
        onMouseDown={(e) => { if (e.button === 2) handleCanvasMouseDown(e); }} // Pan start on right mouse down
        onMouseMove={handleCanvasMouseMove} // Handles both dragging and panning move
        onMouseUp={(e) => { if (e.button === 2) handleCanvasMouseUp(); }} // Pan end on right mouse up
        onContextMenu={handleContextMenu} // Prevent default menu
      >
        <div
          ref={canvasRef}
          className="absolute w-full h-full canvas-background dark:bg-zinc-900"
          style={{
            width: '100000px',
            height: '100000px',
            // Apply transform based on viewport position and scale
            transform: `translate(${-(viewportPosition.x * scale)}px, ${-(viewportPosition.y * scale)}px) scale(${scale})`,
            transformOrigin: '0 0',
            cursor: isPanning ? 'grabbing' : (activeTool === 'select' ? 'default' : 'crosshair'),
            // Center the large div initially (approximate)
            left: `calc(50% - 50000px * ${scale})`,
            top: `calc(50% - 50000px * ${scale})`,
            touchAction: 'none', // Prevent default touch actions like scroll/zoom
          }}
          onMouseDown={(e) => { if (e.button !== 2) handleCanvasMouseDown(e); }} // Handle non-panning mouse down
          onMouseUp={(e) => { if (e.button !== 2) handleCanvasMouseUp(); }} // Handle non-panning mouse up
          onMouseLeave={handleCanvasMouseUp} // End drawing/dragging if mouse leaves
          // Touch events
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              handleTouchStart(e); // Handle single touch start (drawing, selection)
            } else if (e.touches.length === 2) {
              // Handle two-finger pan/zoom start
              e.preventDefault();
              setIsPanning(true);
              const t1 = e.touches[0];
              const t2 = e.touches[1];
              setPanStartPosition({ x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 });
              // Could also store initial distance for pinch-zoom here
            }
          }}
          onTouchMove={(e) => {
             if (e.touches.length === 1 && !isPanning) {
               handleTouchMove(e); // Handle single touch move (drawing, dragging)
             } else if (e.touches.length === 2 && isPanning) {
               // Handle two-finger pan/zoom move
               e.preventDefault();
               const t1 = e.touches[0];
               const t2 = e.touches[1];
               const currentMidX = (t1.clientX + t2.clientX) / 2;
               const currentMidY = (t1.clientY + t2.clientY) / 2;
               const deltaX = currentMidX - panStartPosition.x;
               const deltaY = currentMidY - panStartPosition.y;
               setViewportPosition(prev => ({ x: prev.x - deltaX / scale, y: prev.y - deltaY / scale }));
               setPanStartPosition({ x: currentMidX, y: currentMidY });
               // Could calculate distance change for pinch-zoom here
            }
          }}
          onTouchEnd={(e) => {
            if (isPanning) setIsPanning(false); // End panning state
            if (e.touches.length < 2) handleCanvasMouseUp(); // Handle end of single touch (drawing, dragging)
          }}
        >
          {/* Content container for elements and temporary drawing */}
          <div ref={contentRef} className="absolute top-0 left-0" style={{ width: '100%', height: '100%' }}>
            {/* Render canvas elements */}
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
                      payload: { id: element.id, updates },
                      canvasId: currentCanvas.id
                    });
                  }
                }}
                onDeleteElement={handleDeleteElement}
                readOnly={readOnly}
                allElements={currentCanvas.elements}
                onSelectElement={setSelectedElement} // Pass selection handler
              />
            ))}

            {/* Draw current stroke */}
            {isDrawing && drawingPoints.length > 1 && (
              <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <path
                  d={drawingPoints.reduce((path, point, i) => {
                    if (i === 0) return `M ${point.x} ${point.y}`;
                    return `${path} L ${point.x} ${point.y}`;
                  }, '')}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth={2 / scale} // Adjust stroke width based on scale
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke" // Keep stroke visually consistent
                />
              </svg>
            )}
          </div>

          {/* Arrow connection indicator */}
          {arrowStart && (
            <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none z-50">
              <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-md">
                Click on another element to create an arrow
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Connection status */}
      {isConnected && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm animate-pulse-light z-50">
          Live: Connected
        </div>
      )}
    </div>
  );
};

export default CanvasEditor;
