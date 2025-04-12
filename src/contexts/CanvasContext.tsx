
import React, { createContext, useState, useContext, useCallback } from 'react';
import { v4 as uuidv4 } from '@types/uuid';

export type CanvasElement = {
  id: string;
  type: 'card' | 'text' | 'image' | 'arrow' | 'drawing' | 'shape' | 'frame';
  x: number;
  y: number;
  width?: number;
  height?: number;
  content?: string;
  color?: string;
  fontSize?: number;
  points?: Array<{ x: number; y: number }>;
  fromId?: string;
  toId?: string;
  imageUrl?: string;
  shapeType?: 'circle' | 'triangle' | 'diamond';
};

export type CanvasData = {
  id: string;
  name: string;
  elements: CanvasElement[];
  createdBy?: string;
  createdAt?: string;
  joinCode?: string;
  isInfinite?: boolean;
};

type CanvasContextType = {
  currentCanvas: CanvasData | null;
  setCurrentCanvas: React.Dispatch<React.SetStateAction<CanvasData | null>>;
  addElement: (element: Omit<CanvasElement, 'id'>) => CanvasElement;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  clearCanvas: () => void;
  saveCurrentCanvasToAccount?: () => Promise<void>;
  createCanvas?: (name: string, isInfinite: boolean) => Promise<CanvasData>;
  createTempCanvas?: (name: string, isInfinite: boolean) => Promise<CanvasData>;
  loadCanvas?: (id: string) => Promise<boolean>;
  userCanvases?: CanvasData[];
  saveCanvas?: () => Promise<void>;
};

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentCanvas, setCurrentCanvas] = useState<CanvasData | null>(null);
  const [userCanvases, setUserCanvases] = useState<CanvasData[]>([]);

  const addElement = useCallback((element: Omit<CanvasElement, 'id'>) => {
    if (!currentCanvas) return {} as CanvasElement; // Return empty element as fallback

    const newElement: CanvasElement = {
      id: uuidv4(),
      ...element,
    };

    setCurrentCanvas(prevCanvas =>
      prevCanvas ? { ...prevCanvas, elements: [...prevCanvas.elements, newElement] } : { id: uuidv4(), name: 'New Canvas', elements: [newElement] }
    );
    
    return newElement;
  }, [currentCanvas]);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setCurrentCanvas(prevCanvas => {
      if (!prevCanvas) return prevCanvas;

      const updatedElements = prevCanvas.elements.map(element =>
        element.id === id ? { ...element, ...updates } : element
      );

      return { ...prevCanvas, elements: updatedElements };
    });
  }, []);

  const deleteElement = useCallback((id: string) => {
    setCurrentCanvas(prevCanvas => {
      if (!prevCanvas) return prevCanvas;

      const updatedElements = prevCanvas.elements.filter(element => element.id !== id);
      return { ...prevCanvas, elements: updatedElements };
    });
  }, []);

  const clearCanvas = useCallback(() => {
    setCurrentCanvas(prevCanvas => {
      if (!prevCanvas) return prevCanvas;
      return { ...prevCanvas, elements: [] };
    });
  }, []);

  // Mock implementations for canvas operations
  const saveCurrentCanvasToAccount = useCallback(async () => {
    console.log('Mock implementation of saveCurrentCanvasToAccount');
    return Promise.resolve();
  }, []);

  const saveCanvas = useCallback(async () => {
    console.log('Mock implementation of saveCanvas');
    if (currentCanvas) {
      localStorage.setItem('pendingCanvasState', JSON.stringify(currentCanvas));
    }
    return Promise.resolve();
  }, [currentCanvas]);

  const createCanvas = useCallback(async (name: string, isInfinite: boolean): Promise<CanvasData> => {
    console.log(`Creating canvas: ${name}, infinite: ${isInfinite}`);
    const newCanvas: CanvasData = {
      id: uuidv4(),
      name,
      elements: [],
      createdBy: 'user',
      createdAt: new Date().toISOString(),
      joinCode: `JOIN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      isInfinite
    };
    
    setCurrentCanvas(newCanvas);
    setUserCanvases(prev => [...prev, newCanvas]);
    
    // Store in localStorage
    localStorage.setItem('pendingCanvasState', JSON.stringify(newCanvas));
    
    return newCanvas;
  }, []);

  const createTempCanvas = useCallback(async (name: string, isInfinite: boolean): Promise<CanvasData> => {
    console.log(`Creating temp canvas: ${name}, infinite: ${isInfinite}`);
    const newCanvas: CanvasData = {
      id: uuidv4(),
      name,
      elements: [],
      createdBy: 'anonymous',
      createdAt: new Date().toISOString(),
      joinCode: `TEMP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      isInfinite
    };
    
    setCurrentCanvas(newCanvas);
    
    // Store in localStorage
    localStorage.setItem('pendingCanvasState', JSON.stringify(newCanvas));
    
    return newCanvas;
  }, []);

  const loadCanvas = useCallback(async (id: string): Promise<boolean> => {
    const canvas = userCanvases.find(c => c.id === id);
    if (canvas) {
      setCurrentCanvas(canvas);
      return true;
    }
    return false;
  }, [userCanvases]);

  const value: CanvasContextType = {
    currentCanvas,
    setCurrentCanvas,
    addElement,
    updateElement,
    deleteElement,
    clearCanvas,
    saveCurrentCanvasToAccount,
    createCanvas,
    createTempCanvas,
    loadCanvas,
    userCanvases,
    saveCanvas
  };

  return (
    <CanvasContext.Provider value={value}>
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
