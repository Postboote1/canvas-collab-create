import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';
import { pb } from '@/services/pocketbaseService';
import { useWebSocket } from './WebSocketContext';
import { toast } from 'sonner';
import { convertImageUrlsToBase64 } from '@/lib/imageUtils';

// Types remain unchanged

export interface CanvasElement {
  id: string;
  type: 'card' | 'text' | 'drawing' | 'image' | 'arrow' | 'shape';
  content?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: string;
  fontSize?: number;
  points?: { x: number; y: number }[];
  imageUrl?: string;
  fromId?: string;
  toId?: string;
  shapeType?: 'circle' | 'triangle' | 'diamond';
  _source?: string;
}

export interface Canvas {
  id: string;
  name: string;
  elements: CanvasElement[];
  createdBy: string;
  createdAt: string;
  joinCode: string;
  isInfinite: boolean;
  users?: string[];
  viewBox?: { x: number; y: number; width: number; height: number };
}

interface CanvasContextType {
  userCanvases: Canvas[];
  currentCanvas: Canvas | null;
  createCanvas: (name: string, isInfinite: boolean) => Promise<Canvas>;
  createTempCanvas: (name: string, isInfinite: boolean) => Promise<Canvas>;
  loadCanvas: (id: string) => Promise<boolean>;
  loadCanvasByCode: (code: string) => Promise<boolean>;
  saveCanvas: () => Promise<boolean>;
  saveCurrentCanvasToAccount: () => Promise<boolean>;
  addElement: (element: Omit<CanvasElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  clearCanvas: () => void;
  exportAsImage: () => void;
  exportAsPDF: () => void;
  exportCanvasData: () => Promise<string>;
  importCanvasData: (data: string) => boolean;
  generateJoinCode: () => string;
  generateQRCode: (joinCode: string) => string;
  setCurrentCanvas: React.Dispatch<React.SetStateAction<Canvas | null>>;
  loadUserCanvases: () => Promise<void>;
  deleteCanvas: (id: string) => Promise<boolean>;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);
const CANVAS_STORAGE_KEY = 'global_canvases';

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, refreshUserData } = useAuth();
  const webSocketContext = useWebSocket();

  if (!webSocketContext) {
    console.error('WebSocketProvider is not initialized yet.');
    return null; // Prevent rendering until WebSocketProvider is ready
  }

  const { registerHandler, sendMessage } = webSocketContext;
  const [userCanvases, setUserCanvases] = useState<Canvas[]>([]);
  const [currentCanvas, setCurrentCanvas] = useState<Canvas | null>(null);
  const canvasRef = useRef(currentCanvas);

  // Sync ref with current canvas state
  useEffect(() => {
    canvasRef.current = currentCanvas;
  }, [currentCanvas]);

  // WebSocket message handling
  useEffect(() => {
    if (!registerHandler) return;

    const unregisterHandler = registerHandler('canvasUpdate', (payload) => {
      console.log('Received canvas update:', payload);
      // Handle canvas update logic
    });

    return () => {
      unregisterHandler();
    };
  }, [registerHandler]);

  // Load user canvases when user changes
  useEffect(() => {
    if (user) {
      loadUserCanvases();
    } else {
      setUserCanvases([]);
      // Don't clear currentCanvas when logout to allow anonymous usage
    }
  }, [user]);

  // New function to get all canvases from global storage
  const getAllCanvases = (): Canvas[] => {
    try {
      const canvasesStr = localStorage.getItem(CANVAS_STORAGE_KEY) || '[]';
      return JSON.parse(canvasesStr);
    } catch (error) {
      console.error('Failed to load canvases from storage:', error);
      return [];
    }
  };

  // New function to save all canvases to global storage
  const saveAllCanvases = (canvases: Canvas[], newCanvas?: Canvas) => {
    try {
      localStorage.setItem(CANVAS_STORAGE_KEY, JSON.stringify(canvases));
      if (newCanvas && sendMessage) { // Check if sendMessage exists
        sendMessage({
          type: 'createCanvas',
          payload: newCanvas
        });
      }
    } catch (error) {
      console.error('Failed to save canvases:', error);
    }
  };

  const loadUserCanvases = useCallback(async () => {
    if (!pb.client.authStore.isValid) {
      setUserCanvases([]);
      return;
    }
    
    try {
      const records = await pb.client.collection('canvases').getFullList({
        filter: `user = "${pb.client.authStore.model.id}"`,
        sort: '-updated',
      });
      
      const canvases = records.map(record => ({
        id: record.id,
        name: record.name,
        elements: record.data.elements || [],
        createdBy: record.user,
        createdAt: record.created,
        joinCode: record.joinCode || '',
        isInfinite: record.data.isInfinite || true,
      }));
      
      setUserCanvases(canvases);
    } catch (error) {
      console.error('Failed to load canvases:', error);
      toast.error('Failed to load your canvases');
    }
  }, []);

  const isUserAdmin = () => {
    if (!user) return false;
    // Fix the property access by checking isAdmin property directly
    return user.role === "admin";
  };

  const createCanvas = useCallback(async (name: string, isInfinite: boolean): Promise<Canvas> => {
    if (!pb.client.authStore.isValid) {
      throw new Error('You must be logged in to create a canvas');
    }
    
    // Check if user has reached the limit of 5 canvases (unless they're an admin)
    if (user.role !== 'admin') {
      const canvasCount = await pb.getCanvasCount(user.id);
      if (canvasCount >= user.canvasLimit) {
        toast.error(`You have reached your limit of ${user.canvasLimit} canvases`);
        throw new Error('Canvas limit reached');
      }
    }
    
    const canvas: Canvas = {
      id: `canvas_${Date.now()}`,
      name,
      elements: [],
      createdBy: pb.client.authStore.model.id,
      createdAt: new Date().toISOString(),
      joinCode: uuidv4().slice(0, 8),
      isInfinite,
    };
    
    const canvasSize = JSON.stringify(canvas).length;

    try {
      const record = await pb.client.collection('canvases').create({
        user: pb.client.authStore.model.id,
        name: canvas.name,
        data: canvas,
        size: canvasSize,
        joinCode: canvas.joinCode,
        isPublic: false,
      });
      
      // Update user storage usage
      if (user.role !== 'admin') {
        await pb.client.collection('users').update(user.id, {
          currentStorage: (user.currentStorage || 0) + canvasSize
        });
        refreshUserData();
      }
      
      const newCanvas = {
        id: record.id,
        name: canvas.name,
        elements: canvas.elements,
        createdBy: canvas.createdBy,
        createdAt: canvas.createdAt,
        joinCode: canvas.joinCode,
        isInfinite: canvas.isInfinite,
      };
      
      setCurrentCanvas(newCanvas);
      await loadUserCanvases();
      
      return newCanvas;
    } catch (error) {
      console.error('Failed to create canvas:', error);
      toast.error('Failed to create canvas');
      throw error;
    }
  }, [user, loadUserCanvases, refreshUserData]);

  // Add a new method to create temporary canvases without login
  const createTempCanvas = async (name: string, isInfinite: boolean): Promise<Canvas> => {
    const newCanvas: Canvas = {
      id: `temp_canvas_${Date.now()}`,
      name,
      elements: [],
      createdBy: 'anonymous',
      createdAt: new Date().toISOString(),
      joinCode: generateJoinCode(),
      isInfinite
    };
    
    // Add to global canvases for sharing
    const allCanvases = getAllCanvases();
    allCanvases.push(newCanvas);
    saveAllCanvases(allCanvases, newCanvas);
    
    // Set as current canvas but don't save to any user account
    setCurrentCanvas(newCanvas);
    
    // Track canvas creation for analytics
    trackCanvasCreation();
    
    toast.success('Temporary canvas created!', {
      position: 'bottom-center',
    });
    toast.info('Sign in to save this canvas to your account.', {
      position: 'bottom-center',
    });
    
    return newCanvas;
  };

  // Add a method to save the current temporary canvas to a user account
  // Save a temporary canvas to the user's account
  const saveCurrentCanvasToAccount = useCallback(async () => {
    if (!currentCanvas || !pb.client.authStore.isValid) {
      toast.error('You must be logged in to save this canvas');
      return false;
    }
    
    // Check if user can create more canvases
    if (user.role !== 'admin') {
      const canvasCount = await pb.getCanvasCount(user.id);
      if (canvasCount >= user.canvasLimit) {
        toast.error(`You have reached your limit of ${user.canvasLimit} canvases`);
        return false;
      }
    }
    
    try {
      // Convert blob URLs to base64
      const canvasWithBase64Images = await convertImageUrlsToBase64(currentCanvas);
      
      const canvasData = { ...canvasWithBase64Images };
      const canvasSize = JSON.stringify(canvasData).length;
      
      // For non-admin users, check storage limit
      if (user.role !== 'admin' && canvasSize > user.storageLimit - user.currentStorage) {
        toast.error('You have reached your storage limit');
        return false;
      }
      
      // Create a new canvas in PocketBase
      const record = await pb.client.collection('canvases').create({
        user: pb.client.authStore.model.id,
        name: currentCanvas.name,
        data: canvasData,
        size: canvasSize,
        joinCode: currentCanvas.joinCode,
        isPublic: false,
      });
      
      // Update user's storage for non-admin users
      if (user.role !== 'admin') {
        await pb.client.collection('users').update(user.id, {
          currentStorage: (user.currentStorage || 0) + canvasSize
        });
        refreshUserData();
      }
      
      // Update local state
      const newCanvas = {
        id: record.id,
        name: canvasData.name,
        elements: canvasData.elements,
        createdBy: pb.client.authStore.model.id,
        createdAt: canvasData.createdAt,
        joinCode: canvasData.joinCode,
        isInfinite: canvasData.isInfinite,
      };
      
      setCurrentCanvas(canvasWithBase64Images);
      await loadUserCanvases();
      
      toast.success('Canvas saved to your account');
      return true;
    } catch (error) {
      console.error('Failed to save canvas to account:', error);
      toast.error('Failed to save canvas to your account');
      return false;
    }
  }, [currentCanvas, user, loadUserCanvases, refreshUserData]);

  // Load canvas by ID
  const loadCanvas = useCallback(async (canvasId: string) => {
    // Clear any pending canvas state before loading a specific canvas
    localStorage.removeItem('pendingCanvasState');
    try {
      const record = await pb.client.collection('canvases').getOne(canvasId);
      
      // Check if user has permission
      const isOwner = record.user === pb.client.authStore.model?.id;
      const isAdmin = user?.role === 'admin';
      const isPublic = record.isPublic;
      
      if (!isOwner && !isAdmin && !isPublic) {
        toast.error('You do not have permission to view this canvas');
        return null;
      }
      
      const canvasData = record.data;
      const canvas = {
        id: record.id,
        name: canvasData.name || record.name,
        elements: canvasData.elements || [],
        createdBy: canvasData.createdBy || record.user,
        createdAt: canvasData.createdAt || record.created,
        joinCode: canvasData.joinCode || record.joinCode || '',
        isInfinite: canvasData.isInfinite ?? true,
      };
      
      setCurrentCanvas(canvas);
      return true; // Return true to indicate success
    } catch (error) {
      console.error('Failed to load canvas:', error);
      toast.error('Failed to load canvas');
      return false;
    }
  }, [user]);

  const loadCanvasByCode = async (code: string): Promise<boolean> => {
    try {
      // Get all canvases and search for the join code
      const allCanvases = getAllCanvases();
      
      const foundCanvas = allCanvases.find(canvas => canvas.joinCode === code);
      
      if (foundCanvas) {
        setCurrentCanvas(foundCanvas);
        
        // Track canvas join for analytics
        trackCanvasJoin();
        
        toast.success('Canvas loaded successfully!', {
          position: 'bottom-center',
        });
        return true;
      } else {
        // Fallback to old method as migration path
        const usersStr = localStorage.getItem('canvasUsers') || '[]';
        const users = JSON.parse(usersStr);
        
        for (const u of users) {
          if (u.canvases) {
            const canvas = u.canvases.find((c: Canvas) => c.joinCode === code);
            if (canvas) {
              setCurrentCanvas(canvas);
              
              // Also add to global canvases for future access
              allCanvases.push(canvas);
              saveAllCanvases(allCanvases);
              
              // Track canvas join for analytics
              trackCanvasJoin();
              
              toast.success('Canvas loaded successfully!', {
                position: 'bottom-center',
              });
              return true;
            }
          }
        }
        
        toast.error('Canvas not found with that code', {
          position: 'bottom-center',
        });
        return false;
      }
    } catch (error) {
      console.error('Failed to load canvas by code:', error);
      toast.error('Failed to load canvas', {
        position: 'bottom-center',
      });
      return false;
    }
  };

  const saveCanvas = useCallback(async () => {
    if (!currentCanvas || !pb.client.authStore.isValid) return false;
    
    try {
      const canvasWithBase64Images = await convertImageUrlsToBase64(currentCanvas);
    
      const canvasData = { ...canvasWithBase64Images };
      const canvasSize = JSON.stringify(canvasData).length;
      
      // For non-admin users, check storage limit
      if (user.role !== 'admin') {
        // Get current canvas to calculate size difference
        const existingCanvas = await pb.client.collection('canvases').getOne(currentCanvas.id);
        const sizeDifference = canvasSize - existingCanvas.size;
        
        if (user.currentStorage + sizeDifference > user.storageLimit) {
          toast.error('You have reached your storage limit');
          return false;
        }
      }
      
      // Update the canvas in PocketBase
      await pb.client.collection('canvases').update(currentCanvas.id, {
        name: currentCanvas.name,
        data: canvasData,
        size: canvasSize,
        updated: new Date().toISOString()
      });
      
      // Update user's storage usage for non-admin users
      if (user.role !== 'admin') {
        const existingCanvas = await pb.client.collection('canvases').getOne(currentCanvas.id);
        const sizeDifference = canvasSize - existingCanvas.size;
        
        await pb.client.collection('users').update(user.id, {
          currentStorage: (user.currentStorage || 0) + sizeDifference
        });
        refreshUserData();
      }
      setCurrentCanvas(canvasWithBase64Images);
      
      toast.success('Canvas saved successfully');
      return true;
    } catch (error) {
      console.error('Failed to save canvas:', error);
      toast.error('Failed to save canvas');
      return false;
    }
  }, [currentCanvas, user, refreshUserData]);

  // Delete a canvas
  const deleteCanvas = useCallback(async (canvasId: string) => {
    if (!pb.client.authStore.isValid) return false;
    
    try {
      // Get canvas size before deleting
      const canvas = await pb.client.collection('canvases').getOne(canvasId);
      const canvasSize = canvas.size || 0;
      
      // Delete from PocketBase
      await pb.client.collection('canvases').delete(canvasId);
      
      // Update user's storage for non-admin users
      if (user.role !== 'admin') {
        await pb.client.collection('users').update(user.id, {
          currentStorage: Math.max(0, (user.currentStorage || 0) - canvasSize)
        });
        refreshUserData();
      }
      
      // Update local state
      if (currentCanvas?.id === canvasId) {
        setCurrentCanvas(null);
      }
      await loadUserCanvases();
      
      toast.success('Canvas deleted successfully');
      return true;
    } catch (error) {
      console.error('Failed to delete canvas:', error);
      toast.error('Failed to delete canvas');
      return false;
    }
  }, [currentCanvas, loadUserCanvases, user, refreshUserData]);

  // Canvas operations with useCallback for stability
  const addElement = useCallback((element: Omit<CanvasElement, 'id'>) => {
    const newElement = {
      ...element,
      id: `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
    
    setCurrentCanvas(prev => prev ? { 
      ...prev, 
      elements: [...prev.elements, newElement] 
    } : prev);
    
    // Return the new element with its ID
    return newElement;
  }, []);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setCurrentCanvas(prev => {
      if (!prev) return prev;
      const updated = prev.elements.map(el => 
        el.id === id ? { ...el, ...updates } : el
      );
      
      // Move the sendMessage outside the setCurrentCanvas callback
      return { ...prev, elements: updated };
    });
  
    // Send message after state update, include timestamp for uniqueness
    if (sendMessage) {
    // Generate a unique update identifier
      const updateId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      sendMessage({
        type: 'canvasOperation',
        payload: {
          operation: 'update',
          element: { 
            id, 
            ...updates,
            _timestamp: updateId // Add timestamp to ensure uniqueness
          }
        }
      });
    }
  }, [sendMessage]);

  const deleteElement = useCallback((id: string) => {
    setCurrentCanvas(prev => {
      if (!prev) return prev;
      if (sendMessage) {
        sendMessage({
          type: 'canvasOperation',
          payload: {
            operation: 'delete',
            elementId: id
          }
        });
      }
      return { ...prev, elements: prev.elements.filter(el => el.id !== id) };
    });
  }, [sendMessage]);

  const clearCanvas = () => {
    if (!currentCanvas) return;
    
    setCurrentCanvas({
      ...currentCanvas,
      elements: []
    });
    
    toast.success('Canvas cleared', {
      position: 'bottom-center',
    });
  };

  const exportAsImage = () => {
    if (!currentCanvas) {
      toast.error('No canvas to export', {
        position: 'bottom-center',
      });
      return;
    }
    
    // This is a placeholder - in a real app, you would use an HTML canvas or a library
    // like html-to-image to actually export the canvas as an image
    toast.success('Canvas exported as image (mock)', {
      position: 'bottom-center',
    });
  };

  const exportAsPDF = () => {
    if (!currentCanvas) {
      toast.error('No canvas to export', {
        position: 'bottom-center',
      });
      return;
    }
    
    // This is a placeholder - in a real app, you would use a library like jsPDF
    // to actually export the canvas as a PDF
    toast.success('Canvas exported as PDF (mock)', {
      position: 'bottom-center',
    });
  };

  const exportCanvasData = async (): Promise<string> => {
    if (!currentCanvas) {
      toast.error('No canvas to export', {
        position: 'bottom-center',
      });
      return '';
    }
    
    try {
      // Convert all blob URLs to base64 before exporting
      const canvasWithBase64Images = await convertImageUrlsToBase64(currentCanvas);
      return JSON.stringify(canvasWithBase64Images);
    } catch (error) {
      console.error('Failed to export canvas data:', error);
      toast.error('Failed to export canvas data', {
        position: 'bottom-center',
      });
      return '';
    }
  };

  const importCanvasData = (data: string): boolean => {
    try {
      const canvas = JSON.parse(data) as Canvas;
      
      // Validate the canvas data
      if (!canvas.id || !canvas.name || !Array.isArray(canvas.elements)) {
        toast.error('Invalid canvas data', {
          position: 'bottom-center',
        });
        return false;
      }
      
      // Process all elements to ensure they have valid properties
      const processedElements = canvas.elements.map(element => ({
        ...element,
        id: element.id || `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        x: typeof element.x === 'number' ? element.x : 0,
        y: typeof element.y === 'number' ? element.y : 0
      }));
      
      // Create a new canvas object with the processed elements
      const processedCanvas = {
        ...canvas,
        elements: processedElements,
        id: `imported_${Date.now()}`, // Generate a new ID for the imported canvas
        joinCode: generateJoinCode(), // Generate a new join code
      };
      
      // Set as current canvas
      setCurrentCanvas(processedCanvas);
      
      // Also add to global canvases
      const allCanvases = getAllCanvases();
      allCanvases.push(processedCanvas);
      saveAllCanvases(allCanvases);
      
      toast.success('Canvas imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import canvas data:', error);
      toast.error('Failed to import canvas: Invalid data format', {
        position: 'bottom-center',
      });
      return false;
    }
  };

  const generateJoinCode = (): string => {
    // Generate a random 6-character code
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const generateQRCode = (joinCode: string): string => {
    // This is a placeholder - in a real app, you would use a library like qrcode
    // to actually generate a QR code
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
      `${window.location.origin}/join/${joinCode}`
    )}&size=200x200`;
  };

  // Analytics tracking functions
  const trackCanvasCreation = () => {
    try {
      const stats = JSON.parse(localStorage.getItem('canvasStats') || '{}');
      stats.canvasesCreated = (stats.canvasesCreated || 0) + 1;
      localStorage.setItem('canvasStats', JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to track canvas creation:', error);
    }
  };

  const trackCanvasJoin = () => {
    try {
      const stats = JSON.parse(localStorage.getItem('canvasStats') || '{}');
      stats.canvasesJoined = (stats.canvasesJoined || 0) + 1;
      localStorage.setItem('canvasStats', JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to track canvas join:', error);
    }
  };

  useEffect(() => {
    if (!registerHandler) return;
  
    // Handle canvas state requests
    const unregisterRequestState = registerHandler('requestCanvasState', () => {
      if (currentCanvas && sendMessage) {
        sendMessage({
          type: 'canvasState',
          payload: {
            canvasId: currentCanvas.id,
            elements: currentCanvas.elements
          }
        });
      }
    });
  
    // Handle incoming canvas state
    const unregisterCanvasState = registerHandler('canvasState', (payload) => {
      setCurrentCanvas(prev => ({
        ...prev!,
        id: payload.canvasId,
        elements: payload.elements,
      }));
    });
  
    return () => {
      unregisterRequestState();
      unregisterCanvasState();
    };
  }, [registerHandler, currentCanvas, sendMessage]);

  useEffect(() => {
    //console.log('Current canvas updated:', currentCanvas);
  }, [currentCanvas]);

  return (
    <CanvasContext.Provider value={{
      userCanvases,
      currentCanvas,
      createCanvas,
      createTempCanvas,
      loadCanvas,
      loadCanvasByCode,
      saveCanvas,
      saveCurrentCanvasToAccount,
      addElement,
      updateElement,
      deleteElement,
      clearCanvas,
      exportAsImage,
      exportAsPDF,
      exportCanvasData,
      importCanvasData,
      generateJoinCode,
      generateQRCode,
      setCurrentCanvas,
      loadUserCanvases,
      deleteCanvas,
    }}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
};