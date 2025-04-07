import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface WebSocketMessage {
  type: string;
  payload: any;
}

interface WebSocketContextType {
  isConnected: boolean;
  connect: (joinCode: string) => void;
  disconnect: () => void;
  sendMessage: (message: WebSocketMessage) => void;
  registerHandler: (type: string, handler: (payload: any) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const handlers = useRef<Map<string, (payload: any) => void>>(new Map());

  const connect = (joinCode: string) => {
  
    if (ws.current) return; // Prevent multiple connections
      // Use explicit port for WebSocket server
    const host = window.location.hostname;
    const wsUrl = `ws://${host}:8080/ws`; // Directly use port 8080
    console.log("Attempting WebSocket connection to:", wsUrl);  // <-- Add this
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      setIsConnected(true);
      ws.current?.send(JSON.stringify({
        type: 'joinCanvas',
        payload: { joinCode }
      }));
      toast.success('Connected to canvas');
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const handler = handlers.current.get(message.type);
      if (handler) handler(message.payload);
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      toast.info('Disconnected from canvas');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      toast.error('WebSocket connection error');
    };
  };

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  const registerHandler = (type: string, handler: (payload: any) => void) => {
    handlers.current.set(type, handler);
  };

  const disconnect = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  };

  return (
    <WebSocketContext.Provider value={{ 
      isConnected, 
      connect, 
      disconnect, 
      sendMessage, 
      registerHandler 
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};