
import { useEffect } from 'react';
import { useCanvas, CanvasData } from '../contexts/CanvasContext';
import { useWebSocket } from '../contexts/WebSocketContext';

// Create a separate hook for canvas-websocket integration
export const useCanvasWebSocket = () => {
  const { currentCanvas, setCurrentCanvas } = useCanvas();
  const { registerHandler, sendMessage } = useWebSocket();

  useEffect(() => {
    if (!registerHandler) return;

    const unregisterCanvasState = registerHandler('canvasState', (payload: any) => {
      if (!payload) return;
      
      setCurrentCanvas({
        id: payload.id,
        name: payload.name || 'Shared Canvas',
        elements: payload.elements || [],
        createdBy: payload.createdBy || 'shared',
        createdAt: payload.createdAt || new Date().toISOString(),
        joinCode: payload.joinCode || '',
        isInfinite: payload.isInfinite || true
      });
    });

    const unregisterRequestState = registerHandler('requestCanvasState', () => {
      if (!currentCanvas || !sendMessage) return;
      
      sendMessage({
        type: 'canvasState',
        payload: {
          id: currentCanvas.id,
          name: currentCanvas.name,
          elements: currentCanvas.elements,
          isInfinite: currentCanvas.isInfinite
        }
      });
    });

    return () => {
      unregisterCanvasState();
      unregisterRequestState();
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
