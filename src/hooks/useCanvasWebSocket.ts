
import { useEffect } from 'react';
import { useCanvas } from '../contexts/CanvasContext';
import { useWebSocket } from '../contexts/WebSocketContext';

// Create a separate hook for canvas-websocket integration
export const useCanvasWebSocket = () => {
  const { currentCanvas, setCurrentCanvas } = useCanvas();
  const { registerHandler, sendMessage } = useWebSocket();

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
      if (!payload || !payload.elements) {
        console.error('Received invalid canvas state');
        return;
      }
      
      console.log(`Received complete canvas state with ${payload.elements.length} elements`);
      
      // Set the full canvas state
      setCurrentCanvas(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          id: payload.id || prev.id,
          name: payload.name || prev.name,
          elements: payload.elements || [],
          isInfinite: payload.isInfinite !== undefined ? payload.isInfinite : prev.isInfinite
        };
      });
    });

    return () => {
      unregisterRequestState();
      unregisterCanvasState();
    };
  }, [registerHandler, currentCanvas, sendMessage, setCurrentCanvas]);

  return {
    sendCanvasOperation: (operation: string, payload: any) => {
      if (!sendMessage) return;
      sendMessage({
        type: 'canvasOperation',
        payload: { operation, ...payload }
      });
    }
  };
};
