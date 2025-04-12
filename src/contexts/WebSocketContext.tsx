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

declare global {
  interface Window {
    processedElementIDs?: Set<string>;
  }
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
  syncComplete: boolean;
  currentWebSocketCanvas: any;
  setWebSocketCanvasState: (canvas: any) => void;
}

type WebSocketProviderProps = {
  children: ReactNode;
};

// Create context
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// Define initializePeerFunc outside of the component to break the dependency cycle
const initializePeerFunc = (
  peer: Peer | null,
  setPeer: React.Dispatch<React.SetStateAction<Peer | null>>,
  peerRef: React.MutableRefObject<Peer | null>,
  setPeerId: React.Dispatch<React.SetStateAction<string | null>>,
  setIsPeerInitialized: React.Dispatch<React.SetStateAction<boolean>>,
  setConnectionAttempts: React.Dispatch<React.SetStateAction<number>>,
  handleReconnect: (peerInstance: Peer) => void,
  setupConnection: (conn: DataConnection) => DataConnection,
  toast: any
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    try {
      // Clear existing peer if it exists
      if (peer) {
        peer.destroy();
      }
      
      // Create a more robust configuration with more STUN/TURN servers
      const newPeer = new Peer(undefined, {
        host: '192.168.178.102',
        port: 9000,
        path: '/',
        debug: 1, // Lower debug level to reduce console noise
        secure: false,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            // Add these public TURN servers for better NAT traversal
            {
              urls: 'turn:openrelay.metered.ca:80',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            },
            {
              urls: 'turn:openrelay.metered.ca:443',
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ],
          iceCandidatePoolSize: 10
        },
        pingInterval: 3000, // More frequent ping to detect disconnections faster
        
      });

      // Add timeout to handle initialization failure
      const initTimeout = setTimeout(() => {
        reject(new Error('Peer initialization timeout'));
      }, 10000);

      newPeer.on('open', (id) => {
        clearTimeout(initTimeout);
        console.log('Peer successfully initialized with ID:', id);
        peerRef.current = newPeer;
        setPeer(newPeer);
        setPeerId(id);
        setIsPeerInitialized(true);
        setConnectionAttempts(0);
        resolve(id);
      });

      newPeer.on('error', (error) => {
        console.error('Peer error:', error);
        
        if (error.type === 'peer-unavailable') {
          toast.error('Peer not available. Please check the connection code.');
        } else if (error.type === 'network') {
          toast.error('Network error. Please check your internet connection.');
          handleReconnect(newPeer);
        } else if (error.type === 'server-error') {
          toast.error('Server error. Please try again later.');
        } else {
          toast.error('Connection error. Please try again.');
        }
        
        reject(error);
      });

      newPeer.on('disconnected', () => {
        console.log('Peer disconnected, attempting to reconnect');
        toast.warning('Connection lost. Attempting to reconnect...');
        
        if (!newPeer.destroyed) {
          setTimeout(() => {
            try {
              newPeer.reconnect();
            } catch (e) {
              console.error("Error during reconnect:", e);
              handleReconnect(newPeer);
            }
          }, 1000);
        }
      });

      newPeer.on('connection', (conn) => {
        console.log('Incoming connection from', conn.peer);
        setupConnection(conn);
      });

      // Add a reconnection handler for the PeerJS server
      newPeer.on('disconnected', () => {
        console.log('PeerJS disconnected from server, attempting to reconnect');
        
        // Try to reconnect automatically
        setTimeout(() => {
          if (!newPeer.destroyed) {
            console.log('Attempting to reconnect to PeerJS server...');
            newPeer.reconnect();
          }
        }, 1000);
      });
      
    } catch (error) {
      console.error('Peer initialization error:', error);
      reject(error);
    }
  });
};

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
  const { user } = useAuth();
  
  // Add persistent peer reference
  const peerRef = useRef<Peer | null>(null);
  const processedElementIDs = useRef<Set<string>>(new Set());
  const processedOperations = useRef<Set<string>>(new Set());
  const addedElementIds = useRef<Set<string>>(new Set());
  const [currentCanvas, setCurrentCanvas] = useState<any>(null);

  // DON'T use useCanvas here - it creates a circular dependency
  // Instead, use a context bridge pattern to access canvas data when needed
  
  // useEffect(() => {
  //   try {
  //     const canvasValues = useCanvas();
  //     setCanvasContext(canvasValues);
  //   } catch (error) {
  //     console.error("Error getting CanvasContext:", error);
  //   }
  // }, []);
  
  // Remove these lines
  // const currentCanvas = canvasContext?.currentCanvas;
  // const setCurrentCanvas = canvasContext?.setCurrentCanvas;

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

  useEffect(() => {
    // Initialize a global element registry in localStorage if it doesn't exist
    if (!localStorage.getItem('globalElementRegistry')) {
      localStorage.setItem('globalElementRegistry', JSON.stringify([]));
    }
  }, []);
  
  // Register a handler for a specific message type
  const registerHandler = useCallback((type: string, handler: MessageHandler) => {
    //console.log('Registering handler for:', type);
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
  
  // Create a reference for deduplication
  const processedMessages = useRef<Set<string>>(new Set());
  // Add another ref specifically for operations
  const processedOperationMessages = useRef<Set<string>>(new Set());

  // Update the handleMessage function
  const handleMessage = useCallback((type: string, payload: any) => {
    // Create a message ID based on content for deduplication
    const messageId = `${type}-${JSON.stringify(payload)?.slice(0, 50)}-${Date.now().toString().slice(-6)}`;
    
    // Skip if we've seen this message recently
    if (processedMessages.current.has(messageId)) {
      console.log('Skipping duplicate message:', type);
      return;
    }
    
    // Add to processed set and remove after a timeout
    processedMessages.current.add(messageId);
    setTimeout(() => {
      processedMessages.current.delete(messageId);
    }, 1000);
    
    console.log(`Processing message type: ${type} with ID: ${messageId}`);
    
    // Process the message
    if (messageHandlers[type]) {
      messageHandlers[type].forEach(handler => handler(payload));
    }
  }, [messageHandlers]);

  // Configure new connection
  const setupConnection = useCallback((conn: DataConnection) => {
    console.log('Setting up connection with peer:', conn.peer);
    
    // Store the connection for later use
    setConnections(prev => [...prev, conn]);
    
    // Listen for data from this connection
    conn.on('data', (data: any) => {
      try {
        // Simple ping-pong for connection maintenance
        if (data?.type === 'ping') {
          conn.send({ type: 'pong', timestamp: Date.now() });
          return;
        }
        
        if (data?.type === 'pong') {
          return;
        }
        
        console.log('Received data:', data);
        
        // CRITICAL FIX: Special direct handling for element updates
        if (data?.type === 'canvasOperation' && 
          data?.payload?.operation === 'update' && 
          data?.payload?.element?.id) {
        
        console.log('DIRECT UPDATE HANDLER: Applying position update for element:', data.payload.element.id);
        
        setCurrentCanvas(prevCanvas => {
          if (!prevCanvas) return prevCanvas;
          
          // Find and update the element with proper type conversion
          const updatedElements = prevCanvas.elements.map(el => 
            el.id === data.payload.element.id ? { 
              ...el, 
              // Always convert coordinates to numbers
              x: typeof data.payload.element.x === 'number' ? data.payload.element.x : 
                 (data.payload.element.x !== undefined ? Number(data.payload.element.x) : el.x),
              y: typeof data.payload.element.y === 'number' ? data.payload.element.y : 
                 (data.payload.element.y !== undefined ? Number(data.payload.element.y) : el.y),
              // Copy all other properties
              ...data.payload.element
            } : el
          );
          
          // Create new canvas state with updated elements
          const updatedCanvas = { ...prevCanvas, elements: updatedElements };
          
          // Save to localStorage
          try {
            localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
            console.log(`DIRECT UPDATE COMPLETE: Element ${data.payload.element.id} updated to x:${data.payload.element.x}, y:${data.payload.element.y}`);
            
            // CRITICAL FIX: Force reload from localStorage in CanvasPage
            // This ensures all components using the canvas state get updated
            window.dispatchEvent(new CustomEvent('canvas-update', { 
              detail: { elementId: data.payload.element.id }
            }));
            
          } catch (err) {
            console.error('Error updating localStorage:', err);
          }
          
          return updatedCanvas;
          });
        }
        
        // Continue with the existing message handler for other message types
        if (data && data.type) {
          handleMessage(data.type, data.payload);
        }
      } catch (error) {
        console.error('Error processing received data:', error);
      }
    });

    // Add opening and closing handlers
    conn.on('open', () => {
      console.log('Connection opened with peer:', conn.peer);
      setIsConnected(true);
      
      // Request canvas state when connection is established
      conn.send({
        type: 'requestCanvasState',
        sender: peerId,
        timestamp: Date.now()
      });
    });

    conn.on('close', () => {
      console.log('Connection closed with peer:', conn.peer);
      setConnections(prev => prev.filter(c => c !== conn));
      if (connections.length === 0) {
        setIsConnected(false);
      }
    });

    conn.on('error', (err) => {
      console.error('Connection error with peer:', conn.peer, err);
    });

    return conn;
  }, [setConnections, handleMessage, setCanvasStateSynced, setCurrentCanvas, connections]);

  // Now, handleReconnect doesn't depend on initializePeer
  const handleReconnect = useCallback((peerInstance: Peer) => {
    setIsReconnecting(true);
    
    // Get current attempts count (using a callback to ensure we have the latest value)
    setConnectionAttempts(currentAttempts => {
      const attemptNumber = currentAttempts + 1;
      
      // Calculate backoff based on the new attempt number
      const baseBackoff = 1000; // 1 second base
      const maxBackoff = 30000; // max 30 seconds
      const calculatedBackoff = Math.min(
        baseBackoff * Math.pow(1.5, currentAttempts),  // Use currentAttempts, not connectionAttempts
        maxBackoff
      );
      
      // Add jitter to prevent reconnection storms (±20%)
      const jitter = calculatedBackoff * (0.8 + Math.random() * 0.4);
      const backoffTime = Math.floor(jitter);
      
      console.log(`Reconnection attempt ${attemptNumber} in ${backoffTime}ms`);
      
      setTimeout(() => {
        // After too many attempts, try creating a new peer instead of reconnecting
        if (attemptNumber >= 3 && !peerInstance.destroyed) {
          console.log('Multiple reconnection attempts failed, creating new peer');
          peerInstance.destroy();
          setPeer(null);
          setPeerId(null);
          setIsPeerInitialized(false);
          setPeerInitializationPromise(null);
          
          // Call initialize peer with the extracted function
          const initNewPeerWithExtractedFunc = async () => {
            try {
              const id = await initializePeerFunc(
                null, // No existing peer
                setPeer, 
                peerRef, 
                setPeerId, 
                setIsPeerInitialized,
                setConnectionAttempts,
                handleReconnect,
                setupConnection,
                toast
              );
              
              // Set promise to null to allow future initialization
              setPeerInitializationPromise(null);
              setIsReconnecting(false);
            } catch (e) {
              console.error('Failed to create new peer after reconnection attempts:', e);
              toast.error('Connection failed. Please try again later.');
              setIsReconnecting(false);
              setPeerInitializationPromise(null);
            }
          };
          
          initNewPeerWithExtractedFunc();
        } else if (!peerInstance.destroyed) {
          try {
            console.log(`Attempting reconnection for peer ${peerInstance.id}`);
            peerInstance.reconnect();
          } catch (e) {
            console.error('Error during reconnect:', e);
            setIsReconnecting(false);
          }
        } else {
          console.log('Peer already destroyed, cannot reconnect');
          setIsReconnecting(false);
        }
      }, backoffTime);
      
      // Return the incremented attempt count
      return attemptNumber;
    });
  }, [peerRef, setPeer, setPeerId, setIsPeerInitialized, setupConnection]); // No dependency on initializePeer

  // Now update initializePeer to use the extracted function
  const initializePeer = useCallback(async (): Promise<string> => {
    if (peerInitializationPromise) {
      return peerInitializationPromise;
    }
    
    const newPromise = initializePeerFunc(
      peer,
      setPeer,
      peerRef,
      setPeerId,
      setIsPeerInitialized,
      setConnectionAttempts,
      handleReconnect,
      setupConnection,
      toast
    );
    
    // Store the promise in state
    setPeerInitializationPromise(newPromise);
    
    // Set up cleanup for the promise
    newPromise.finally(() => {
      setPeerInitializationPromise(prevPromise => 
        prevPromise === newPromise ? null : prevPromise
      );
    });
    
    // Add a timeout to reset the promise state if it fails
    setTimeout(() => {
      if (!isPeerInitialized) {
        console.log('Resetting peer initialization promise state due to timeout');
        setPeerInitializationPromise(prevPromise => 
          prevPromise === newPromise ? null : prevPromise
        );
      }
    }, 15000);
    
    return newPromise;
  }, [
    peer, 
    peerRef, 
    peerInitializationPromise, 
    handleReconnect, 
    setupConnection, 
    isPeerInitialized
  ]);

  // Connect to another peer
  const connect = useCallback(async (joinCode: string): Promise<void> => {
    if (!joinCode) {
      toast.error('No join code provided');
      return;
    }
  
    setIsLoading(true);
    localStorage.removeItem('pendingCanvasState'); // Clear any old canvas data
  
    try {
      if (!isPeerInitialized || !peerRef.current || peerRef.current.destroyed) {
        const peerId = await initializePeer();
        console.log('Peer initialized with ID:', peerId);
      }
  
      if (!peerRef.current) {
        throw new Error('Failed to initialize peer connection');
      }
  
      console.log(`Attempting to connect to peer: ${joinCode}`);
      const conn = peerRef.current.connect(joinCode, {
        reliable: true,
        metadata: { 
          userId: user?.id,
          timestamp: Date.now(),
          requestingCanvas: true // Flag to indicate we want the canvas
        }
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
          console.log('Connection established to peer:', joinCode);
          
          // Store the peer ID we're connecting to
          localStorage.setItem('joiningPeerId', joinCode);
          
          // Setup the connection after it's open
          const connObj = setupConnection(conn);
          
          // Request canvas state explicitly with a timeout for response
          console.log('Requesting canvas state from peer:', joinCode);
          connObj.send({
            type: 'requestCanvasState',
            payload: {},
            sender: peerId,
            timestamp: Date.now()
          });
          
          // Watch for canvas sync to complete
          const syncCheckInterval = setInterval(() => {
            // Check both the flag and localStorage for canvas data
            const hasPendingCanvas = localStorage.getItem('pendingCanvasState') !== null;
            
            if (canvasStateSynced || hasPendingCanvas) {
              clearInterval(syncCheckInterval);
              console.log('Canvas sync completed successfully');
              resolve();
            }
          }, 500);
          
          // Set a more reasonable timeout
          setTimeout(() => {
            clearInterval(syncCheckInterval);
            
            // Check if we have canvas data in localStorage as fallback
            const hasPendingCanvas = localStorage.getItem('pendingCanvasState') !== null;
            if (hasPendingCanvas) {
              console.log('Using pending canvas from localStorage');
              setCanvasStateSynced(true); // Set this flag to true
              resolve();
            } else {
              // If still no data, use default canvas
              console.log('Canvas sync timed out, using default canvas');
              const defaultCanvas = {
                id: `shared-${Date.now()}`,
                name: 'Shared Canvas',
                elements: [],
                createdBy: 'shared',
                createdAt: new Date().toISOString(),
                joinCode: '',
                isInfinite: true
              };
              
              localStorage.setItem('pendingCanvasState', JSON.stringify(defaultCanvas));
              setCanvasStateSynced(true);
              resolve();
            }
          }, 12000); // Wait 12 seconds before falling back
        };
  
        conn.on('open', handleOpen);
        
        conn.on('error', (err: any) => {
          clearTimeout(connectionTimeout);
          console.error('Connection error:', err);
          reject(err);
        });
      });
      
      // Connection and sync completed successfully
      setIsConnected(true);
  
      return; // Just return successfully
    } catch (error) {
      console.error('Connection failed:', error);
      toast.error('Failed to establish connection');
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isPeerInitialized, initializePeer, peerRef, peerId, setupConnection, user, canvasStateSynced]);
  
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
    console.log('Sending message to all peers:', message);

    // For canvas operations, make sure to process them locally as well
    if (message.type === 'canvasOperation' && message.payload) {
      console.log('Processing canvas operation locally before sending to peers:', message.payload);
      
      // Add sender ID to track origin
      const payloadWithSender = {
        ...message.payload,
        sender: peerId  // Add sender ID to identify origin
      };
      
      // Process the operation locally first
      if (currentCanvas && message.payload.operation === 'add' && message.payload.element) {
        if (message.payload.operation === 'add' && message.payload.element) {
          // Ensure the element has an ID
          if (!message.payload.element.id) {
            message.payload.element.id = `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          }
          
          // Mark this element as processed locally BEFORE processing
          const elementId = message.payload.element.id;
          addedElementIds.current.add(elementId);
          
          // Also add to global registry
          const registry = JSON.parse(localStorage.getItem('globalElementRegistry') || '[]');
          if (!registry.includes(elementId)) {
            registry.push(elementId);
            localStorage.setItem('globalElementRegistry', JSON.stringify(registry));
          }
        }
        
        // Add source identification
        const payloadWithSource = {
          ...message.payload,
          source: 'local',
          deviceId: peerId
        };
        
        handleMessage('canvasUpdate', payloadWithSource);
      } 
      else if (currentCanvas && message.payload.operation === 'update' && message.payload.element && message.payload.element.id) {
        try {
          // Make a deep copy to avoid mutation issues
          const updatedCanvas = JSON.parse(JSON.stringify(currentCanvas));
          
          // Find and update the element
          const index = updatedCanvas.elements.findIndex((el) => el.id === message.payload.element.id);
          if (index !== -1) {
            // Start with the original element
            const updatedElement = { ...updatedCanvas.elements[index] };
            
            // Apply only defined properties
            Object.entries(message.payload.element).forEach(([key, value]) => {
              // Skip ID and undefined/null values
              if (key === 'id' || value === undefined || value === null) return;
              
              // Handle numeric values properly
              if (['x', 'y', 'width', 'height'].includes(key)) {
                updatedElement[key] = typeof value === 'number' ? value : Number(value);
              } else {
                updatedElement[key] = value;
              }
            });
            
            // Replace with our updated version
            updatedCanvas.elements[index] = updatedElement;
            console.log(`Local update: Updated element ${message.payload.element.id} directly in canvas`);
            
            // Update the canvas state and localStorage
            setCurrentCanvas(updatedCanvas);
            localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
          }
        } catch (error) {
          console.error('Error processing local update operation:', error);
        }
      }
      else if (currentCanvas && message.payload.operation === 'delete' && message.payload.elementId) {
        try {
          // Make a deep copy to avoid mutation issues
          const updatedCanvas = JSON.parse(JSON.stringify(currentCanvas));
          
          // Filter out the deleted element
          updatedCanvas.elements = updatedCanvas.elements.filter((el: any) => el.id !== message.payload.elementId);
          console.log(`Local delete: Deleted element ${message.payload.elementId} directly from canvas`);
          
          // Update the canvas state with our modified copy
          setCurrentCanvas(updatedCanvas);
          
          // Also update localStorage for persistence
          localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
        } catch (error) {
          console.error('Error processing local delete operation:', error);
        }
      }
      
      // Forward to local handlers to ensure immediate local update
      handleMessage('canvasUpdate', payloadWithSender);
    }

    // If no connections, just log and return after local processing
    if (connections.length === 0) {
      console.warn('No active connections to send message to');
      return;
    }

    // Send to all open connections
    connections.forEach(conn => {
      if (conn && conn.open) {
        try {
          // Add sender ID and timestamp
          const messageWithMeta = {
            ...message,
            sender: peerId,
            timestamp: Date.now()
          };
          
          conn.send(messageWithMeta);
        } catch (error) {
          console.error('Error sending message to peer:', error);
        }
      }
    });
  }, [connections, handleMessage, peerId, currentCanvas, setCurrentCanvas]);
  
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
    syncComplete: canvasStateSynced,
    // Add the canvas state setter to allow updating from connection
    setWebSocketCanvasState: setCurrentCanvas,
    currentWebSocketCanvas: currentCanvas
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
    canvasStateSynced,
    currentCanvas,
    setCurrentCanvas
  ]);

  // 2. Update useEffect with proper currentCanvas access
  useEffect(() => {
    if (!registerHandler || !sendMessage) return;

    // 1. Update the requestCanvasState handler to correctly send the current canvas with elements
    const unregisterRequestState = registerHandler('requestCanvasState', (payload) => {
      console.log('Received request for canvas state:', payload);
      
      // First check localStorage for any canvas data to share
      let canvasToSend = null;
      
      try {
        // Try to get canvas from current context - this should have the most up-to-date content
        if (currentCanvas) {
          console.log('Sending current canvas from context:', currentCanvas);
          // Deep clone the canvas to avoid reference issues
          canvasToSend = JSON.parse(JSON.stringify(currentCanvas));
        } else {
          // Try to get canvas from local storage as fallback
          const savedCanvases = localStorage.getItem('global_canvases');
          if (savedCanvases) {
            const allCanvases = JSON.parse(savedCanvases);
            if (Array.isArray(allCanvases) && allCanvases.length > 0) {
              // Get the most recent canvas
              canvasToSend = JSON.parse(JSON.stringify(allCanvases[allCanvases.length - 1]));
              console.log('Sending canvas from localStorage:', canvasToSend);
            }
          }
        }
      } catch (err) {
        console.error('Error getting canvas data to share:', err);
      }
    
      // Important: If we still don't have a canvas, create a default one
      if (!canvasToSend) {
        console.log('No canvas available, sending default canvas');
        canvasToSend = {
          id: `shared-${Date.now()}`,
          name: 'Shared Canvas',
          elements: [],
          createdBy: 'shared',
          createdAt: new Date().toISOString(),
          joinCode: '',
          isInfinite: true
        };
      }
      
      console.log('Sending canvas state to peer:', canvasToSend);
      
      // Find the connection that sent this request
      const requestingConn = connections.find(conn => 
        conn && conn.peer === (payload?.sender || '')
      );
      
      if (requestingConn && requestingConn.open) {
        requestingConn.send({
          type: 'canvasState',
          payload: canvasToSend,
          sender: peerId,
          timestamp: Date.now()
        });
      } else {
        // Fallback - send to all connections
        console.log('Sending canvas state to all connections');
        connections.forEach(conn => {
          if (conn && conn.open) {
            conn.send({
              type: 'canvasState',
              payload: canvasToSend,
              sender: peerId,
              timestamp: Date.now()
            });
          }
        });
      }
    });

    const unregisterCanvasState = registerHandler('canvasState', (payload) => {
      console.log('Received canvas state:', payload);
      
      if (!payload) {
        console.error('Received empty canvas state');
        return;
      }
      
      try {
        // Ensure we have all elements with proper coordinates
        const elements = Array.isArray(payload.elements) ? payload.elements.map(element => ({
          ...element,
          x: typeof element.x === 'number' ? element.x : 0,
          y: typeof element.y === 'number' ? element.y : 0,
          id: element.id || `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        })) : [];
        
        // Create a valid canvas object from the payload
        const canvasData = {
          id: payload.id || `shared-${Date.now()}`,
          name: payload.name || 'Shared Canvas',
          elements: elements,
          createdBy: payload.createdBy || 'shared',
          createdAt: payload.createdAt || new Date().toISOString(),
          joinCode: payload.joinCode || '',
          isInfinite: payload.isInfinite === undefined ? true : payload.isInfinite
        };
        
        console.log('Saving received canvas state with elements:', elements.length);
        
        // First check if we already have a canvas state with elements
        const pendingCanvas = localStorage.getItem('pendingCanvasState');
        if (pendingCanvas) {
          try {
            const existingCanvas = JSON.parse(pendingCanvas);
            if (existingCanvas && existingCanvas.elements && existingCanvas.elements.length > 0) {
              console.log('Merging with existing canvas that has', existingCanvas.elements.length, 'elements');
              
              // Keep existing canvas settings but merge the elements
              // Use a Set of IDs to avoid duplicates
              const elementIds = new Set();
              const mergedElements = [];
              
              // Add existing elements first
              for (const el of existingCanvas.elements) {
                if (el.id && !elementIds.has(el.id)) {
                  elementIds.add(el.id);
                  mergedElements.push(el);
                }
              }
              
              // Add incoming elements if not already included
              for (const el of elements) {
                if (el.id && !elementIds.has(el.id)) {
                  elementIds.add(el.id);
                  mergedElements.push(el);
                }
              }
              
              canvasData.elements = mergedElements;
              console.log('Merged canvas now has', mergedElements.length, 'elements');
            }
          } catch (error) {
            console.error('Error merging canvas states:', error);
          }
        }
        
        // Store in localStorage for persistence
        localStorage.setItem('pendingCanvasState', JSON.stringify(canvasData));
        
        // Set the canvas in the current context
        setCurrentCanvas(canvasData);
        
        // Mark the sync as complete
        setCanvasStateSynced(true);
        
        // Toast notification
        toast.success('Canvas data received with ' + canvasData.elements.length + ' elements');
      } catch (error) {
        console.error('Error processing canvas data:', error);
        toast.error('Failed to process canvas data');
      }
    });

    // Use a ref for processed messages to avoid window global
    // Add a handler for canvas operations - just ONE implementation
    const unregisterCanvasOperation = registerHandler('canvasOperation', (payload) => {
      // Check for duplicate messages (common issue)
      console.log('Processing canvas operation from peer:', payload);
  
      if (!payload || !payload.operation) {
        console.error('Invalid canvas operation received');
        return;
      }
      
      // Get the latest canvas from localStorage
      let currentCanvasData;
      try {
        const pendingCanvas = localStorage.getItem('pendingCanvasState');
        if (pendingCanvas) {
          currentCanvasData = JSON.parse(pendingCanvas);
        } else if (currentCanvas) {
          currentCanvasData = currentCanvas;
        } else {
          console.error('No canvas data available');
          return;
        }
      } catch (error) {
        console.error('Error loading canvas data:', error);
        return;
      }
      
      // FOR ADD OPERATIONS: Use the global element registry
      if (payload.operation === 'add' && payload.element) {
        try {
          // Ensure the element has a consistent ID
          const elementId = payload.element.id || 
            `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          // FIRST DEDUPLICATION CHECK: Check our in-memory set for this session
          if (addedElementIds.current.has(elementId)) {
            console.log(`DEDUPLICATION: Element ${elementId} already processed in this session`);
            return;
          }
          
          // SECOND CHECK: Check the global registry in localStorage
          const registry = JSON.parse(localStorage.getItem('globalElementRegistry') || '[]');
          if (registry.includes(elementId)) {
            console.log(`GLOBAL REGISTRY: Element ${elementId} already exists, skipping add`);
            return;
          }
          
          // THIRD CHECK: Verify against current canvas state
          const elementExists = currentCanvasData.elements.some(el => el.id === elementId);
          if (elementExists) {
            console.log(`Element ${elementId} already exists in canvas, adding to tracking`);
            
            // Still add to our tracking to prevent future duplicates
            addedElementIds.current.add(elementId);
            registry.push(elementId);
            localStorage.setItem('globalElementRegistry', JSON.stringify(registry));
            return;
          }
          
          // Add to tracking BEFORE adding the element
          addedElementIds.current.add(elementId);
          registry.push(elementId);
          localStorage.setItem('globalElementRegistry', JSON.stringify(registry));
          console.log(`Added element ${elementId} to tracking registries`);
          
          // Add the element to the canvas
          const updatedCanvas = {
            ...currentCanvasData,
            elements: [
              ...currentCanvasData.elements,
              {
                ...payload.element,
                id: elementId,
                x: typeof payload.element.x === 'number' ? payload.element.x : 0,
                y: typeof payload.element.y === 'number' ? payload.element.y : 0
              }
            ]
          };
          
          // Update the canvas state
          setCurrentCanvas(updatedCanvas);
          localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
          
          // Force UI update with custom event
          window.dispatchEvent(new CustomEvent('force-canvas-refresh', {
            detail: { operation: 'add', elementId }
          }));
          
          console.log(`Successfully added element ${elementId} to canvas`);
        } catch (error) {
          console.error('Error processing add operation:', error);
        }
      }
      // FOR UPDATE OPERATIONS: Always apply updates directly
      else if (payload.operation === 'update' && payload.element && payload.element.id) {
        try {
          console.log(`DIRECT UPDATE: Processing update for element ${payload.element.id}`);
          
          // Create updated canvas with the element changes
          const updatedCanvas = {
            ...currentCanvasData,
            elements: currentCanvasData.elements.map(el => {
              if (el.id === payload.element.id) {
                // Start with the original element to preserve all properties
                const updatedElement = { ...el };
                
                // Only apply properties that are explicitly defined (not undefined or null)
                Object.entries(payload.element).forEach(([key, value]) => {
                  // Skip ID and undefined/null values
                  if (key === 'id' || value === undefined || value === null) return;
                  
                  // For coordinates and dimensions, ensure they're proper numbers
                  if (['x', 'y', 'width', 'height'].includes(key)) {
                    updatedElement[key] = typeof value === 'number' ? value : Number(value);
                  } else {
                    // For other properties (color, text, etc)
                    updatedElement[key] = value;
                  }
                });
                
                console.log(`DIRECT UPDATE APPLIED: Element position preserved at x:${updatedElement.x}, y:${updatedElement.y}`);
                return updatedElement;
              }
              return el;
            })
          };
          
          // Update the canvas state and localStorage
          setCurrentCanvas(updatedCanvas);
          localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
          
          // Force a UI update
          window.dispatchEvent(new CustomEvent('force-canvas-refresh', {
            detail: { operation: 'update', elementId: payload.element.id }
          }));
          
          console.log(`Successfully updated element ${payload.element.id}`);
        } catch (error) {
          console.error('Error processing update operation:', error);
        }
      
      } else if (currentCanvasData && payload.operation === 'delete' && payload.elementId) {
        try {
          // Make a deep copy to avoid mutation issues
          const updatedCanvas = JSON.parse(JSON.stringify(currentCanvasData));
          
          // Filter out the deleted element
          updatedCanvas.elements = updatedCanvas.elements.filter((el: any) => el.id !== payload.elementId);
          console.log(`Deleted element ${payload.elementId} from peer in canvas`);
          
          // Update the canvas state with our modified copy
          setCurrentCanvas(updatedCanvas);
          
          // Also update localStorage for persistence
          localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
        } catch (error) {
          console.error('Error processing delete operation:', error);
        }
      }
      
      // Also forward to ContextBridge for UI updates
      // This is important as the UI might need to respond to these changes
      handleMessage('canvasUpdate', payload);

      // Propagate to other connected peers (mesh network)
      // But only if we didn't receive it from another peer (avoid loops)
      connections.forEach(conn => {
        if (conn && conn.open && conn.peer !== payload.sender) {
          conn.send({
            type: 'canvasOperation',
            payload,
            sender: peerId,
            timestamp: Date.now()
          });
        }
      });
    });

    return () => {
      unregisterCanvasState();
      unregisterRequestState();
      unregisterCanvasOperation();
    };
  }, [registerHandler, sendMessage, currentCanvas, setCurrentCanvas, connections, handleMessage, peerId]);

  // Add a server status checker

  // Add this to your WebSocketProvider
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch('http://100.81.128.167:9000/peerjs/peers', { 
          method: 'GET',
          mode: 'no-cors' // Just to check if the server responds
        });
        setServerStatus('online');
      } catch (error) {
        console.error('PeerJS server appears to be offline:', error);
        setServerStatus('offline');
        toast.error('Connection server appears to be offline. Sharing may not work.');
      }
    };
    
    checkServerStatus();
    
    // Periodically check server status
    const interval = setInterval(checkServerStatus, 60000); // Every minute
    
    return () => clearInterval(interval);
  }, []);

  return (
    <WebSocketContext.Provider value={contextValue}>
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

// In CanvasJoin.tsx or wherever you call connect
