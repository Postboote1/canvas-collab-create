
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { useCanvas } from './CanvasContext';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

// Types
type WebSocketContextType = {
  connect: (joinCode: string) => void;
  disconnect: () => void;
  peerId: string | null;
  isConnected: boolean;
  isPeerInitialized: boolean;
  sendCanvasUpdate: (data: any) => void;
  connections: DataConnection[];
};

type WebSocketProviderProps = {
  children: ReactNode;
};

// Create context
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Get peer server URL based on environment
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
  
  const { setCanvasData, canvasData, currentCanvas } = useCanvas();
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
  
  // Configure new connection
  const setupConnection = useCallback((conn: DataConnection) => {
    conn.on('open', () => {
      console.log('Connection established with', conn.peer);
      setConnections(prev => [...prev.filter(c => c.peer !== conn.peer), conn]);
      
      // Send current canvas data when a new peer connects
      if (canvasData && Object.keys(canvasData).length > 0) {
        conn.send({
          type: 'full_canvas',
          data: canvasData
        });
      }
    });
    
    conn.on('data', (data: any) => {
      console.log('Received data:', data);
      if (data.type === 'canvas_update') {
        setCanvasData(data.data);
      } else if (data.type === 'full_canvas') {
        setCanvasData(data.data);
      }
    });
    
    conn.on('close', () => {
      console.log('Connection closed with', conn.peer);
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
      toast.info(`Peer ${conn.peer} disconnected`);
    });
    
    conn.on('error', (err) => {
      console.error('Connection error:', err);
      toast.error(`Connection error with peer ${conn.peer}`);
    });
  }, [canvasData, setCanvasData]);
  
  // Connect to another peer
  const connect = useCallback((joinCode: string) => {
    if (!peer || !joinCode) return;
    
    try {
      console.log('Connecting to peer:', joinCode);
      const conn = peer.connect(joinCode);
      setupConnection(conn);
      setIsConnected(true);
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
  
  // Send canvas updates to all connected peers
  const sendCanvasUpdate = useCallback((data: any) => {
    if (connections.length === 0) return;
    
    const updateData = {
      type: 'canvas_update',
      data: data,
      sender: peerId,
      timestamp: Date.now()
    };
    
    connections.forEach(conn => {
      if (conn.open) {
        conn.send(updateData);
      }
    });
  }, [connections, peerId]);
  
  // Context value
  const value = {
    connect,
    disconnect,
    peerId,
    isConnected,
    isPeerInitialized,
    sendCanvasUpdate,
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
