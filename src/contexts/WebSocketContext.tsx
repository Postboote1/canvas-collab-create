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
        host: "peerjs.canvascollab.de",
        port: 443,
        path: '/',
        debug: 1, // Lower debug level to reduce console noise
        secure: true,
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


// Global connection registry to ensure we can access connections anywhere
let globalConnections = [];
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
  const imageObjectURLs = useRef<Map<string, string>>(new Map());
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

    // Update the connection tracking to use the global registry
  useEffect(() => {
    globalConnections = connections;
  }, [connections]);
    
  
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
    
    // Make connection available globally right away
    globalConnections.push(conn);
    
    // Also update React state
    setConnections(prev => {
      // Don't add duplicates
      if (prev.some(c => c && c.peer === conn.peer)) {
        return prev;
      }
      return [...prev, conn];
    });
    
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
        if (data?.type === 'canvasOperation' && 
          data?.payload?.operation === 'delete' && 
          data?.payload?.elementId) {
        
        console.log('DIRECT DELETE HANDLER: Processing deletion for element:', data.payload.elementId);
        
        setCurrentCanvas(prevCanvas => {
          if (!prevCanvas) return prevCanvas;
          
          // Only process if the element exists
          const elementExists = prevCanvas.elements.some(el => el.id === data.payload.elementId);
          if (!elementExists) {
            console.log(`Element ${data.payload.elementId} not found in canvas, skipping deletion`);
            return prevCanvas;
          }
          
          // Create new canvas state without the deleted element
          const updatedCanvas = {
            ...prevCanvas,
            elements: prevCanvas.elements.filter(el => el.id !== data.payload.elementId)
          };
          
          // Log what happened
          console.log(`DIRECT DELETE: Removed element ${data.payload.elementId}, elements: ${prevCanvas.elements.length} → ${updatedCanvas.elements.length}`);
          
          // Save to localStorage
          try {
            localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
            
            // Use the same event type as your update handler for consistency
            window.dispatchEvent(new CustomEvent('canvas-update', { 
              detail: { operation: 'delete', elementId: data.payload.elementId }
            }));
            
          } catch (err) {
            console.error('Error updating localStorage during delete:', err);
          }
          
          return updatedCanvas;
        });
      }
        // CRITICAL FIX: Special direct handling for element updates
      else if (data?.type === 'canvasOperation' && 
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
        payload: { sender: peerId },  // Use payload.sender consistently
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
        // Ensure the element has an ID and source tracking
        const elementId = message.payload.element.id || `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        message.payload.element.id = elementId;
        
        // Critical: Add a source marker to identify where this element came from
        message.payload.element._source = peerId;
        
        // Mark this element as processed locally BEFORE processing
        addedElementIds.current.add(elementId);
        
        // Also add to global registry
        const registry = JSON.parse(localStorage.getItem('globalElementRegistry') || '[]');
        if (!registry.includes(elementId)) {
          registry.push(elementId);
          localStorage.setItem('globalElementRegistry', JSON.stringify(registry));
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
            
            // Create a sanitized update payload with no undefined values
            const sanitizedElementUpdate: {
              id: string;
              x?: number;
              y?: number;
              width?: number;
              height?: number;
              color?: string;
              content?: string;
              [key: string]: any;  // Allow for other properties
            } = { id: message.payload.element.id };
            
            
            // Only include properties that are actually defined
            Object.entries(message.payload.element).forEach(([key, value]) => {
              // Skip ID and undefined/null values
              if (key === 'id' || value === undefined || value === null) return;
              
              // For numeric properties, ensure they're valid numbers
              if (['x', 'y', 'width', 'height'].includes(key)) {
                sanitizedElementUpdate[key] = typeof value === 'number' ? value : Number(value);
              } else {
                sanitizedElementUpdate[key] = value;
              }
            });
            
            // IMPORTANT: If we're updating width/height (resize operation) always include the position
            if ((sanitizedElementUpdate.width || sanitizedElementUpdate.height) && 
                !sanitizedElementUpdate.x && !sanitizedElementUpdate.y && 
                typeof updatedElement.x === 'number' && typeof updatedElement.y === 'number') {
              sanitizedElementUpdate.x = updatedElement.x;
              sanitizedElementUpdate.y = updatedElement.y;
            }
            
            // Replace original message payload with sanitized version
            message.payload.element = sanitizedElementUpdate;
            
            // Apply only defined properties to local element
            Object.entries(sanitizedElementUpdate).forEach(([key, value]) => {
              if (key !== 'id') { // Skip ID
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
        // CRITICAL: Always prioritize the current canvas from localStorage first
        const pendingCanvasStr = localStorage.getItem('pendingCanvasState');
        if (pendingCanvasStr) {
          try {
            const pendingCanvas = JSON.parse(pendingCanvasStr);
            if (pendingCanvas && pendingCanvas.elements) {
              console.log('Sending canvas from localStorage with elements:', pendingCanvas.elements.length);
              // Deep clone to avoid reference issues
              canvasToSend = JSON.parse(JSON.stringify(pendingCanvas));
            }
          } catch (err) {
            console.error('Error parsing pendingCanvasState:', err);
          }
        }
        // Try to get canvas from current context as fallback
        if (!canvasToSend && currentCanvas) {
          console.log('Sending current canvas from context with elements:', currentCanvas.elements?.length || 0);
          // Deep clone the canvas to avoid reference issues
          canvasToSend = JSON.parse(JSON.stringify(currentCanvas));
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
      
      console.log(`Attempting to send canvas to requester with ${canvasToSend.elements?.length || 0} elements`);
      
      // IMPORTANT: Force send to the requester via all possible connections
      const requesterId = payload?.sender || '';
      let messageSent = false;
      
      connections.forEach(conn => {
        if (conn && conn.open) {
          try {
            console.log(`Sending canvas to connection: ${conn.peer}`);
            conn.send({
              type: 'canvasState',
              payload: canvasToSend,
              sender: peerId,
              timestamp: Date.now()
            });
            messageSent = true;
          } catch (err) {
            console.error('Error sending canvas state to peer:', err);
          }
        }
      });
      
      if (!messageSent) {
        console.warn('Could not find any open connections to send canvas');
      }
    });
    

    const unregisterCanvasState = registerHandler('canvasState', (payload) => {
      console.log('Received canvas state:', payload);

      if (!payload) {
        console.error('Received empty canvas state');
        return;
      }
      
      try {
        // Load existing canvas from localStorage first
        let existingCanvas = null;
        let existingElements = [];
        
        try {
          const pendingCanvasStr = localStorage.getItem('pendingCanvasState');
          if (pendingCanvasStr) {
            existingCanvas = JSON.parse(pendingCanvasStr);
            if (existingCanvas && Array.isArray(existingCanvas.elements)) {
              existingElements = existingCanvas.elements;
              console.log('Found existing canvas with', existingElements.length, 'elements');
            }
          }
        } catch (err) {
          console.error('Error reading existing canvas:', err);
        }
        
        // Ensure we have valid elements from the incoming payload
        const incomingElements = Array.isArray(payload.elements) ? payload.elements.map(element => ({
          ...element,
          x: typeof element.x === 'number' ? element.x : 0,
          y: typeof element.y === 'number' ? element.y : 0,
          id: element.id || `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        })) : [];
        
        console.log(`Received ${incomingElements.length} elements from peer`);
        
        // CRITICAL FIX: Don't replace existing canvas with empty one from new joiners
        if (incomingElements.length === 0 && existingElements.length > 0) {
          console.log('PRESERVING EXISTING CANVAS: Received empty canvas from joiner but have existing content');
          return; // Skip updating altogether - keep our canvas
        }
        
        // We'll use a Map to merge elements by ID
        const elementMap = new Map();
        
        // First add all existing elements
        existingElements.forEach(el => {
          if (el && el.id) elementMap.set(el.id, el);
        });
        
        // Then add incoming elements if they don't already exist
        incomingElements.forEach(el => {
          if (el && el.id && !elementMap.has(el.id)) {
            elementMap.set(el.id, el);
          }
        });
        
        // Convert back to array
        const mergedElements = Array.from(elementMap.values());
        console.log(`MERGED RESULT: ${existingElements.length} existing + ${incomingElements.length} incoming = ${mergedElements.length} total elements`);
        
        // Create the final canvas object
        const canvasData = {
          // IMPORTANT: Preserve original canvas name and properties
          id: (existingCanvas && existingCanvas.id) || payload.id || `shared-${Date.now()}`,
          name: (existingCanvas && existingCanvas.name) || payload.name || 'Shared Canvas',
          elements: mergedElements,
          createdBy: (existingCanvas && existingCanvas.createdBy) || payload.createdBy || 'shared',
          createdAt: (existingCanvas && existingCanvas.createdAt) || payload.createdAt || new Date().toISOString(),
          joinCode: (existingCanvas && existingCanvas.joinCode) || payload.joinCode || '',
          isInfinite: (existingCanvas && existingCanvas.isInfinite !== undefined) ? 
                     existingCanvas.isInfinite : 
                     (payload.isInfinite === undefined ? true : payload.isInfinite)
        };
        
        // Save to localStorage first, then update state
        console.log(`Saving merged canvas with ${mergedElements.length} elements`);
        localStorage.setItem('pendingCanvasState', JSON.stringify(canvasData));
        
        // Use setTimeout to break potential circular updates
        setTimeout(() => {
          setCanvasStateSynced(true);
          setCurrentCanvas(canvasData);
          toast.success(`Canvas synced with ${mergedElements.length} elements`);
        }, 20);
        
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
          // Get element ID
          const elementId = payload.element.id || 
            `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          // Create a device-specific key for deduplication
          const deviceId = payload.sender || payload.deviceId || 'unknown';
          const deviceElementKey = `${deviceId}:${elementId}`;
          
          console.log(`ADD OPERATION: Processing element ${elementId} from device ${deviceId}`);
          console.log(`Local peer ID: ${peerId}, message details:`, {
            crossDeviceFlags: {
              _crossDeviceOp: payload._crossDeviceOp,
              _forceBroadcast: payload._forceBroadcast,
              elementCrossDevice: payload.element._crossDeviceElement
            },
            sender: payload.sender,
            device: deviceId,
            local: peerId
          });
          
          // Cross-device detection - CRITICAL FIX - Don't use simple comparison
          const isDifferentDevice = payload.sender !== peerId && deviceId !== peerId;
          const hasCrossDeviceFlags = payload._crossDeviceOp || payload._forceBroadcast || 
                                    payload.element._crossDeviceElement;
                                    
          const isCrossDeviceOperation = isDifferentDevice || hasCrossDeviceFlags;
          
          // Skip ONLY if we've already processed this exact element from this exact device
          // and it's NOT a cross-device operation with force flags
          if (!isCrossDeviceOperation && addedElementIds.current.has(deviceElementKey)) {
            console.log(`Local duplicate from same device, skipping: ${deviceElementKey}`);
            return;
          }
          
          // For cross-device operations, always log but process
          if (isCrossDeviceOperation) {
            console.log(`CROSS-DEVICE OPERATION: Force processing element ${elementId} from ${deviceId}`);
          }
          
          // Add the element to canvas 
          console.log(`Adding element ${elementId} to canvas from device: ${deviceId}`);
          
          // CRITICAL: Make a deep copy of the canvas before modifying
          const updatedCanvas = JSON.parse(JSON.stringify(currentCanvasData));
          
          // Clean the incoming element of any processing flags before adding
          const cleanElement = { ...payload.element };
          
          // Add the cleaned element to the canvas
          updatedCanvas.elements.push(cleanElement);
          
          // Save to localStorage and update state
          localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
          setCurrentCanvas(updatedCanvas);
          
          // Force refresh UI with a custom event
          window.dispatchEvent(new CustomEvent('force-canvas-refresh', {
            detail: { operation: 'add', elementId: elementId, timestamp: Date.now() }
          }));
          
          // Mark as processed using the device-specific key
          addedElementIds.current.add(deviceElementKey);
          
          // Notify user
          toast.success(`New element added from ${deviceId === peerId ? 'you' : 'collaborator'}`, 
            { duration: 2000 });
            
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
          console.log(`PROCESSING DELETE: Removing element ${payload.elementId} from canvas`);
          
          // Check if element exists in current canvas
          const elementExists = currentCanvasData.elements.some((el: any) => el.id === payload.elementId);
          if (!elementExists) {
            console.log(`Element ${payload.elementId} not found in canvas, already deleted`);
            return;
          }
          
          // Make a deep copy to avoid mutation issues
          const updatedCanvas = JSON.parse(JSON.stringify(currentCanvasData));
          
          // Filter out the deleted element
          const originalLength = updatedCanvas.elements.length;
          updatedCanvas.elements = updatedCanvas.elements.filter((el: any) => el.id !== payload.elementId);
          
          console.log(`Deleted element ${payload.elementId} from canvas, removed ${originalLength - updatedCanvas.elements.length} elements`);
          
          // Update the canvas state with our modified copy - IMPORTANT for UI update
          setCurrentCanvas(updatedCanvas);
          
          // Also update localStorage for persistence
          localStorage.setItem('pendingCanvasState', JSON.stringify(updatedCanvas));
          
          // Force a UI update with a stronger mechanism
          window.dispatchEvent(new CustomEvent('force-canvas-refresh', {
            detail: { operation: 'delete', elementId: payload.elementId, timestamp: Date.now() }
          }));
          
          // Also send a more direct notification using toast
          toast.info(`Element ${payload.elementId.substring(0, 8)}... was deleted`, {
            duration: 3000
          });
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
          // Get stable device ID
          const stableDeviceId = peerId || localStorage.getItem('stableDeviceId') || 
            (() => {
              const newId = 'device-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
              localStorage.setItem('stableDeviceId', newId);
              return newId;
            })();
          
          // Create a clean forwarded message with reliable device ID
          const forwardMessage = {
            type: 'canvasOperation',
            payload: {
              ...payload,
              _relayed: true,
              _originalSender: payload.sender || stableDeviceId,
              _crossDeviceOp: true,
              _forceSync: true,
              operation: payload.operation,
              // Handle element properly for different operation types
              ...(payload.operation === 'add' && payload.element ? {
                element: {
                  ...payload.element,
                  _deviceOrigin: stableDeviceId,
                  _crossDeviceElement: true,
                  _relayTimestamp: Date.now()
                }
              } : {})
            },
            sender: stableDeviceId, // Always use stable ID for sender
            timestamp: Date.now()
          };
          
          // Send with explicit logging
          console.log(`Relaying operation to peer ${conn.peer}:`, forwardMessage);
          conn.send(forwardMessage);
        }
      });
    });

    return () => {
      unregisterCanvasState();
      unregisterRequestState();
      unregisterCanvasOperation();
    };
  }, [registerHandler, sendMessage, currentCanvas, setCurrentCanvas, connections, handleMessage, peerId]);


  const cleanupUnusedImages = () => {
    if (!currentCanvas) return;
    
    const activeImageIds = new Set();
    
    // Collect all active image IDs
    currentCanvas.elements.forEach(element => {
      if (element.type === 'image') {
        activeImageIds.add(element.id);
      }
    });
    
    // Clean up any object URLs not in active use
    imageObjectURLs.current.forEach((url, id) => {
      if (!activeImageIds.has(id)) {
        console.log(`Cleaning up unused image: ${id}`);
        URL.revokeObjectURL(url);
        imageObjectURLs.current.delete(id);
      }
    });
  };
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
