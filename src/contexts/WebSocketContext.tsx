
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
  registerHandler: (type: string, handler: MessageHandler) => () => void;
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
      secure: protocol === 'https',
      debug: 1 // Reduced debug level
    };
  }
  
  // In development, use localhost:9001
  return {
    host: 'localhost',
    port: 9001,
    path: '/peerjs',
    debug: 1 // Reduced debug level
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
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const { user } = useAuth();
  
  // Initialize peer
  useEffect(() => {
    let reconnectTimer: number | undefined;
    
    const initPeer = () => {
      // Clean up any existing peer before creating a new one
      if (peer) {
        console.log('Cleaning up existing peer before initializing a new one');
        peer.destroy();
      }

      setIsReconnecting(true);
      
      try {
        console.log('Initializing peer with config:', getPeerServerConfig());
        const newPeer = new Peer(undefined, getPeerServerConfig());
        
        newPeer.on('open', (id) => {
          console.log('My peer ID is:', id);
          setPeerId(id);
          setIsPeerInitialized(true);
          setReconnectAttempts(0);
          setIsReconnecting(false);
          toast.success(`Connected to peer network with ID: ${id.substring(0, 6)}...`);
        });
        
        newPeer.on('connection', (conn) => {
          console.log('Incoming connection:', conn);
          setupConnection(conn);
        });
        
        newPeer.on('error', (err) => {
          console.error('Peer connection error:', err);
          
          // Handle specific error types
          if (err.type === 'disconnected' || err.type === 'network' || err.type === 'server-error') {
            toast.error(`Connection error: ${err.message}.`);
            setPeerId(null);
            setIsPeerInitialized(false);
            
            // Only try to reconnect if we're not already in the process
            if (!isReconnecting && reconnectAttempts < 5) {
              setIsReconnecting(true);
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
              console.log(`Attempting to reconnect in ${delay}ms`);
              
              if (reconnectTimer) {
                window.clearTimeout(reconnectTimer);
              }
              
              reconnectTimer = window.setTimeout(() => {
                setReconnectAttempts(prev => prev + 1);
                newPeer.destroy();
                setPeer(null); // Clear the peer state completely
                initPeer(); // Re-initialize
              }, delay);
            } else if (reconnectAttempts >= 5) {
              toast.error('Failed to connect after multiple attempts. Please try again later.');
              setIsReconnecting(false);
            }
          } else {
            toast.error(`Connection error: ${err.message}`);
          }
        });
        
        setPeer(newPeer);
      } catch (error) {
        console.error('Failed to initialize peer:', error);
        toast.error('Failed to initialize peer connection');
        setIsReconnecting(false);
      }
    };
    
    // Initialize peer when component mounts, if it doesn't exist already
    if (!peer && !isReconnecting) {
      initPeer();
    }
    
    return () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      
      if (peer) {
        // Proper cleanup on unmount
        console.log('Cleaning up peer on component unmount');
        peer.destroy();
        setPeer(null);
        setPeerId(null);
        setIsPeerInitialized(false);
        setConnections([]);
      }
    };
  }, [peer, reconnectAttempts, isReconnecting]);
  
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
    if (!conn) {
      console.error('Connection is null or undefined');
      return;
    }
    
    conn.on('open', () => {
      console.log('Connection established with', conn.peer);
      setConnections(prev => [...prev.filter(c => c.peer !== conn.peer), conn]);
      setIsConnected(true);
      toast.success(`Connected to peer: ${conn.peer.substring(0, 6)}...`);
    });
    
    conn.on('data', (data: any) => {
      console.log('Received data:', data);
      if (data && data.type) {
        handleMessage(data.type, data.payload);
      }
    });
    
    conn.on('close', () => {
      console.log('Connection closed with', conn.peer);
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
      toast.info(`Peer ${conn.peer.substring(0, 6)}... disconnected`);
      
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
      toast.error(`Connection error with peer ${conn.peer.substring(0, 6)}...`);
    });
  }, [handleMessage]);
  
  // Connect to another peer
  const connect = useCallback((joinCode: string) => {
    if (!peer || !joinCode || !isPeerInitialized) {
      console.error('Cannot connect: peer or joinCode is missing or peer not initialized', { peer, joinCode, isPeerInitialized });
      toast.error('Cannot connect: peer connection not initialized');
      return;
    }
    
    try {
      console.log('Connecting to peer:', joinCode);
      const conn = peer.connect(joinCode, { reliable: true });
      
      if (!conn) {
        console.error('Failed to create connection');
        toast.error('Failed to connect to canvas');
        return;
      }
      
      // Add timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (!isConnected) {
          console.error('Connection timeout');
          toast.error('Connection timeout. Please try again.');
        }
      }, 10000);
      
      conn.on('open', () => {
        clearTimeout(connectionTimeout);
        setupConnection(conn);
      });
      
      conn.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error('Connection error:', err);
        toast.error('Failed to connect to canvas');
      });
      
      toast.success(`Connecting to canvas with peer ID: ${joinCode.substring(0, 6)}...`);
    } catch (error) {
      console.error('Failed to connect to peer:', error);
      toast.error('Failed to connect to canvas');
    }
  }, [peer, setupConnection, isConnected, isPeerInitialized]);
  
  // Disconnect from peers
  const disconnect = useCallback(() => {
    connections.forEach(conn => {
      if (conn && conn.close) {
        conn.close();
      }
    });
    setConnections([]);
    setIsConnected(false);
    toast.info('Disconnected from all peers');
  }, [connections]);
  
  // Send message to all connected peers
  const sendMessage = useCallback((message: Message) => {
    if (connections.length === 0) return;
    
    console.log('Sending message to all peers:', message);
    
    connections.forEach(conn => {
      if (conn && conn.open) {
        try {
          conn.send({
            ...message,
            sender: peerId,
            timestamp: Date.now()
          });
        } catch (error) {
          console.error('Error sending message to peer:', error);
        }
      }
    });
  }, [connections, peerId]);
  
  // Context value
  const value: WebSocketContextType = {
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
