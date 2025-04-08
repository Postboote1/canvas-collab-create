
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
    
    // Use relative URL for WebSocket connection that works in all environments
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // This includes hostname and port
    const wsUrl = `${protocol}//${host}/ws`;
    
    console.log("Connecting to WebSocket at:", wsUrl);
    
    try {
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
        try {
          const message = JSON.parse(event.data);
          const handler = handlers.current.get(message.type);
          if (handler) handler(message.payload);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        toast.info('Disconnected from canvas');
        ws.current = null;
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('WebSocket connection error');
        ws.current = null;
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      toast.error('Failed to connect to the canvas');
    }
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
