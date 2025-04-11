
import React, { useEffect, useState } from 'react';
import { useCanvas } from './CanvasContext';
import { useWebSocket } from './WebSocketContext';
import { toast } from 'sonner';

export const ContextBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setCurrentCanvas, currentCanvas } = useCanvas();
  const { registerHandler, sendMessage, setWebSocketCanvasState } = useWebSocket();
  const [initialSync, setInitialSync] = useState(false);

  // Sync WebSocket context with Canvas context
  useEffect(() => {
    if (currentCanvas && setWebSocketCanvasState) {
      setWebSocketCanvasState(currentCanvas);
    }
  }, [currentCanvas, setWebSocketCanvasState]);

  // Request full canvas state when joining
  useEffect(() => {
    if (currentCanvas && !initialSync && sendMessage) {
      console.log('Requesting initial canvas state from peers');
      sendMessage({
        type: 'requestCanvasState',
        payload: {
          canvasId: currentCanvas.id
        }
      });
      setInitialSync(true);
    }
  }, [currentCanvas, initialSync, sendMessage]);

  // Full canvas state handler
  useEffect(() => {
    if (!registerHandler) return;

    const unregisterCanvasState = registerHandler('canvasState', (payload) => {
      console.log('Bridge received complete canvas state:', payload);
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
          id: payload.id || currentCanvas?.id || `shared-${Date.now()}`,
          name: payload.name || currentCanvas?.name || 'Shared Canvas',
          elements: elements,
          createdBy: payload.createdBy || currentCanvas?.createdBy || 'shared',
          createdAt: payload.createdAt || currentCanvas?.createdAt || new Date().toISOString(),
          joinCode: payload.joinCode || currentCanvas?.joinCode || '',
          isInfinite: payload.isInfinite === undefined ? true : payload.isInfinite
        };

        console.log(`Setting canvas from remote with ${elements.length} elements`);
        
        // Set the canvas state, preserving the original canvas properties
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
  }, [registerHandler, setCurrentCanvas, currentCanvas]);

  // Canvas update handler (for individual operations)
  useEffect(() => {
    if (!registerHandler || !sendMessage) return;
    
    const unregisterCanvasUpdate = registerHandler('canvasUpdate', (payload) => {
      // Enhanced logging to trace the update flow
      console.log(`ContextBridge handler processing ${payload.operation}:`, payload);
      console.log('Current canvas before update:', currentCanvas?.elements?.length || 0);
      console.log('Current canvas ID:', currentCanvas?.id);
      
      if (!payload || !payload.operation) {
        console.error('Invalid canvas update received');
        return;
      }
      
      if (!currentCanvas) {
        console.error('No current canvas to update');
        return;
      }

      try {
        // Store the current canvas ID to check for consistency
        const canvasId = currentCanvas.id;
        
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
              
              console.log('Adding element to canvas ID:', canvasId);
              console.log('Element data:', elementToAdd);
              
              // Find if element with this ID already exists (to avoid duplicates)
              const existingElementIndex = currentCanvas.elements.findIndex(el => el.id === elementToAdd.id);
              
              if (existingElementIndex !== -1) {
                console.log(`Element ${elementToAdd.id} already exists, updating instead`);
                // Update element instead of adding a duplicate
                const updatedElements = [...currentCanvas.elements];
                updatedElements[existingElementIndex] = elementToAdd;
                
                setCurrentCanvas({
                  ...currentCanvas,
                  elements: updatedElements
                });
              } else {
                // Element doesn't exist, add it
                const updatedCanvas = {
                  ...currentCanvas,
                  elements: [...currentCanvas.elements, elementToAdd]
                };
                
                setCurrentCanvas(updatedCanvas);
                
                console.log(`Element added, canvas now has ${updatedCanvas.elements.length} elements`);
                
                toast.success('New element added by collaborator', {
                  position: 'bottom-right',
                  duration: 2000
                });
              }
            }
            break;
            
          case 'update':
            if (payload.element && payload.element.id) {
              console.log('Updating element from remote:', payload.element);
              
              // Don't recreate elements if possible - check if the element exists
              const elementExists = currentCanvas.elements.some(el => el.id === payload.element.id);
              
              if (elementExists) {
                // Update using functional update to avoid stale state
                setCurrentCanvas(prev => {
                  if (!prev) return prev;
                  
                  // Create a new elements array with the updated element
                  return {
                    ...prev,
                    elements: prev.elements.map(el => 
                      el.id === payload.element.id ? {
                        ...el,
                        ...payload.element,
                        // Ensure valid coordinates when updating
                        x: payload.element.x !== undefined ? Number(payload.element.x) : el.x,
                        y: payload.element.y !== undefined ? Number(payload.element.y) : el.y
                      } : el
                    )
                  };
                });
              } else {
                console.warn(`Element ${payload.element.id} not found for update, adding it`);
                // If element doesn't exist, add it (recovery mechanism)
                const elementToAdd = {
                  ...payload.element,
                  id: payload.element.id,
                  x: typeof payload.element.x === 'number' ? payload.element.x : 0,
                  y: typeof payload.element.y === 'number' ? payload.element.y : 0,
                  type: payload.element.type || 'card',
                  content: payload.element.content || 'Synced Element'
                };
                
                setCurrentCanvas(prev => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    elements: [...prev.elements, elementToAdd]
                  };
                });
              }
            }
            break;
            
          case 'delete':
            if (payload.elementId) {
              console.log('Deleting element from remote:', payload.elementId);
              
              // Update using functional update to avoid stale state
              setCurrentCanvas(prev => {
                if (!prev) return prev;
                
                // Create a new elements array without the deleted element
                return {
                  ...prev,
                  elements: prev.elements.filter(el => el.id !== payload.elementId)
                };
              });
              
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
        console.error('Error processing canvas operation:', error);
      }
    });

    return () => {
      unregisterCanvasUpdate();
    };
  }, [registerHandler, sendMessage, currentCanvas, setCurrentCanvas]);

  // Canvas audit logging
  useEffect(() => {
    if (currentCanvas) {
      console.log('AUDIT: Canvas updated:', {
        id: currentCanvas.id,
        elements: currentCanvas.elements.length,
        elementIds: currentCanvas.elements.map(el => el.id)
      });
    }
  }, [currentCanvas]);

  return <>{children}</>;
};

export default ContextBridge;
