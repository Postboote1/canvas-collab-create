// src/components/canvas/CanvasEditor.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCanvas, CanvasElement as CanvasElementType } from '@/contexts/CanvasContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import CanvasToolbar from './CanvasToolbar';
import CanvasElement from './CanvasElement';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { debounce } from 'lodash'; 

interface CanvasEditorProps {
  readOnly?: boolean;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({ readOnly = false }) => {
  const { user } = useAuth();
  const { currentCanvas, addElement, updateElement, deleteElement, saveCanvas, setCurrentCanvas } = useCanvas();
  const { isConnected, sendMessage, registerHandler, peerId } = useWebSocket();
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
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store a ref of all object URLs to revoke them on delete
  const imageObjectURLs = useRef<Map<string, string>>(new Map());

  // Utility to create object URL for image file
  const createImageObjectURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Scale large images down to max dimensions
          const maxDimension = 1200;
          let { width, height } = img;
          
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          
          // Create a canvas to compress the image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Could not get canvas context'));
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Use a more efficient format and compression
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob);
                resolve(url);
              } else {
                reject(new Error('Failed to create blob'));
              }
            },
            'image/jpeg',  // JPEG is smaller than PNG for photos
            0.7  // 70% quality gives good balance of quality vs size
          );
        };
        img.onerror = reject;
        img.src = event.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Create debounced functions for network operations
  const debouncedSendUpdate = useCallback(
    debounce((id: string, updates: Partial<CanvasElementType>) => {
      if (isConnected && sendMessage) {
        sendMessage({
          type: 'canvasOperation',
          payload: {
            operation: 'update',
            element: { 
              id, 
              ...updates,
              _timestamp: Date.now() 
            }
          }
        });
      }
    }, 100), // 100ms debounce
    [isConnected, sendMessage]
  );

  // Auto-save every 30 seconds, but only if there are changes
  useEffect(() => {
    if (!readOnly && currentCanvas) {
      let lastElements = JSON.stringify(currentCanvas.elements);
      const interval = setInterval(() => {
        // Only save if elements changed
        const nowElements = JSON.stringify(currentCanvas.elements);
        if (nowElements !== lastElements) {
          saveCanvas();
          lastElements = nowElements;
        }
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [readOnly, currentCanvas, saveCanvas]);

  useEffect(() => {
    // Clean up all object URLs when component is unmounted
    return () => {
      // Revoke object URLs to prevent memory leaks
      imageObjectURLs.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      imageObjectURLs.current.clear();
    };
  }, []);
  // Remove the effect that was auto-connecting to peers
  // This connection should only happen when the Share button is clicked

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
    const x = (e.clientX - rect.left) / scale// + viewportPosition.x;
    const y = (e.clientY - rect.top) / scale// + viewportPosition.y;

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
          type: 'canvasOperation',
          payload: {
            operation: 'add',
            element: newCard
          }
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
          type: 'canvasOperation',
          payload: {
            operation: 'add',
            element: newText
          }
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
                type: 'canvasOperation',
                payload: {
                  operation: 'add',
                  element: newArrow
                }
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
          type: 'canvasOperation',
          payload: {
            operation: 'add',
            element: newShape
          }
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
    const x = (e.clientX - rect.left) / scale// + viewportPosition.x;
    const y = (e.clientY - rect.top) / scale// + viewportPosition.y;

    if (isDrawing && activeTool === 'draw') {
      setDrawingPoints([...drawingPoints, { x, y }]); // Add point to current drawing
    } else if (isDragging && selectedElement) {
      const element = currentCanvas?.elements.find(el => el.id === selectedElement);

      if (element) {
        const newX = x - dragOffset.x;
        const newY = y - dragOffset.y;

        // Replace direct updateElement call with handleUpdateElement to ensure broadcasting
        handleUpdateElement(selectedElement, { x: newX, y: newY });

        // Send cursor move separately if needed
        if (isConnected) {
          sendMessage({
            type: 'cursorMove',
            payload: { x: e.clientX, y: e.clientY }
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
          type: 'canvasOperation',
          payload: {
            operation: 'add',
            element: newDrawing
          }
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

  const handleUpdateElement = (id: string, updates: Partial<CanvasElementType>) => {
    // Ensure coordinates are valid numbers if they're being updated
    const validatedUpdates = {
      ...updates,
      x: updates.x !== undefined ? Number(updates.x) : undefined,
      y: updates.y !== undefined ? Number(updates.y) : undefined
    };
    
    // Update locally
    updateElement(id, validatedUpdates);
    
    // CRITICAL: Always send to peers, even during dragging
    if (isConnected && sendMessage) {
      // Add a throttled broadcast to avoid overwhelming the network during dragging
      if (isDragging) {
        // Use requestAnimationFrame to throttle updates during drag operations
        requestAnimationFrame(() => {
          console.log('Broadcasting element position update:', id, validatedUpdates);
          sendMessage({
            type: 'canvasOperation',
            payload: {
              operation: 'update',
              element: { 
                id, 
                ...validatedUpdates, 
                _bypass: true,
                _originDevice: window.location.hostname
              },
              _bypassDedupe: true,
              _timestamp: Date.now()
            }
          });
        });
      } else {
        // For non-dragging updates, send immediately
        console.log('Broadcasting element update:', id, validatedUpdates);
        sendMessage({
          type: 'canvasOperation',
          payload: {
            operation: 'update',
            element: { 
              id, 
              ...validatedUpdates,
              _bypass: true,
              _originDevice: window.location.hostname
            },
            _bypassDedupe: true,
            _timestamp: Date.now()
          }
        });
      }
    }
  };

  // Handle element deletion
  const handleDeleteElement = (id: string) => {
    // Revoke object URL if this is an image
    const url = imageObjectURLs.current.get(id);
    if (url) {
      URL.revokeObjectURL(url);
      imageObjectURLs.current.delete(id);
    }
    deleteElement(id);
  
    // Send delete operation to peers
    if (isConnected && sendMessage) {
      console.log('Broadcasting element deletion to peers:', id);
      sendMessage({
        type: 'canvasOperation',
        payload: {
          operation: 'delete',
          elementId: id,
          _bypass: true,
          _originDevice: window.location.hostname,
          _bypassDedupe: true,
          _timestamp: Date.now()
        }
      });
    }
  
    setSelectedElement(null);
    if (arrowStart === id) {
      setArrowStart(null); // Cancel arrow creation if start element is deleted
    }
  };

  // Create a handleAddElement function that handles both local add and peer sync
  const handleAddElement = (element: Omit<CanvasElementType, 'id'>) => {
    // Create a stable device identifier that persists between sessions
    const getStableDeviceId = () => {
      const stored = localStorage.getItem('stableDeviceId');
      if (stored) return stored;
      
      const newId = `device-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem('stableDeviceId', newId);
      return newId;
    };
  
    // Ensure coordinates are valid numbers
    const validatedElement = {
      ...element,
      x: typeof element.x === 'number' ? element.x : 0,
      y: typeof element.y === 'number' ? element.y : 0
    };
    
    // Generate a unique ID with timestamp for better uniqueness
    const uniqueId = `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const stableDeviceId = getStableDeviceId();
    
    // Create the element with device identifiers
    const newElement: CanvasElementType = {
      ...validatedElement,
      id: uniqueId,
      _source: peerId || stableDeviceId
    };
    
    // Add locally first
    addElement(newElement);
    
    // Then broadcast with special flags to ensure cross-device handling
    if (isConnected && sendMessage) {
      console.log('Broadcasting new element to peers with flags');
      
      sendMessage({
        type: 'canvasOperation',
        payload: {
          operation: 'add',
          element: {
            ...newElement,
            _deviceId: stableDeviceId,
            _crossDeviceElement: true,
            _timestamp: Date.now()
          },
          _crossDeviceOp: true,
          _forceBroadcast: true,
          deviceId: stableDeviceId
        }
      });
    }
    
    return newElement;
  };

  // Utility to compress and resize image
  const compressImage = (file: File, maxSize = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          // Resize
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('No canvas context'));
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG (much smaller than PNG)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !canvasRef.current || readOnly) return;
  
    try {
      const file = e.target.files[0];
      setIsLoading(true); // Now this will work with our added state
      
      // Process and compress the image
      const objectUrl = await createImageObjectURL(file);
      
      // Generate a unique ID for the image element
      const imageId = `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      imageObjectURLs.current.set(imageId, objectUrl);
  
      const rect = canvasRef.current!.getBoundingClientRect();
      const centerX = (rect.width / 2) / scale + viewportPosition.x;
      const centerY = (rect.height / 2) / scale + viewportPosition.y;
  
      const newImage: CanvasElementType = {
        id: imageId,
        type: 'image',
        x: centerX - 100,
        y: centerY - 75,
        width: 200,
        height: 150,
        imageUrl: objectUrl
      };
  
      addElement(newImage);
      toast.success('Image added', { position: 'bottom-center' });
  
      if (isConnected) {
        sendMessage({
          type: 'canvasOperation',
          payload: {
            operation: 'add',
            element: newImage
          }
        });
      }
  
      setActiveTool('select');
    } catch (err) {
      console.error('Error uploading image:', err);
      toast.error('Failed to upload image');
    } finally {
      setIsLoading(false); // Clear loading state
      if (e.target) e.target.value = ''; // Clear input to allow same file selection
    }
  };

  const handleExportAsImage = () => {
    if (!contentRef.current) {
      toast.error('Canvas content not ready for export');
      return;
    }
  
    // Find the actual content bounds
    const elements = currentCanvas?.elements || [];
    if (elements.length === 0) {
      toast.error('No content to export');
      return;
    }
  
    // Calculate the bounds of all elements
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    elements.forEach(el => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width || 100));
      maxY = Math.max(maxY, el.y + (el.height || 100));
    });
  
    // Add padding
    const padding = 50;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = maxX + padding;
    maxY = maxY + padding;
  
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
  
    // Store original view state
    const originalScale = scale;
    const originalPosition = { ...viewportPosition };
    const originalSelection = selectedElement; // Store selected element
    
    // Set optimal view for capture and clear selection
    setScale(1);
    setViewportPosition({ x: minX, y: minY });
    setSelectedElement(null); // Clear selection to hide UI controls
  
    // Wait for the view update to apply
    setTimeout(() => {
      html2canvas(contentRef.current!, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher resolution
        x: minX,
        y: minY,
        width: contentWidth,
        height: contentHeight,
        allowTaint: true,
        useCORS: true,
      }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${currentCanvas?.name || 'canvas'}_export.png`;
        link.href = imgData;
        link.click();
        toast.success('Canvas exported as image');
        
        // Restore original view and selection
        setScale(originalScale);
        setViewportPosition(originalPosition);
        setSelectedElement(originalSelection); // Restore selection
      }).catch(err => {
        console.error('Image export failed:', err);
        toast.error('Failed to export canvas as image');
        
        // Restore original view and selection on error
        setScale(originalScale);
        setViewportPosition(originalPosition);
        setSelectedElement(originalSelection); // Restore selection
      });
    }, 200);
  };

  const handleExportAsPDF = () => {
    if (!contentRef.current) {
      toast.error('Canvas content not ready for export');
      return;
    }
  
    // Find the actual content bounds instead of using the entire canvas
    const elements = currentCanvas?.elements || [];
    if (elements.length === 0) {
      toast.error('No content to export');
      return;
    }
  
    // Calculate the bounds of all elements
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    elements.forEach(el => {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + (el.width || 100));
      maxY = Math.max(maxY, el.y + (el.height || 100));
    });
  
    // Add padding
    const padding = 50;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = maxX + padding;
    maxY = maxY + padding;
  
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
  
    // Store original view state
    const originalScale = scale;
    const originalPosition = { ...viewportPosition };
    const originalSelection = selectedElement; // Store selected element
    
    // Set optimal view for capture and clear selection
    setScale(1);
    setViewportPosition({ x: minX, y: minY });
    setSelectedElement(null); // Clear selection to hide UI controls
  
    // Wait for the view update to apply
    setTimeout(() => {
      html2canvas(contentRef.current!, {
        backgroundColor: '#ffffff',
        scale: 2,
        x: minX,
        y: minY,
        width: contentWidth,
        height: contentHeight,
        allowTaint: true,
        useCORS: true,
      }).then(canvas => {
        // Calculate PDF size - use A4 or fit to content
        const pdfWidth = Math.min(595, contentWidth);
        const pdfHeight = Math.min(842, contentHeight * (pdfWidth / contentWidth));
        
        const pdf = new jsPDF({
          orientation: contentWidth > contentHeight ? 'landscape' : 'portrait',
          unit: 'pt', 
          format: [pdfWidth, pdfHeight]
        });
  
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
        pdf.save(`${currentCanvas?.name || 'canvas'}_export.pdf`);
        toast.success('Canvas exported as PDF');
        
        // Restore original view and selection
        setScale(originalScale);
        setViewportPosition(originalPosition);
        setSelectedElement(originalSelection); // Restore selection
      }).catch(err => {
        console.error('PDF export failed:', err);
        toast.error('Failed to export canvas as PDF');
        
        // Restore original view and selection on error
        setScale(originalScale);
        setViewportPosition(originalPosition);
        setSelectedElement(originalSelection); // Restore selection
      });
    }, 200);
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
  }, [currentCanvas, scale, viewportPosition]);

  // Add this to your CanvasEditor component
  useEffect(() => {
    if (!isConnected || !registerHandler) return;
    
    // More comprehensive debug handler for real-time updates
    const unregisterUpdateHandler = registerHandler('canvasUpdate', (payload) => {
      console.log(`DEBUG: Canvas operation received in editor: ${payload.operation}`, payload);
      
      // Handle direct updates from peers
      if (currentCanvas && payload.operation === 'add' && payload.element) {
        const elementToAdd = {
          ...payload.element,
          id: payload.element.id || `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        };
        
        // Check if element already exists
        const elementExists = currentCanvas.elements.some(el => el.id === elementToAdd.id);
        if (!elementExists) {
          // Real-time update directly in the editor
          setCurrentCanvas(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              elements: [...prev.elements, elementToAdd]
            };
          });
          
          toast.success('Collaborator added a new element', {
            position: 'bottom-right',
            duration: 2000
          });
        }
      }
    });
    
    return () => {
      if (typeof unregisterUpdateHandler === 'function') {
        unregisterUpdateHandler();
      }
    };
  }, [isConnected, registerHandler, currentCanvas, setCurrentCanvas]);

  // Add this to your CanvasEditor component
  useEffect(() => {
    if (!isConnected) return;
    
    // Debug: monitor real-time updates from others
    const unregisterDebugHandler = registerHandler('canvasUpdate', (payload) => {
      console.log(`DEBUG: Canvas operation received in editor: ${payload.operation}`, payload);
      
      // Show a visual indicator of real-time updates
      if (payload.element) {
        toast.success(`Collaborator ${payload.operation === 'add' ? 'added' : 'updated'} an element`, {
          position: 'bottom-right',
          duration: 2000
        });
      } else if (payload.elementId) {
        toast.info(`Collaborator deleted an element`, {
          position: 'bottom-right',
          duration: 2000
        });
      }
    });
    
    return () => {
      if (typeof unregisterDebugHandler === 'function') {
        unregisterDebugHandler();
      }
    };
  }, [isConnected, registerHandler]);

  // On unmount, revoke all object URLs
  useEffect(() => {
    return () => {
      imageObjectURLs.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      imageObjectURLs.current.clear();
    };
  }, []);

  return (
    <div className="flex flex-col h-full canvas-theme-aware">
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
        onMouseDown={(e) => { if (e.button === 2) handleCanvasMouseDown(e); }}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={(e) => { if (e.button === 2) handleCanvasMouseUp(); }}
        onContextMenu={handleContextMenu}
      >
        <div
          ref={canvasRef}
          className="absolute w-full h-full canvas-background canvas-theme-aware"
          style={{
            width: '5000px', // Reduced from 100000px
            height: '5000px', // Reduced from 100000px
            transform: `translate(${-(viewportPosition.x * scale)}px, ${-(viewportPosition.y * scale)}px) scale(${scale})`,
            transformOrigin: '0 0',
            cursor: isPanning ? 'grabbing' : (activeTool === 'select' ? 'default' : 'crosshair'),
            left: `calc(50% - 2500px * ${scale})`, // Adjusted for new size
            top: `calc(50% - 2500px * ${scale})`,
            touchAction: 'none',
          }}
          onMouseDown={(e) => { if (e.button !== 2) handleCanvasMouseDown(e); }}
          onMouseUp={(e) => { if (e.button !== 2) handleCanvasMouseUp(); }}
          onMouseLeave={handleCanvasMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleCanvasMouseUp}
        >
          {/* Content container for elements and temporary drawing */}
          <div ref={contentRef} className="absolute top-0 left-0" style={{ width: '100%', height: '100%' }}>
            {/* Render canvas elements */}
            {currentCanvas?.elements.map(element => (
              <CanvasElement
                key={element.id}
                element={element}
                selected={element.id === selectedElement}
                onUpdateElement={(updates) => handleUpdateElement(element.id, updates)}
                onDeleteElement={handleDeleteElement}
                readOnly={readOnly}
                allElements={currentCanvas.elements}
                onSelectElement={setSelectedElement}
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
                  strokeWidth={2 / scale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
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