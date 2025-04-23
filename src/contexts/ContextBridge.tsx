import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom'    
import { useCanvas } from './CanvasContext';
import { useWebSocket } from './WebSocketContext';
import { toast } from 'sonner';

export const ContextBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const { setCurrentCanvas, currentCanvas } = useCanvas();
  const { registerHandler, sendMessage, setWebSocketCanvasState } = useWebSocket();
  const lastUpdateTimeRef = useRef<number>(0);
  const isCanvasRoute = pathname.startsWith('/canvas') || pathname.startsWith('/presentation');
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync WebSocket context with Canvas context
  useEffect(() => {
    // Cancel any pending sync operations when route changes
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [pathname]);

  useEffect(() => {
    // Skip everything if not on canvas route
    if (!isCanvasRoute || !currentCanvas || !setWebSocketCanvasState) return;
    
    // Throttle updates to max once per second
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < 1000) return;
    
    // Use a delayed update to break potential update loops
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    
    syncTimeoutRef.current = setTimeout(() => {
      try {
        lastUpdateTimeRef.current = Date.now();
        setWebSocketCanvasState(currentCanvas);
      } catch (err) {
        console.error('Error syncing canvas state:', err);
      }
    }, 200);
    
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [
    isCanvasRoute, 
    currentCanvas?.id,
    // Only depend on element count changes, not the full object
    currentCanvas?.elements?.length,
    setWebSocketCanvasState
  ]);

  // SINGLE canvasState handler
  useEffect(() => {
    if (!isCanvasRoute || !registerHandler || !setCurrentCanvas) return;

    const unregisterCanvasState = registerHandler('canvasState', (payload) => {
      console.log('Bridge received canvas state:', payload);
      if (!payload) {
        console.error('Received empty canvas state');
        return;
      }

      try {
        // Make sure elements have valid coordinates
        const elements = Array.isArray(payload.elements) ? payload.elements.map(el => ({
          ...el,
          x: typeof el.x === 'number' ? el.x : 0,
          y: typeof el.y === 'number' ? el.y : 0,
          id: el.id || `element_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
        })) : [];

        // Create a valid canvas object from the received state
        const validCanvas = {
          id: payload.id || `shared-${Date.now()}`,
          name: payload.name || 'Shared Canvas',
          elements: elements,
          createdBy: payload.createdBy || 'shared',
          createdAt: payload.createdAt || new Date().toISOString(),
          joinCode: payload.joinCode || '',
          isInfinite: payload.isInfinite === undefined ? true : payload.isInfinite
        };

        console.log(`Setting canvas from remote with ${elements.length} elements`);
        
        // Set the canvas state
        setCurrentCanvas(validCanvas);
        toast.success(`Canvas synced with ${elements.length} elements`);
      } catch (error) {
        console.error('Error updating canvas with received state:', error);
        toast.error('Failed to sync canvas');
      }
    });

    return () => {
      unregisterCanvasState();
    };
  }, [registerHandler, setCurrentCanvas, pathname]);

  // SINGLE canvasUpdate handler
  useEffect(() => {
    if (!isCanvasRoute || !registerHandler || !sendMessage || !currentCanvas) return;
    
    const unregisterCanvasUpdate = registerHandler('canvasUpdate', (payload) => {
      // Enhanced logging to trace the update flow
      console.log(`ContextBridge handler processing ${payload.operation}:`, payload);
      
      if (!payload || !payload.operation) {
        console.error('Invalid canvas update received');
        return;
      }
      
      // Get current canvas from localStorage or state
      let canvas = currentCanvas;
      
      // Try to get the latest canvas data from localStorage
      try {
        const pendingCanvasState = localStorage.getItem('pendingCanvasState');
        if (pendingCanvasState) {
          const parsedCanvas = JSON.parse(pendingCanvasState);
          if (parsedCanvas && parsedCanvas.elements) {
            canvas = parsedCanvas;
          }
        }
      } catch (error) {
        console.error('Error parsing pending canvas state:', error);
      }
      
      if (!canvas) {
        console.error('No current canvas to update in ContextBridge');
        return;
      }
      
      console.log('Current canvas before update:', canvas.elements.length || 0);
      console.log('Current canvas ID:', canvas.id);

      try {
        switch (payload.operation) {
          case 'add':
            if (payload.element) {
              // Ensure element has an ID and valid coordinates
              const elementToAdd = {
                ...payload.element,
                id: payload.element.id || `element_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
                x: typeof payload.element.x === 'number' ? payload.element.x : 0,
                y: typeof payload.element.y === 'number' ? payload.element.y : 0
              };
              const elementTrackingKey = elementToAdd.id;

            // Check both ID and position to identify duplicates
              const isDuplicate = canvas.elements.some(el => {
              const idMatch = el.id === elementToAdd.id;
                // For exact duplicates, also check for similar coordinates (within 2 pixels)
              const positionMatch = idMatch || 
                (Math.abs((el.x || 0) - (elementToAdd.x || 0)) < 2 && 
                Math.abs((el.y || 0) - (elementToAdd.y || 0)) < 2 && 
                (el._source === elementToAdd._source));
                return idMatch || positionMatch;
              });

              if (isDuplicate) {
                console.log(`Element ${elementToAdd.id} already exists in canvas or is a duplicate, skipping`);
                return;
              }
              // Check if element already exists
              const elementExists = canvas.elements.some(el => el.id === elementToAdd.id);
              if (elementExists) {
                console.log(`Element ${elementToAdd.id} already exists in canvas, skipping`);
                return;
              }
              
              // Check if this is a touch device
              const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
              
              console.log('Adding element to canvas ID:', canvas.id);
              console.log('Element data:', elementToAdd);
              
              // For touch devices, merge very similar elements to prevent duplicates from touch events
              let mergedElements = [...canvas.elements];
              if (isTouchDevice && elementToAdd.type === 'drawing') {
                // For touch devices and drawing elements, look for very similar drawings and merge them
                const similarElementIndex = mergedElements.findIndex(el => 
                  el.type === 'drawing' && 
                  el._source === elementToAdd._source &&
                  Math.abs((el.x || 0) - (elementToAdd.x || 0)) < 20 && 
                  Math.abs((el.y || 0) - (elementToAdd.y || 0)) < 20
                );
                
                if (similarElementIndex >= 0) {
                  // For similar drawings, merge the points to make one continuous drawing
                  mergedElements.splice(similarElementIndex, 1);
                }
              }
              
              // Create a new canvas object with the added element
              const updatedCanvas = {
                ...canvas,
                elements: [...mergedElements, elementToAdd]
              };
              
              // Update the local state
              setCurrentCanvas(updatedCanvas);
              
              // Also update localStorage for persistence
              localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
              
              console.log(`Element added, canvas now has ${updatedCanvas.elements.length} elements`);
              
              toast.success('New element added by collaborator', {
                position: 'bottom-right',
                duration: 2000
              });
            }
            break;
            
          case 'update':
            if (payload.element && payload.element.id) {
              console.log('Updating element from remote:', payload.element);
              
              // Find the element and update it
              const elementIndex = canvas.elements.findIndex(el => el.id === payload.element.id);
              if (elementIndex === -1) {
                console.warn(`Element ${payload.element.id} not found for update in ContextBridge`);
                return;
              }
              
              // Create a new canvas object with the updated element and ensure coordinates are numbers
              const updatedCanvas = {
                ...canvas,
                elements: canvas.elements.map((el, index) => 
                  index === elementIndex ? { 
                    ...el, 
                    ...payload.element,
                    // Always convert coordinates to numbers
                    x: typeof payload.element.x === 'number' ? payload.element.x : 
                       (payload.element.x !== undefined ? Number(payload.element.x) : el.x),
                    y: typeof payload.element.y === 'number' ? payload.element.y : 
                       (payload.element.y !== undefined ? Number(payload.element.y) : el.y)
                  } : el
                )
              };
              
              // Important: Update the state directly with this update to ensure immediate UI changes
              console.log(`Element ${payload.element.id} updated, applying now`);
              setCurrentCanvas(updatedCanvas);
              
              // Also update localStorage for persistence
              localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
            }
            break;
            
          case 'delete':
            if (payload.elementId) {
              console.log('Deleting element from remote:', payload.elementId);
              
              // Always process delete operations, even if element isn't found
              // This ensures consistency when elements are deleted
              
              // Create a new canvas object without the deleted element
              const updatedCanvas = {
                ...canvas,
                elements: canvas.elements.filter(el => el.id !== payload.elementId)
              };
              
              // Log if we actually removed anything
              if (updatedCanvas.elements.length < canvas.elements.length) {
                console.log(`Element ${payload.elementId} removed from canvas, elements: ${canvas.elements.length} → ${updatedCanvas.elements.length}`);
              } else {
                console.log(`Element ${payload.elementId} not found, but updating canvas anyway`);
              }
              
              // Update the local state regardless, to ensure consistency
              setCurrentCanvas(updatedCanvas);
              
              // Also update localStorage for persistence
              localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
              
              toast.success('Element deleted by collaborator', {
                position: 'bottom-right',
                duration: 2000
              });
            }
            break;
            
          default:
            console.warn('Unknown operation:', payload.operation);
        }
      } catch (error) {
        console.error('Error processing canvas operation in ContextBridge:', error);
      }
    });

    return () => {
      unregisterCanvasUpdate();
    };
  }, [registerHandler, sendMessage, currentCanvas?.id, isCanvasRoute]);

  // Canvas audit logging
  useEffect(() => {
    if (currentCanvas) {
      //console.log('AUDIT: Canvas updated:', {
      //  id: currentCanvas.id,
      //  elements: currentCanvas.elements.length,
      //  elementIds: currentCanvas.elements.map(el => el.id)
      //});
    }
  }, [currentCanvas]);

  return <>{children}</>;
};

export default ContextBridge;