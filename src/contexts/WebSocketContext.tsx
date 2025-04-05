
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useCanvas, CanvasElement } from './CanvasContext';

interface WebSocketMessage {
  type: 'addElement' | 'updateElement' | 'deleteElement' | 'clearCanvas';
  payload: any;
  canvasId: string;
  userId: string;
}

interface WebSocketContextType {
  isConnected: boolean;
  connect: (canvasId: string, userId: string) => void;
  disconnect: () => void;
  sendMessage: (message: Omit<WebSocketMessage, 'userId'>) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Mock WebSocket class for client-side use only
class MockWebSocket {
  private callbacks: { [key: string]: Function[] } = {};
  private isOpen: boolean = false;
  private static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.isOpen = true;
    MockWebSocket.instances.push(this);
    
    // Simulate connection established
    setTimeout(() => {
      this.triggerEvent('open', {});
    }, 500);
  }

  addEventListener(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  send(data: string) {
    if (!this.isOpen) return;
    
    try {
      const message = JSON.parse(data);
      
      // Broadcast to all other instances
      MockWebSocket.instances.forEach(instance => {
        if (instance !== this && instance.isOpen) {
          instance.triggerEvent('message', { data });
        }
      });
    } catch (error) {
      console.error('Error sending mock WebSocket message:', error);
    }
  }

  close() {
    this.isOpen = false;
    this.triggerEvent('close', {});
    MockWebSocket.instances = MockWebSocket.instances.filter(instance => instance !== this);
  }

  private triggerEvent(event: string, data: any) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }
}

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<MockWebSocket | null>(null);
  const canvasIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  
  const { addElement, updateElement, deleteElement, clearCanvas } = useCanvas();

  const connect = (canvasId: string, userId: string) => {
    // Close existing connection if there is one
    if (socketRef.current) {
      disconnect();
    }
    
    // Create a new mock WebSocket connection
    const socket = new MockWebSocket(`ws://localhost:8080/canvas/${canvasId}`);
    
    socket.addEventListener('open', () => {
      setIsConnected(true);
      toast.success('Connected to canvas');
    });
    
    socket.addEventListener('message', (event: any) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        // Ignore messages from self
        if (message.userId === userId) return;
        
        // Process incoming messages
        switch (message.type) {
          case 'addElement':
            addElement(message.payload);
            break;
          case 'updateElement':
            updateElement(message.payload.id, message.payload.updates);
            break;
          case 'deleteElement':
            deleteElement(message.payload.id);
            break;
          case 'clearCanvas':
            clearCanvas();
            break;
          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    socket.addEventListener('close', () => {
      setIsConnected(false);
      toast.info('Disconnected from canvas');
    });
    
    socket.addEventListener('error', () => {
      setIsConnected(false);
      toast.error('WebSocket connection error');
    });
    
    socketRef.current = socket;
    canvasIdRef.current = canvasId;
    userIdRef.current = userId;
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      canvasIdRef.current = null;
      userIdRef.current = null;
    }
  };

  const sendMessage = (message: Omit<WebSocketMessage, 'userId'>) => {
    if (!socketRef.current || !isConnected || !userIdRef.current) {
      console.warn('Cannot send message: WebSocket not connected');
      return;
    }
    
    const fullMessage: WebSocketMessage = {
      ...message,
      userId: userIdRef.current
    };
    
    socketRef.current.send(JSON.stringify(fullMessage));
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, connect, disconnect, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
