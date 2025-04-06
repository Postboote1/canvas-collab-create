import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

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
}

export interface Canvas {
  id: string;
  name: string;
  elements: CanvasElement[];
  createdBy: string;
  createdAt: string;
  joinCode: string;
  isInfinite: boolean;
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
  exportCanvasData: () => string;
  importCanvasData: (data: string) => boolean;
  generateJoinCode: () => string;
  generateQRCode: (joinCode: string) => string;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [userCanvases, setUserCanvases] = useState<Canvas[]>([]);
  const [currentCanvas, setCurrentCanvas] = useState<Canvas | null>(null);

  // Load user canvases when user changes
  useEffect(() => {
    if (user) {
      loadUserCanvases();
    } else {
      setUserCanvases([]);
      // Don't clear currentCanvas when logout to allow anonymous usage
    }
  }, [user]);

  const loadUserCanvases = () => {
    if (!user) return;
    
    try {
      // Get all users to find the current user's canvases
      const usersStr = localStorage.getItem('canvasUsers') || '[]';
      const users = JSON.parse(usersStr);
      
      const currentUser = users.find((u: any) => u.id === user.id);
      if (currentUser && currentUser.canvases) {
        setUserCanvases(currentUser.canvases);
      } else {
        setUserCanvases([]);
      }
    } catch (error) {
      console.error('Failed to load user canvases:', error);
      toast.error('Failed to load your canvases');
    }
  };

  const isUserAdmin = () => {
    if (!user) return false;
    // Fix the property access by checking isAdmin instead of role
    return user.isAdmin === true;
  };

  const createCanvas = async (name: string, isInfinite: boolean): Promise<Canvas> => {
    if (!user) {
      toast.error('You must be logged in to create a canvas');
      throw new Error('Not logged in');
    }
    
    // Check if user has reached the limit of 5 canvases (unless they're an admin)
    if (!isUserAdmin() && userCanvases.length >= 5) {
      toast.error('You can only create up to 5 canvases. Upgrade to Admin for unlimited canvases.');
      throw new Error('Canvas limit reached');
    }
    
    const newCanvas: Canvas = {
      id: `canvas_${Date.now()}`,
      name,
      elements: [],
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      joinCode: generateJoinCode(),
      isInfinite
    };
    
    try {
      // Update user's canvases in localStorage
      const usersStr = localStorage.getItem('canvasUsers') || '[]';
      const users = JSON.parse(usersStr);
      
      const userIndex = users.findIndex((u: any) => u.id === user.id);
      if (userIndex !== -1) {
        if (!users[userIndex].canvases) {
          users[userIndex].canvases = [];
        }
        users[userIndex].canvases.push(newCanvas);
        localStorage.setItem('canvasUsers', JSON.stringify(users));
        
        // Update state
        setUserCanvases([...userCanvases, newCanvas]);
        setCurrentCanvas(newCanvas);
        
        // Track canvas creation for analytics
        trackCanvasCreation();
        
        toast.success('Canvas created successfully!');
        return newCanvas;
      } else {
        throw new Error('User not found');
      }
    } catch (error) {
      console.error('Failed to create canvas:', error);
      toast.error('Failed to create canvas');
      throw error;
    }
  };

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
    
    // Set as current canvas but don't save to any user account
    setCurrentCanvas(newCanvas);
    
    // Track canvas creation for analytics
    trackCanvasCreation();
    
    toast.success('Temporary canvas created!');
    toast.info('Sign in to save this canvas to your account.');
    
    return newCanvas;
  };

  // Add a method to save the current temporary canvas to a user account
  const saveCurrentCanvasToAccount = async (): Promise<boolean> => {
    if (!user) {
      toast.error('You must be logged in to save a canvas');
      return false;
    }
    
    if (!currentCanvas) {
      toast.error('No canvas to save');
      return false;
    }
    
    // Check if user has reached the limit of 5 canvases (unless they're an admin)
    if (!isUserAdmin() && userCanvases.length >= 5) {
      toast.error('You can only have up to 5 canvases. Please delete one first or upgrade to Admin.');
      return false;
    }
    
    try {
      // Get users from localStorage
      const usersStr = localStorage.getItem('canvasUsers') || '[]';
      const users = JSON.parse(usersStr);
      
      const userIndex = users.findIndex((u: any) => u.id === user.id);
      if (userIndex !== -1) {
        if (!users[userIndex].canvases) {
          users[userIndex].canvases = [];
        }
        
        // Create a new canvas object with the current user as the owner
        const savedCanvas: Canvas = {
          ...currentCanvas,
          id: `canvas_${Date.now()}`,
          createdBy: user.id,
          createdAt: new Date().toISOString(),
        };
        
        users[userIndex].canvases.push(savedCanvas);
        localStorage.setItem('canvasUsers', JSON.stringify(users));
        
        // Update state
        setUserCanvases([...userCanvases, savedCanvas]);
        setCurrentCanvas(savedCanvas);
        
        toast.success('Canvas saved to your account!');
        return true;
      } else {
        toast.error('User not found');
        return false;
      }
    } catch (error) {
      console.error('Failed to save canvas to account:', error);
      toast.error('Failed to save canvas to account');
      return false;
    }
  };

  const loadCanvas = async (id: string): Promise<boolean> => {
    try {
      const canvas = userCanvases.find(canvas => canvas.id === id);
      if (canvas) {
        setCurrentCanvas(canvas);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load canvas:', error);
      toast.error('Failed to load canvas');
      return false;
    }
  };

  const loadCanvasByCode = async (code: string): Promise<boolean> => {
    try {
      // Get all users and search through all canvases for the join code
      const usersStr = localStorage.getItem('canvasUsers') || '[]';
      const users = JSON.parse(usersStr);
      
      let foundCanvas = null;
      
      for (const u of users) {
        if (u.canvases) {
          const canvas = u.canvases.find((c: Canvas) => c.joinCode === code);
          if (canvas) {
            foundCanvas = canvas;
            break;
          }
        }
      }
      
      if (foundCanvas) {
        setCurrentCanvas(foundCanvas);
        
        // Track canvas join for analytics
        trackCanvasJoin();
        
        toast.success('Canvas loaded successfully!');
        return true;
      } else {
        toast.error('Canvas not found with that code');
        return false;
      }
    } catch (error) {
      console.error('Failed to load canvas by code:', error);
      toast.error('Failed to load canvas');
      return false;
    }
  };

  const saveCanvas = async (): Promise<boolean> => {
    if (!currentCanvas) {
      toast.error('No canvas to save');
      return false;
    }
    
    // If anonymous user, just return true without saving
    if (!user || currentCanvas.createdBy === 'anonymous') {
      toast.info('Sign in to save this canvas to your account');
      return true;
    }
    
    try {
      // Update the canvas in localStorage
      const usersStr = localStorage.getItem('canvasUsers') || '[]';
      const users = JSON.parse(usersStr);
      
      const userIndex = users.findIndex((u: any) => u.id === user.id);
      if (userIndex !== -1) {
        const canvasIndex = users[userIndex].canvases.findIndex(
          (c: Canvas) => c.id === currentCanvas.id
        );
        
        if (canvasIndex !== -1) {
          users[userIndex].canvases[canvasIndex] = currentCanvas;
          localStorage.setItem('canvasUsers', JSON.stringify(users));
          
          // Update state
          setUserCanvases(users[userIndex].canvases);
          
          toast.success('Canvas saved successfully!');
          return true;
        }
      }
      
      toast.error('Failed to save canvas: Canvas not found');
      return false;
    } catch (error) {
      console.error('Failed to save canvas:', error);
      toast.error('Failed to save canvas');
      return false;
    }
  };

  const addElement = (element: Omit<CanvasElement, 'id'>) => {
    if (!currentCanvas) return;
    
    const newElement: CanvasElement = {
      ...element,
      id: `element_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
    
    setCurrentCanvas({
      ...currentCanvas,
      elements: [...currentCanvas.elements, newElement]
    });
  };

  const updateElement = (id: string, updates: Partial<CanvasElement>) => {
    if (!currentCanvas) return;
    
    setCurrentCanvas({
      ...currentCanvas,
      elements: currentCanvas.elements.map(element => 
        element.id === id ? { ...element, ...updates } : element
      )
    });
  };

  const deleteElement = (id: string) => {
    if (!currentCanvas) return;
    
    setCurrentCanvas({
      ...currentCanvas,
      elements: currentCanvas.elements.filter(element => element.id !== id)
    });
  };

  const clearCanvas = () => {
    if (!currentCanvas) return;
    
    setCurrentCanvas({
      ...currentCanvas,
      elements: []
    });
    
    toast.success('Canvas cleared');
  };

  const exportAsImage = () => {
    if (!currentCanvas) {
      toast.error('No canvas to export');
      return;
    }
    
    // This is a placeholder - in a real app, you would use an HTML canvas or a library
    // like html-to-image to actually export the canvas as an image
    toast.success('Canvas exported as image (mock)');
  };

  const exportAsPDF = () => {
    if (!currentCanvas) {
      toast.error('No canvas to export');
      return;
    }
    
    // This is a placeholder - in a real app, you would use a library like jsPDF
    // to actually export the canvas as a PDF
    toast.success('Canvas exported as PDF (mock)');
  };

  const exportCanvasData = (): string => {
    if (!currentCanvas) {
      toast.error('No canvas to export');
      return '';
    }
    
    try {
      return JSON.stringify(currentCanvas);
    } catch (error) {
      console.error('Failed to export canvas data:', error);
      toast.error('Failed to export canvas data');
      return '';
    }
  };

  const importCanvasData = (data: string): boolean => {
    try {
      const canvas = JSON.parse(data) as Canvas;
      
      // Validate the canvas data
      if (!canvas.id || !canvas.name || !Array.isArray(canvas.elements)) {
        toast.error('Invalid canvas data');
        return false;
      }
      
      // If the user is logged in, save the imported canvas to their account
      if (user) {
        // Generate a new ID and join code to avoid conflicts
        const importedCanvas: Canvas = {
          ...canvas,
          id: `canvas_${Date.now()}`,
          joinCode: generateJoinCode(),
          createdBy: user.id,
          createdAt: new Date().toISOString()
        };
        
        // If user has reached the limit, show an error
        if (userCanvases.length >= 5) {
          toast.error('You can only have up to 5 canvases. Please delete one first.');
          return false;
        }
        
        // Update user's canvases in localStorage
        const usersStr = localStorage.getItem('canvasUsers') || '[]';
        const users = JSON.parse(usersStr);
        
        const userIndex = users.findIndex((u: any) => u.id === user.id);
        if (userIndex !== -1) {
          if (!users[userIndex].canvases) {
            users[userIndex].canvases = [];
          }
          users[userIndex].canvases.push(importedCanvas);
          localStorage.setItem('canvasUsers', JSON.stringify(users));
          
          // Update state
          setUserCanvases([...userCanvases, importedCanvas]);
          setCurrentCanvas(importedCanvas);
          
          toast.success('Canvas imported and saved to your account!');
          return true;
        }
      } else {
        // If user is not logged in, just load the canvas temporarily
        setCurrentCanvas(canvas);
        toast.success('Canvas imported (not saved to account)');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to import canvas data:', error);
      toast.error('Failed to import canvas data');
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
      generateQRCode
    }}>
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error('useCanvas must be used within a CanvasProvider');
  }
  return context;
};
