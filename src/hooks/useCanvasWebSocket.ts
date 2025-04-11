
import { useEffect, useCallback } from 'react';
import { useCanvas } from '../contexts/CanvasContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { toast } from 'sonner';

// Create a separate hook for canvas-websocket integration
export const useCanvasWebSocket = () => {
  const { currentCanvas, setCurrentCanvas } = useCanvas();
  const { registerHandler, sendMessage, isConnected } = useWebSocket();

  // Request canvas state from peers when connecting
  const requestCanvasState = useCallback(() => {
    if (!currentCanvas || !sendMessage || !isConnected) return;
    
    console.log('Requesting current canvas state from peers');
    
    sendMessage({
      type: 'requestCanvasState',
      payload: {
        canvasId: currentCanvas.id,
        joinCode: currentCanvas.joinCode
      }
    });
  }, [currentCanvas, sendMessage, isConnected]);

  // Setup handlers for canvas-related WebSocket messages
  useEffect(() => {
    if (!registerHandler) return;

    // Handle canvas state requests from other peers
    const unregisterRequestState = registerHandler('requestCanvasState', (payload) => {
      if (!currentCanvas || !sendMessage) return;
      
      console.log('Received request for canvas state, sending full canvas data');
      
      // Send the complete canvas state in response
      sendMessage({
        type: 'canvasState',
        payload: {
          id: currentCanvas.id,
          name: currentCanvas.name,
          elements: currentCanvas.elements,
          createdBy: currentCanvas.createdBy,
          createdAt: currentCanvas.createdAt,
          joinCode: currentCanvas.joinCode,
          isInfinite: currentCanvas.isInfinite
        }
      });
    });

    // Handle incoming canvas state updates
    const unregisterCanvasState = registerHandler('canvasState', (payload) => {
      if (!payload) {
        console.error('Received invalid canvas state');
        return;
      }
      
      console.log(`Received complete canvas state with ${payload.elements?.length || 0} elements`);
      
      // Check if we actually have elements to process
      if (!payload.elements || !Array.isArray(payload.elements)) {
        console.error('Canvas state missing elements array');
        return;
      }
      
      // Set the full canvas state
      setCurrentCanvas(prev => {
        if (!prev) return prev;
        
        const newCanvas = {
          ...prev,
          id: payload.id || prev.id,
          name: payload.name || prev.name,
          elements: payload.elements || [],
          isInfinite: payload.isInfinite !== undefined ? payload.isInfinite : prev.isInfinite
        };
        
        // Log successful update
        console.log(`Updated canvas with ${newCanvas.elements.length} elements from peer`);
        toast.success(`Canvas synchronized with ${newCanvas.elements.length} elements`);
        
        return newCanvas;
      });
    });

    return () => {
      unregisterRequestState();
      unregisterCanvasState();
    };
  }, [registerHandler, currentCanvas, sendMessage, setCurrentCanvas]);

  return {
    requestCanvasState,
    sendCanvasOperation: useCallback((operation: string, payload: any) => {
      if (!sendMessage || !isConnected) return;
      
      console.log(`Sending canvas operation: ${operation}`, payload);
      
      sendMessage({
        type: 'canvasOperation',
        payload: { operation, ...payload }
      });
    }, [sendMessage, isConnected])
  };
};
