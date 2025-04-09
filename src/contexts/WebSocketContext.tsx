import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef, useMemo } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { useCanvas } from './CanvasContext';

// Types
interface MessageHandler {
  (payload: any): void;
}

interface MessageHandlers {
  [key: string]: MessageHandler[];
}

interface Message {
  type: string;
  payload: any;
}

export interface WebSocketContextType {
  peerId: string | null;
  isConnected: boolean;
  isPeerInitialized: boolean;
  connections: DataConnection[];
  connect: (joinCode: string) => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: Message) => void;
  registerHandler: (type: string, handler: MessageHandler) => () => void;
  generateShareLink: () => string;
  generateQRCode: () => string;
  initializePeer: () => Promise<string>;
  syncComplete: boolean; // Add this line
}

type WebSocketProviderProps = {
  children: ReactNode;
};

// Create context
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Provider component
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State variables
  const [peer, setPeer] = useState<Peer | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isPeerInitialized, setIsPeerInitialized] = useState(false);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [messageHandlers, setMessageHandlers] = useState<MessageHandlers>({});
  const [peerInitializationPromise, setPeerInitializationPromise] = useState<Promise<string> | null>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const [canvasStateSynced, setCanvasStateSynced] = useState(false);
  const MAX_RECONNECT_ATTEMPTS = 3;
  
  const { user } = useAuth();
  
  // Add persistent peer reference
  const peerRef = useRef<Peer | null>(null);

  // 1. Move useCanvas inside useEffect
  const [canvasContext, setCanvasContext] = useState<{ currentCanvas: any, setCurrentCanvas: any } | null>(null);

  useEffect(() => {
    // 1. Get both currentCanvas and setCurrentCanvas from CanvasContext
    try {
      const canvasValues = useCanvas();
      setCanvasContext(canvasValues);
    } catch (error) {
      console.error("Error getting CanvasContext:", error);
    }
  }, []);

  const currentCanvas = canvasContext?.currentCanvas;
  const setCurrentCanvas = canvasContext?.setCurrentCanvas;

  // Clean up peer on unmount
  useEffect(() => {
    return () => {
      // Only cleanup on full unmount, not navigation
      if (peer && window.location.pathname === '/') {
        console.log('Cleaning up peer on final unmount');
        peer.destroy();
        peerRef.current = null;
        setPeer(null);
        setPeerId(null);
        setIsPeerInitialized(false);
        setConnections([]);
      }
    };
  }, [peer]);
  
  // Register a handler for a specific message type
  const registerHandler = useCallback((type: string, handler: MessageHandler) => {
    console.log('Registering handler for:', type);
    setMessageHandlers(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), handler]
    }));

    return () => {
      setMessageHandlers(prev => ({
        ...prev,
        [type]: prev[type]?.filter(h => h !== handler) || []
      }));
    };
  }, []);
  
  // Handle messages by type
  const handleMessage = useCallback((type: string, payload: any) => {
    if (messageHandlers[type]) {
      messageHandlers[type].forEach(handler => handler(payload));
    }
  }, [messageHandlers]);

  // Configure new connection
  const setupConnection = useCallback((conn: DataConnection) => {
    if (!conn) {
      console.error('Connection is null or undefined');
      return;
    }

    console.log('Setting up connection with peer:', conn.peer);

    // Add connection to state immediately
    setConnections(prev => [...prev.filter(c => c.peer !== conn.peer), conn]);

    conn.on('open', () => {
      console.log('Connection opened with peer:', conn.peer);
      setIsConnected(true);
      
      // Request canvas state immediately after connection
      const message = {
        type: 'requestCanvasState',
        payload: null,
        sender: peerId,
        timestamp: Date.now()
      };
      console.log('Sending canvas state request:', message);
      conn.send(message);
      
      toast.success(`Connected to peer: ${conn.peer.substring(0, 6)}...`);
    });

    conn.on('data', (data: any) => {
      console.log('Received data:', data);
      if (data?.type) {
        handleMessage(data.type, data.payload);
      }
    });

    conn.on('close', () => {
      console.log('Connection closed with peer:', conn.peer);
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
      if (connections.length <= 1) {
        setIsConnected(false);
      }
      setSyncComplete(false);
    });

  }, [handleMessage, peerId, connections, registerHandler]);

  // Initialize peer with proper state management
  const initializePeer = useCallback(async (): Promise<string> => {
    if (peerInitializationPromise) {
      return peerInitializationPromise;
    }
  
    const promise = new Promise<string>((resolve, reject) => {
      try {
        // Clear existing peer if it exists
        if (peer) {
          peer.destroy();
          setPeer(null);
          setPeerId(null);
          setIsPeerInitialized(false);
        }

        const newPeer = new Peer(undefined, {
          host: '192.168.178.90',
          port: 9000,
          path: '/',
          debug: 3,
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });
  
        newPeer.on('open', (id) => {
          console.log('Peer successfully initialized with ID:', id);
          peerRef.current = newPeer;
          setPeer(newPeer); // Ensure peer is set
          setPeerId(id);
          setIsPeerInitialized(true);
          resolve(id);
        });
  
        newPeer.on('error', (error) => {
          console.error('Peer error:', error);
          reject(error);
        });
  
        newPeer.on('disconnected', () => {
          console.log('Peer disconnected, attempting to reconnect');
          if (!newPeer.destroyed) {
            newPeer.reconnect();
          }
        });
  
        newPeer.on('connection', (conn) => {
          console.log('Incoming connection from', conn.peer);
          setupConnection(conn);
        });
      } catch (error) {
        console.error('Peer initialization error:', error);
        reject(error);
      }
    });
  
    setPeerInitializationPromise(promise);
    return promise;
  }, [setupConnection, peer]);

  const handleReconnect = useCallback((peer: Peer) => {
    setIsReconnecting(true);
    const backoffTime = Math.min(1000 * Math.pow(2, connectionAttempts), 10000);
    
    setTimeout(() => {
      setConnectionAttempts(prev => prev + 1);
      peer.reconnect();
    }, backoffTime);
  }, [connectionAttempts]);
  
  // Connect to another peer
  const connect = useCallback(async (joinCode: string): Promise<void> => {
    if (!joinCode) {
      toast.error('No join code provided');
      return;
    }
  
    try {
      if (!isPeerInitialized || !peerRef.current || peerRef.current.destroyed) {
        await initializePeer();
      }
  
      if (!peerRef.current) {
        throw new Error('Failed to initialize peer connection');
      }
  
      const conn = peerRef.current.connect(joinCode, {
        reliable: true,
        metadata: { userId: user?.id }
      });
  
      if (!conn) {
        throw new Error('Failed to create connection');
      }
  
      await new Promise<void>((resolve, reject) => {
        const connectionTimeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 15000);
  
        const handleOpen = () => {
          clearTimeout(connectionTimeout);
          console.log('Connection established, setting up connection');
          setupConnection(conn);
          
          const waitForSync = () => {
            if (canvasStateSynced) {
              clearTimeout(connectionTimeout);
              resolve();
            } else {
              setTimeout(waitForSync, 100);
            }
          };
          
          waitForSync();
        };
  
        const handleError = (err: Error) => {
          clearTimeout(connectionTimeout);
          console.error('Connection error:', err);
          reject(err);
        };
  
        conn.on('open', handleOpen);
        conn.on('error', handleError);
  
        // Cleanup listeners if connection fails
        return () => {
          conn.off('open', handleOpen);
          conn.off('error', handleError);
        };
      });
  
    } catch (error) {
      console.error('Connection failed:', error);
      toast.error('Failed to establish connection');
      throw error;
    }
  }, [peerRef, isPeerInitialized, initializePeer, setupConnection, user, canvasStateSynced]);
  
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

  useEffect(() => {
    return () => {
      // Remove peer teardown to keep peer alive across navigation
      // disconnect();
      // peer.destroy();
      // setPeer(null);
      // setPeerId(null);
      // setIsPeerInitialized(false);
      // setConnectionAttempts(0);
      // setIsReconnecting(false);
    };
  }, [peer]);
  
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
  
  // 3. Update dependencies in contextValue
  const contextValue = useMemo(() => ({
    peerId,
    isConnected,
    isPeerInitialized,
    connections,
    connect,
    disconnect,
    sendMessage,
    registerHandler,
    generateShareLink,
    generateQRCode,
    initializePeer,
    syncComplete: canvasStateSynced
  }), [
    peerId,
    isConnected,
    isPeerInitialized,
    connections,
    connect,
    disconnect,
    sendMessage,
    registerHandler,
    generateShareLink,
    generateQRCode,
    initializePeer,
    canvasStateSynced
  ]);

  // 2. Update useEffect with proper currentCanvas access
  useEffect(() => {
    if (!registerHandler) return;

    const unregisterRequestState = registerHandler('requestCanvasState', () => {
      if (!currentCanvas || !sendMessage) return;
      
      // Send canvas state to requesting peer
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

    const unregisterCanvasState = registerHandler('canvasState', (payload) => {
      console.log('Received canvas state:', payload);
      if (!payload) return;

      // Update canvas with received state
      setCurrentCanvas({
        id: payload.id,
        name: payload.name || 'Shared Canvas',
        elements: payload.elements || [],
        createdBy: 'shared',
        createdAt: new Date().toISOString(),
        joinCode: '',
        isInfinite: payload.isInfinite || true
      });

      setCanvasStateSynced(true);
      toast.success('Canvas synced successfully');
    });

    return () => {
      unregisterCanvasState();
      unregisterRequestState();
    };
  }, [registerHandler, sendMessage, currentCanvas, setCurrentCanvas]);

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Hook to use the WebSocket context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  console.log('useWebSocket called, context:', context);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// Create a separate hook for canvas-websocket integration
export const useCanvasWebSocket = () => {
  const { currentCanvas, setCurrentCanvas } = useCanvas();
  const { registerHandler, sendMessage } = useWebSocket();

  useEffect(() => {
    if (!registerHandler) return;

    const unregisterCanvasState = registerHandler('canvasState', (payload) => {
      if (!payload) return;
      
      setCurrentCanvas({
        id: payload.id,
        name: payload.name || 'Shared Canvas',
        elements: payload.elements || [],
        createdBy: 'shared',
        createdAt: new Date().toISOString(),
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