
import React, { useState, useEffect, useRef } from 'react';
import { useCanvas, CanvasElement } from '@/contexts/CanvasContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Maximize, Grid } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';

const TRANSITION_DURATION = 800; // ms

const PresentationMode: React.FC = () => {
  const { currentCanvas } = useCanvas();
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [currentElementIndex, setCurrentElementIndex] = useState(0);
  const [presentationPath, setPresentationPath] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const [viewportPosition, setViewportPosition] = useState({ x: 0, y: 0 });
  const [targetViewportPosition, setTargetViewportPosition] = useState({ x: 0, y: 0 });
  const [initialRender, setInitialRender] = useState(true);
  
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
  // Determine background and foreground colors based on theme
  const bgColor = theme === 'light' ? 'bg-gray-100' : 'bg-gray-900';
  const textColor = theme === 'light' ? 'text-gray-900' : 'text-white';
  const gridColor = theme === 'light' 
    ? 'linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)'
    : 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)';
  
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
    
    // Set initial viewport position to the first element
    if (path.length > 0) {
      const firstElement = currentCanvas.elements.find(el => el.id === path[0]);
      if (firstElement) {
        const position = {
          x: firstElement.x - (window.innerWidth / 2) + ((firstElement.width || 0) / 2),
          y: firstElement.y - (window.innerHeight / 2) + ((firstElement.height || 0) / 2)
        };
        setViewportPosition(position);
        setTargetViewportPosition(position);
      }
    }
  }, [currentCanvas]);
  
  // Animation effect for smooth transitions
  useEffect(() => {
    if (initialRender) {
      setInitialRender(false);
      return;
    }
    
    if (isTransitioning) {
      const animate = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp;
        }
        
        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / TRANSITION_DURATION, 1);
        
        // Easing function for smoother animation
        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
        const easedProgress = easeOutCubic(progress);
        
        const newPosition = {
          x: viewportPosition.x + (targetViewportPosition.x - viewportPosition.x) * easedProgress,
          y: viewportPosition.y + (targetViewportPosition.y - viewportPosition.y) * easedProgress
        };
        
        setViewportPosition(newPosition);
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          // Animation complete
          setViewportPosition(targetViewportPosition);
          setIsTransitioning(false);
          startTimeRef.current = null;
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isTransitioning, targetViewportPosition, viewportPosition]);
  
  const getCurrentElement = (): CanvasElement | null => {
    if (!currentCanvas || presentationPath.length === 0) return null;
    
    const currentId = presentationPath[currentElementIndex];
    return currentCanvas.elements.find(el => el.id === currentId) || null;
  };
  
  const handleNext = () => {
    if (currentElementIndex < presentationPath.length - 1 && !isTransitioning) {
      const nextIndex = currentElementIndex + 1;
      setCurrentElementIndex(nextIndex);
      
      const nextElement = currentCanvas?.elements.find(el => el.id === presentationPath[nextIndex]);
      if (nextElement) {
        setIsTransitioning(true);
        setTargetViewportPosition({
          x: nextElement.x - (window.innerWidth / 2) + ((nextElement.width || 0) / 2),
          y: nextElement.y - (window.innerHeight / 2) + ((nextElement.height || 0) / 2)
        });
      }
    }
  };
  
  const handlePrevious = () => {
    if (currentElementIndex > 0 && !isTransitioning) {
      const prevIndex = currentElementIndex - 1;
      setCurrentElementIndex(prevIndex);
      
      const prevElement = currentCanvas?.elements.find(el => el.id === presentationPath[prevIndex]);
      if (prevElement) {
        setIsTransitioning(true);
        setTargetViewportPosition({
          x: prevElement.x - (window.innerWidth / 2) + ((prevElement.width || 0) / 2),
          y: prevElement.y - (window.innerHeight / 2) + ((prevElement.height || 0) / 2)
        });
      }
    }
  };
  
  const handleOverviewToggle = () => {
    setShowOverview(!showOverview);
  };
  
  const handleJumpToElement = (index: number) => {
    if (!isTransitioning) {
      setCurrentElementIndex(index);
      setShowOverview(false);
      
      const element = currentCanvas?.elements.find(el => el.id === presentationPath[index]);
      if (element) {
        setIsTransitioning(true);
        setTargetViewportPosition({
          x: element.x - (window.innerWidth / 2) + ((element.width || 0) / 2),
          y: element.y - (window.innerHeight / 2) + ((element.height || 0) / 2)
        });
      }
    }
  };
  
  const handleExit = () => {
    if (currentCanvas) {
      localStorage.setItem('pendingCanvasState', JSON.stringify(currentCanvas));
    }
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
          e.preventDefault();
          if (!showOverview) handleNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          if (!showOverview) handlePrevious();
          break;
        case 'Escape':
          if (showOverview) {
            setShowOverview(false);
          } else if (isFullscreen) {
            toggleFullscreen();
          } else {
            handleExit();
          }
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'g':
          handleOverviewToggle();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentElementIndex, presentationPath, isFullscreen, showOverview, handleNext, handlePrevious]);
  
  const currentElement = getCurrentElement();
  
  if (!currentCanvas || !currentElement) {
    return (
      <div className={`h-screen flex items-center justify-center ${bgColor} ${textColor}`}>
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">No presentation content available</h2>
          <Button onClick={handleExit}>
            Exit Presentation
          </Button>
        </div>
      </div>
    );
  }
  
  if (showOverview) {
    // Show a grid of all slides (cards and images)
    return (
      <div className={`h-screen w-screen overflow-hidden ${bgColor} flex flex-col`}>
        <div className={`flex justify-between items-center p-4 ${theme === 'light' ? 'bg-gray-200' : 'bg-gray-800'}`}>
          <h2 className={textColor + " text-xl font-semibold"}>Presentation Overview</h2>
          <Button 
            variant="outline"
            size="sm"
            className={textColor + ` ${theme === 'light' ? 'border-gray-400 hover:bg-gray-300' : 'border-white hover:bg-gray-700'}`}
            onClick={() => setShowOverview(false)}
          >
            Back to Presentation
          </Button>
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {presentationPath.map((elementId, index) => {
              const element = currentCanvas.elements.find(el => el.id === elementId);
              if (!element) return null;
              
              return (
                <div 
                  key={elementId}
                  className={`
                    p-2 cursor-pointer rounded-lg transition-all transform
                    ${currentElementIndex === index ? 'ring-4 ring-blue-500 scale-105' : 'hover:scale-105'}
                  `}
                  onClick={() => handleJumpToElement(index)}
                >
                  <div className="bg-white rounded-md p-3 shadow-lg aspect-video flex items-center justify-center">
                    {element.type === 'card' && (
                      <div 
                        className="w-full h-full overflow-hidden"
                        style={{ backgroundColor: element.color || '#ffffff' }}
                      >
                        <div className="text-sm truncate">{element.content}</div>
                      </div>
                    )}
                    
                    {element.type === 'image' && (
                      <div className="w-full h-full flex items-center justify-center overflow-hidden">
                        <img 
                          src={element.imageUrl} 
                          alt="Slide" 
                          className="max-w-full max-h-full object-contain" 
                        />
                      </div>
                    )}
                  </div>
                  <div className={textColor + " text-center mt-1"}>Slide {index + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
  
  // Render the canvas view with transitions
  return (
    <div className={`h-screen w-screen overflow-hidden ${bgColor} flex items-center justify-center relative`}>
      <div 
        className="absolute top-4 right-4 flex space-x-2 z-10"
      >
        <Button 
          variant="outline" 
          size="sm" 
          className={`${textColor} ${theme === 'light' ? 'border-gray-400 hover:bg-gray-300' : 'border-white hover:bg-gray-800'}`}
          onClick={handleOverviewToggle}
          title="Overview (G)"
        >
          <Grid size={16} />
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          className={`${textColor} ${theme === 'light' ? 'border-gray-400 hover:bg-gray-300' : 'border-white hover:bg-gray-800'}`}
          onClick={toggleFullscreen}
          title="Fullscreen (F)"
        >
          <Maximize size={16} />
        </Button>
        
        <Button 
          variant="outline"
          size="sm"
          className={`${textColor} ${theme === 'light' ? 'border-gray-400 hover:bg-gray-300' : 'border-white hover:bg-gray-800'}`}
          onClick={handleExit}
          title="Exit (Esc)"
        >
          <X size={16} />
        </Button>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${textColor} opacity-50 hover:opacity-100 ${theme === 'light' ? 'hover:bg-gray-300' : 'hover:bg-gray-800'} z-10`}
        onClick={handlePrevious}
        disabled={currentElementIndex === 0 || isTransitioning}
      >
        <ChevronLeft size={24} />
      </Button>
      
      <div 
        className="relative w-full h-full overflow-hidden"
        style={{
          backgroundSize: '30px 30px',
          backgroundImage: gridColor,
        }}
      >
        <div
          className="absolute top-0 left-0 transform origin-top-left transition-all ease-out"
          style={{
            transform: `translate(${-viewportPosition.x}px, ${-viewportPosition.y}px)`,
          }}
        >
          {/* Render the canvas elements with focus on current element */}
          {currentCanvas.elements.map(element => (
            <div
              key={element.id}
              className="absolute"
              style={{
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                opacity: element.type === 'arrow' ? 0.7 : 1,
              }}
            >
              {element.type === 'card' && (
                <div 
                  className="w-full h-full bg-white rounded-lg shadow-2xl p-5 overflow-auto"
                  style={{ backgroundColor: element.color || '#ffffff' }}
                >
                  <div className="text-lg whitespace-pre-wrap">{element.content}</div>
                </div>
              )}
              
              {element.type === 'image' && (
                <div className="w-full h-full bg-white rounded-lg shadow-2xl p-2">
                  <img 
                    src={element.imageUrl} 
                    alt="" 
                    className="w-full h-full object-contain" 
                  />
                </div>
              )}
              
              {element.type === 'text' && (
                <div 
                  className="p-2 rounded"
                  style={{
                    color: element.color || (theme === 'light' ? '#000000' : '#ffffff'),
                    fontSize: element.fontSize ? `${element.fontSize * 1.5}px` : '24px',
                    textShadow: theme === 'dark' ? '0 0 5px rgba(0,0,0,0.7)' : 'none'
                  }}
                >
                  {element.content}
                </div>
              )}
              
              {/* Simplified arrow rendering for presentation */}
              {element.type === 'arrow' && element.fromId && element.toId && (
                <svg
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{
                    left: 0,
                    top: 0,
                    width: '100vw',
                    height: '100vh',
                    position: 'fixed',
                    zIndex: 5,
                    opacity: 0.7
                  }}
                >
                  {(() => {
                    const fromElement = currentCanvas.elements.find(el => el.id === element.fromId);
                    const toElement = currentCanvas.elements.find(el => el.id === element.toId);
                    
                    if (!fromElement || !toElement) return null;
                    
                    // Calculate center points
                    const fromCenterX = fromElement.x + (fromElement.width || 0) / 2;
                    const fromCenterY = fromElement.y + (fromElement.height || 0) / 2;
                    const toCenterX = toElement.x + (toElement.width || 0) / 2;
                    const toCenterY = toElement.y + (toElement.height || 0) / 2;
                    
                    // Calculate direction vector
                    const dx = toCenterX - fromCenterX;
                    const dy = toCenterY - fromCenterY;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    
                    if (len === 0) return null;
                    
                    const nx = dx / len;
                    const ny = dy / len;
                    
                    // Find intersection points with element boundaries
                    const fromWidth = fromElement.width || 0;
                    const fromHeight = fromElement.height || 0;
                    const toWidth = toElement.width || 0;
                    const toHeight = toElement.height || 0;
                    
                    // Calculate intersection with from element
                    let fromX, fromY;
                    
                    if (Math.abs(nx) * fromHeight > Math.abs(ny) * fromWidth) {
                      // Intersect with left or right side
                      const side = nx > 0 ? 1 : -1;
                      fromX = fromCenterX + side * fromWidth / 2;
                      fromY = fromCenterY + (ny / nx) * side * fromWidth / 2;
                    } else {
                      // Intersect with top or bottom side
                      const side = ny > 0 ? 1 : -1;
                      fromY = fromCenterY + side * fromHeight / 2;
                      fromX = fromCenterX + (nx / ny) * side * fromHeight / 2;
                    }
                    
                    // Calculate intersection with to element
                    let toX, toY;
                    
                    if (Math.abs(nx) * toHeight > Math.abs(ny) * toWidth) {
                      // Intersect with left or right side
                      const side = nx > 0 ? -1 : 1;
                      toX = toCenterX + side * toWidth / 2;
                      toY = toCenterY + (ny / nx) * side * toWidth / 2;
                    } else {
                      // Intersect with top or bottom side
                      const side = ny > 0 ? -1 : 1;
                      toY = toCenterY + side * toHeight / 2;
                      toX = toCenterX + (nx / ny) * side * toHeight / 2;
                    }
                    
                    const highlightCurrentConnection = 
                      (presentationPath[currentElementIndex] === element.fromId && 
                       presentationPath[currentElementIndex + 1] === element.toId);
                    
                    // Use appropriate arrow color based on theme
                    const arrowColor = element.color || (theme === 'light' ? '#555555' : '#FFFFFF');
                    
                    return (
                      <>
                        <line
                          x1={fromX}
                          y1={fromY}
                          x2={toX}
                          y2={toY}
                          stroke={arrowColor}
                          strokeWidth={highlightCurrentConnection ? 4 : 2}
                          markerEnd="url(#arrowhead)"
                          strokeDasharray={highlightCurrentConnection ? "none" : "5,5"}
                        />
                        <defs>
                          <marker
                            id="arrowhead"
                            markerWidth="10"
                            markerHeight="7"
                            refX="9"
                            refY="3.5"
                            orient="auto"
                          >
                            <polygon
                              points="0 0, 10 3.5, 0 7"
                              fill={arrowColor}
                            />
                          </marker>
                        </defs>
                      </>
                    );
                  })()}
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        className={`absolute right-4 top-1/2 transform -translate-y-1/2 ${textColor} opacity-50 hover:opacity-100 ${theme === 'light' ? 'hover:bg-gray-300' : 'hover:bg-gray-800'} z-10`}
        onClick={handleNext}
        disabled={currentElementIndex === presentationPath.length - 1 || isTransitioning}
      >
        <ChevronRight size={24} />
      </Button>
      
      <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 ${textColor} ${theme === 'light' ? 'bg-gray-200' : 'bg-black'} bg-opacity-50 px-3 py-1 rounded-full`}>
        {currentElementIndex + 1} / {presentationPath.length}
      </div>
    </div>
  );
};

export default PresentationMode;
