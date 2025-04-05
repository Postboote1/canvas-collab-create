
import React, { useState, useEffect } from 'react';
import { useCanvas, CanvasElement } from '@/contexts/CanvasContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Maximize } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PresentationMode: React.FC = () => {
  const { currentCanvas } = useCanvas();
  const navigate = useNavigate();
  
  const [currentElementIndex, setCurrentElementIndex] = useState(0);
  const [presentationPath, setPresentationPath] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  useEffect(() => {
    if (!currentCanvas) return;
    
    // Build a presentation path based on arrows
    const buildPresentationPath = () => {
      const path: string[] = [];
      const arrows = currentCanvas.elements.filter(el => el.type === 'arrow');
      
      // Start with any card element if no arrows
      if (arrows.length === 0) {
        const firstCard = currentCanvas.elements.find(
          el => el.type === 'card' || el.type === 'image'
        );
        if (firstCard) {
          path.push(firstCard.id);
        }
        return path;
      }
      
      // Find starting elements (those that are only source, never destination)
      const allDestinations = new Set(arrows.map(a => a.toId));
      const possibleStarts = arrows
        .filter(a => !allDestinations.has(a.fromId))
        .map(a => a.fromId);
      
      // Use the first start element or any card if no clear start
      if (possibleStarts.length > 0) {
        path.push(possibleStarts[0]!);
      } else {
        const firstCard = currentCanvas.elements.find(
          el => el.type === 'card' || el.type === 'image'
        );
        if (firstCard) {
          path.push(firstCard.id);
        }
        return path;
      }
      
      // Build the path by following arrows
      let current = path[0];
      while (current) {
        const nextArrow = arrows.find(a => a.fromId === current);
        if (!nextArrow) break;
        
        const nextElement = nextArrow.toId;
        if (path.includes(nextElement)) break; // Avoid cycles
        
        path.push(nextElement);
        current = nextElement;
      }
      
      return path;
    };
    
    const path = buildPresentationPath();
    setPresentationPath(path);
    setCurrentElementIndex(0);
  }, [currentCanvas]);
  
  const getCurrentElement = (): CanvasElement | null => {
    if (!currentCanvas || presentationPath.length === 0) return null;
    
    const currentId = presentationPath[currentElementIndex];
    return currentCanvas.elements.find(el => el.id === currentId) || null;
  };
  
  const handleNext = () => {
    if (currentElementIndex < presentationPath.length - 1) {
      setCurrentElementIndex(currentElementIndex + 1);
    }
  };
  
  const handlePrevious = () => {
    if (currentElementIndex > 0) {
      setCurrentElementIndex(currentElementIndex - 1);
    }
  };
  
  const handleExit = () => {
    navigate('/canvas');
  };
  
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          handleNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          handlePrevious();
          break;
        case 'Escape':
          if (isFullscreen) {
            toggleFullscreen();
          } else {
            handleExit();
          }
          break;
        case 'f':
          toggleFullscreen();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentElementIndex, presentationPath, isFullscreen]);
  
  const currentElement = getCurrentElement();
  
  if (!currentCanvas || !currentElement) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No presentation content available</h2>
          <Button onClick={handleExit}>
            Exit Presentation
          </Button>
        </div>
      </div>
    );
  }
  
  // Render the current element full screen
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 flex items-center justify-center relative">
      <div 
        className="absolute top-4 right-4 flex space-x-2 z-10"
      >
        <Button 
          variant="outline" 
          size="sm" 
          className="text-white border-white hover:bg-gray-800"
          onClick={toggleFullscreen}
        >
          <Maximize size={16} />
        </Button>
        
        <Button 
          variant="outline"
          size="sm"
          className="text-white border-white hover:bg-gray-800"
          onClick={handleExit}
        >
          <X size={16} />
        </Button>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white opacity-50 hover:opacity-100 hover:bg-gray-800"
        onClick={handlePrevious}
        disabled={currentElementIndex === 0}
      >
        <ChevronLeft size={24} />
      </Button>
      
      <div className="max-w-3xl max-h-3xl flex items-center justify-center p-8">
        {currentElement.type === 'card' && (
          <div 
            className="bg-white rounded-lg p-6 shadow-2xl max-w-2xl mx-auto"
            style={{
              width: currentElement.width,
              minHeight: currentElement.height
            }}
          >
            <div className="text-xl whitespace-pre-wrap break-words">
              {currentElement.content}
            </div>
          </div>
        )}
        
        {currentElement.type === 'image' && (
          <div className="p-6 bg-white rounded-lg shadow-2xl">
            <img 
              src={currentElement.imageUrl} 
              alt="Presentation slide" 
              className="max-w-2xl max-h-2xl object-contain"
            />
          </div>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white opacity-50 hover:opacity-100 hover:bg-gray-800"
        onClick={handleNext}
        disabled={currentElementIndex === presentationPath.length - 1}
      >
        <ChevronRight size={24} />
      </Button>
      
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
        {currentElementIndex + 1} / {presentationPath.length}
      </div>
    </div>
  );
};

export default PresentationMode;
