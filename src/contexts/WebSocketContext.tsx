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
  generateShareLink: () => string;
  generateQRCode: () => string;
  initializePeer: () => Promise<string>;
};

type WebSocketProviderProps = {
  children: ReactNode;
};

// Create context
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Get peer server config based on environment
const getPeerServerConfig = () => {
  // First try with direct peer connection options (local discovery)
  return {
    host: 'localhost', // This will be ignored for direct connections
    port: 9000,
    path: '/peerjs',
    debug: 0, // Reduced debug level
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
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
  const [peerInitializationPromise, setPeerInitializationPromise] = useState<Promise<string> | null>(null);
  
  const { user } = useAuth();
  
  // Clean up peer on unmount
  useEffect(() => {
    return () => {
      if (peer) {
        console.log('Cleaning up peer on component unmount');
        peer.destroy();
        setPeer(null);
        setPeerId(null);
        setIsPeerInitialized(false);
        setConnections([]);
      }
    };
  }, [peer]);
  
  // Initialize peer - now a function that gets called explicitly
  const initializePeer = useCallback(async (): Promise<string> => {
    // If already initializing, return the existing promise
    if (peerInitializationPromise) {
      return peerInitializationPromise;
    }
    
    // If peer already initialized, just return the ID
    if (isPeerInitialized && peer && peerId) {
      return peerId;
    }
    
    // Clean up any existing peer before creating a new one
    if (peer) {
      console.log('Cleaning up existing peer before initializing a new one');
      peer.destroy();
      setPeer(null);
      setPeerId(null);
      setIsPeerInitialized(false);
    }
    
    setIsReconnecting(true);
    
    // Create a new promise for peer initialization
    const promise = new Promise<string>((resolve, reject) => {
      try {
        const peerConfig = getPeerServerConfig();
        console.log('Initializing peer with config:', peerConfig);
        
        // Create a peer object without a server connection first
        // This will allow for direct WebRTC connections without a server
        const newPeer = new Peer(undefined, {
          ...peerConfig,
          host: window.location.hostname, // Use the current hostname
          port: window.location.protocol === 'https:' ? 443 : 80, // Use standard ports
          path: '/peerjs',
          secure: window.location.protocol === 'https:',
        });
        
        // Set a timeout for initialization
        const initTimeout = setTimeout(() => {
          if (!isPeerInitialized) {
            console.error('Peer initialization timeout');
            newPeer.destroy();
            setIsReconnecting(false);
            setPeerInitializationPromise(null);
            reject(new Error('Peer initialization timeout'));
          }
        }, 30000);
        
        newPeer.on('open', (id) => {
          console.log('My peer ID is:', id);
          clearTimeout(initTimeout);
          setPeerId(id);
          setIsPeerInitialized(true);
          setReconnectAttempts(0);
          setIsReconnecting(false);
          setPeer(newPeer);
          setPeerInitializationPromise(null);
          toast.success(`Connected to peer network with ID: ${id.substring(0, 6)}...`);
          resolve(id);
        });
        
        newPeer.on('connection', (conn) => {
          console.log('Incoming connection:', conn);
          setupConnection(conn);
        });
        
        newPeer.on('error', (err) => {
          console.error('Peer connection error:', err);
          
          // Don't show errors during initialization or if server is unavailable
          if (!isReconnecting && err.type !== 'server-error') {
            toast.error(`Connection error: ${err.message || 'Failed to connect'}`);
          }
          
          // Only reject if this is a fatal error
          if (err.type !== 'server-error' && err.type !== 'network' && err.type !== 'disconnected') {
            setPeerInitializationPromise(null);
            reject(new Error(`Connection error: ${err.message || 'Failed to connect'}`));
          }
          
          // If we get a server error, try creating a peer without a server
          if (err.type === 'server-error' && !newPeer.destroyed) {
            console.log('Server unavailable, trying direct connection mode');
            // The peer is created without server connection already
            // Just let it keep trying with STUN servers
          }
        });
        
        newPeer.on('close', () => {
          console.log('Peer connection closed');
          setPeerId(null);
          setIsPeerInitialized(false);
          setPeer(null);
          setPeerInitializationPromise(null);
        });
        
      } catch (error) {
        console.error('Failed to initialize peer:', error);
        setIsReconnecting(false);
        setPeerInitializationPromise(null);
        reject(error);
      }
    });
    
    // Store the promise
    setPeerInitializationPromise(promise);
    
    return promise;
  }, [peer, isPeerInitialized, peerId, isReconnecting, peerInitializationPromise]);
  
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
  const connect = useCallback(async (joinCode: string) => {
    if (!joinCode) {
      console.error('Cannot connect: joinCode is missing');
      toast.error('Cannot connect: no join code provided');
      return;
    }
    
    try {
      // First make sure peer is initialized
      if (!isPeerInitialized || !peer) {
        try {
          const id = await initializePeer();
          console.log('Peer initialized with ID:', id);
        } catch (error) {
          console.error('Failed to initialize peer:', error);
          toast.error('Failed to initialize peer connection');
          return;
        }
      }
      
      if (!peer) {
        console.error('Cannot connect: peer is still missing after initialization');
        toast.error('Cannot connect: peer connection not initialized');
        return;
      }
      
      console.log('Connecting to peer:', joinCode);
      
      // Connect to the remote peer
      const conn = peer.connect(joinCode, { 
        reliable: true,
        // Add serialization: 'json' for better data handling
        serialization: 'json',
      });
      
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
      }, 15000);
      
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
  }, [peer, setupConnection, isConnected, isPeerInitialized, initializePeer]);
  
  // Disconnect from peers
  const disconnect = useCallback(() => {
    connections.forEach(conn => {
      if (conn && conn.close) {
        try {
          conn.close();
        } catch (e) {
          console.error('Error closing connection:', e);
        }
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
  
  // Generate share link for the canvas
  const generateShareLink = useCallback(() => {
    if (!peerId) return '';
    
    const baseUrl = window.location.origin;
    return `${baseUrl}/join?code=${peerId}`;
  }, [peerId]);
  
  // Generate QR code for the share link
  const generateQRCode = useCallback(() => {
    if (!peerId) return '';
    
    const shareLink = generateShareLink();
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shareLink)}&size=200x200`;
  }, [peerId, generateShareLink]);
  
  // Context value
  const value: WebSocketContextType = {
    connect,
    disconnect,
    sendMessage,
    registerHandler,
    peerId,
    isConnected,
    isPeerInitialized,
    connections,
    generateShareLink,
    generateQRCode,
    initializePeer
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
