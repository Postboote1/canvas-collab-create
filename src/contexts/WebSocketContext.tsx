
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

// Types
type MessageHandler = (data: any) => void;

interface Message {
  type: string;
  payload: any;
}

export type WebSocketContextType = {
  connect: (joinCode: string) => void;
  disconnect: () => void;
  sendMessage: (message: Message) => void;
  registerHandler: (type: string, handler: MessageHandler) => void;
  peerId: string | null;
  isConnected: boolean;
  isPeerInitialized: boolean;
  connections: DataConnection[];
};

type WebSocketProviderProps = {
  children: ReactNode;
};

// Create context
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Get peer server config based on environment
const getPeerServerConfig = () => {
  // In production, use the same host but with the /peerjs path
  if (import.meta.env.PROD) {
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    const host = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    
    return {
      host: host,
      port: port ? parseInt(port) : (protocol === 'https' ? 443 : 80),
      path: '/peerjs',
      secure: protocol === 'https'
    };
  }
  
  // In development, use localhost:9001
  return {
    host: 'localhost',
    port: 9001,
    path: '/peerjs'
  };
};

// Provider component
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPeerInitialized, setIsPeerInitialized] = useState(false);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [messageHandlers, setMessageHandlers] = useState<Record<string, MessageHandler[]>>({});
  
  const { user } = useAuth();
  
  // Initialize peer
  useEffect(() => {
    const initPeer = () => {
      try {
        const newPeer = new Peer(undefined, getPeerServerConfig());
        
        newPeer.on('open', (id) => {
          console.log('My peer ID is:', id);
          setPeerId(id);
          setIsPeerInitialized(true);
          toast.success(`Connected to peer network with ID: ${id}`);
        });
        
        newPeer.on('connection', (conn) => {
          console.log('Incoming connection:', conn);
          setupConnection(conn);
        });
        
        newPeer.on('error', (err) => {
          console.error('Peer connection error:', err);
          toast.error(`Connection error: ${err.message}`);
        });
        
        setPeer(newPeer);
      } catch (error) {
        console.error('Failed to initialize peer:', error);
        toast.error('Failed to initialize peer connection');
      }
    };
    
    if (!peer) {
      initPeer();
    }
    
    return () => {
      if (peer) {
        peer.destroy();
        setPeer(null);
        setPeerId(null);
        setIsPeerInitialized(false);
        setConnections([]);
      }
    };
  }, []);
  
  // Handle messages by type
  const handleMessage = useCallback((type: string, payload: any) => {
    if (messageHandlers[type]) {
      messageHandlers[type].forEach(handler => handler(payload));
    }
  }, [messageHandlers]);
  
  // Register a handler for a specific message type
  const registerHandler = useCallback((type: string, handler: MessageHandler) => {
    setMessageHandlers(prev => {
      const handlers = prev[type] || [];
      return {
        ...prev,
        [type]: [...handlers.filter(h => h !== handler), handler]
      };
    });
    
    // Return a function to unregister
    return () => {
      setMessageHandlers(prev => {
        const handlers = prev[type] || [];
        return {
          ...prev,
          [type]: handlers.filter(h => h !== handler)
        };
      });
    };
  }, []);
  
  // Configure new connection
  const setupConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      console.log('Connection established with', conn.peer);
      setConnections(prev => [...prev.filter(c => c.peer !== conn.peer), conn]);
      setIsConnected(true);
    });
    
    conn.on('data', (data: any) => {
      console.log('Received data:', data);
      if (data.type) {
        handleMessage(data.type, data.payload);
      }
    });
    
    conn.on('close', () => {
      console.log('Connection closed with', conn.peer);
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
      toast.info(`Peer ${conn.peer} disconnected`);
      
      // If no more connections, set isConnected to false
      setConnections(prev => {
        if (prev.length === 0) {
          setIsConnected(false);
        }
        return prev;
      });
    });
    
    conn.on('error', (err) => {
      console.error('Connection error:', err);
      toast.error(`Connection error with peer ${conn.peer}`);
    });
  }, [handleMessage]);
  
  // Connect to another peer
  const connect = useCallback((joinCode: string) => {
    if (!peer || !joinCode) return;
    
    try {
      console.log('Connecting to peer:', joinCode);
      const conn = peer.connect(joinCode);
      setupConnection(conn);
      toast.success(`Connected to canvas with peer ID: ${joinCode}`);
    } catch (error) {
      console.error('Failed to connect to peer:', error);
      toast.error('Failed to connect to canvas');
    }
  }, [peer, setupConnection]);
  
  // Disconnect from peers
  const disconnect = useCallback(() => {
    connections.forEach(conn => conn.close());
    setConnections([]);
    setIsConnected(false);
    toast.info('Disconnected from all peers');
  }, [connections]);
  
  // Send message to all connected peers
  const sendMessage = useCallback((message: Message) => {
    if (connections.length === 0) return;
    
    console.log('Sending message to all peers:', message);
    
    connections.forEach(conn => {
      if (conn.open) {
        conn.send({
          ...message,
          sender: peerId,
          timestamp: Date.now()
        });
      }
    });
  }, [connections, peerId]);
  
  // Context value
  const value = {
    connect,
    disconnect,
    sendMessage,
    registerHandler,
    peerId,
    isConnected,
    isPeerInitialized,
    connections
  };
  
  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Hook to use the WebSocket context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
