
import React, { createContext, useState, useContext, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

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
  addElement: (element: Omit<CanvasElement, 'id'>) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  clearCanvas: () => void;
  saveCurrentCanvasToAccount?: () => Promise<void>;
  createCanvas?: (name: string) => void;
  createTempCanvas?: (name: string) => void;
  loadCanvas?: (id: string) => Promise<void>;
  userCanvases?: CanvasData[];
  saveCanvas?: (canvas: CanvasData) => Promise<void>;
};

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export const CanvasProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentCanvas, setCurrentCanvas] = useState<CanvasData | null>(null);

  const addElement = useCallback((element: Omit<CanvasElement, 'id'>) => {
    if (!currentCanvas) return;

    const newElement: CanvasElement = {
      id: uuidv4(),
      ...element,
    };

    setCurrentCanvas(prevCanvas =>
      prevCanvas ? { ...prevCanvas, elements: [...prevCanvas.elements, newElement] } : { id: uuidv4(), name: 'New Canvas', elements: [newElement] }
    );
  }, [currentCanvas, setCurrentCanvas]);

  const updateElement = useCallback((id: string, updates: Partial<CanvasElement>) => {
    setCurrentCanvas(prevCanvas => {
      if (!prevCanvas) return prevCanvas;

      const updatedElements = prevCanvas.elements.map(element =>
        element.id === id ? { ...element, ...updates } : element
      );

      return { ...prevCanvas, elements: updatedElements };
    });
  }, [setCurrentCanvas]);

  const deleteElement = useCallback((id: string) => {
    setCurrentCanvas(prevCanvas => {
      if (!prevCanvas) return prevCanvas;

      const updatedElements = prevCanvas.elements.filter(element => element.id !== id);
      return { ...prevCanvas, elements: updatedElements };
    });
  }, [setCurrentCanvas]);

  const clearCanvas = useCallback(() => {
    setCurrentCanvas(prevCanvas => {
      if (!prevCanvas) return prevCanvas;
      return { ...prevCanvas, elements: [] };
    });
  }, [setCurrentCanvas]);

  // Mock implementation for saveCurrentCanvasToAccount
  const saveCurrentCanvasToAccount = useCallback(async () => {
    console.log('Mock implementation of saveCurrentCanvasToAccount');
    return Promise.resolve();
  }, []);

  const value: CanvasContextType = {
    currentCanvas,
    setCurrentCanvas,
    addElement,
    updateElement,
    deleteElement,
    clearCanvas,
    saveCurrentCanvasToAccount
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
