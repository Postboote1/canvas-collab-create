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

    // Build a complete presentation path with proper path navigation
    const buildPresentationPath = () => {
      const result: string[] = [];
      const arrows = currentCanvas.elements.filter(el => el.type === 'arrow');
      
      // If no arrows, just return first card or image
      if (arrows.length === 0) {
        const firstCard = currentCanvas.elements.find(
          el => el.type === 'card' || el.type === 'image'
        );
        if (firstCard) {
          result.push(firstCard.id);
        }
        return result;
      }
      
      // Find starting elements (those that are only source, never destination)
      const allDestinations = new Set(arrows.map(a => a.toId));
      const possibleStarts = arrows
        .filter(a => !allDestinations.has(a.fromId))
        .map(a => a.fromId);
      
      // Use the first start element or any card if no clear start
      let startNode: string | undefined;
      if (possibleStarts.length > 0) {
        startNode = possibleStarts[0]!;
      } else {
        const firstCard = currentCanvas.elements.find(
          el => el.type === 'card' || el.type === 'image'
        );
        if (firstCard) {
          startNode = firstCard.id;
        } else {
          return result;
        }
      }
      
      // Build a map of nodes to their outgoing connections
      const outgoingArrows = new Map<string, Array<{toId: string, angle: number}>>();
      
      // Calculate angle for each arrow
      arrows.forEach(arrow => {
        if (!arrow.fromId || !arrow.toId) return;
        
        const fromElement = currentCanvas.elements.find(el => el.id === arrow.fromId);
        const toElement = currentCanvas.elements.find(el => el.id === arrow.toId);
        
        if (!fromElement || !toElement) return;
        
        // Calculate center points of elements
        const fromCenterX = fromElement.x + (fromElement.width || 0) / 2;
        const fromCenterY = fromElement.y + (fromElement.height || 0) / 2;
        const toCenterX = toElement.x + (toElement.width || 0) / 2;
        const toCenterY = toElement.y + (toElement.height || 0) / 2;
        
        const dx = toCenterX - fromCenterX;
        const dy = toCenterY - fromCenterY;

        // Use a modified angle calculation that prioritizes horizontal direction
        // This ensures left arrows are always sorted before right arrows
        let angle = Math.atan2(toCenterY - fromCenterY, toCenterX - fromCenterX) * (180 / Math.PI);

        // Adjust angles to prioritize left-right ordering
        // Make leftward angles smaller than rightward angles
        if (dx < 0) { // If arrow points left
          angle = angle - 360; // Make leftward angles smaller
        }
        
        // Add touch detection to improve user experience on mobile
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouchDevice) {
          // For touch devices, we want to favor vertical movement less
          // This makes it easier to navigate presentations on mobile
          if (Math.abs(dx) > Math.abs(dy) * 0.8) {
            // More horizontal - prioritize even more for touch
            angle = angle * 0.7; // Reduce the overall angle to prioritize horizontal
          }
        }
        
        // Add to outgoingArrows map
        if (!outgoingArrows.has(arrow.fromId)) {
          outgoingArrows.set(arrow.fromId, []);
        }
        outgoingArrows.get(arrow.fromId)!.push({ toId: arrow.toId, angle });
      });
      
      // Sort outgoing arrows by angle (leftmost first)
      outgoingArrows.forEach((arrows, nodeId) => {
        arrows.sort((a, b) => a.angle - b.angle);
      });
      
      // Track visited nodes and forks (nodes with multiple outgoing arrows)
      const visited = new Set<string>();
      const forks = new Map<string, number>(); // Maps fork nodes to their index in result array
  
      // Build path with fork handling and complete path traversal
      const buildPath = (nodeId: string) => {
        if (!nodeId) return;
        
        // Add current node to result if not visited
        if (!result.includes(nodeId)) {
          result.push(nodeId);
        }
        visited.add(nodeId);
        
        // Get outgoing connections
        const outgoing = outgoingArrows.get(nodeId) || [];
        
        // If this is a fork (multiple outgoing arrows), record its position
        if (outgoing.length > 1) {
          forks.set(nodeId, result.length - 1);
        }
        
        // If no outgoing connections, we're at an end node
        if (outgoing.length === 0) {
          return;
        }
        
        // Process each outgoing arrow
        for (let i = 0; i < outgoing.length; i++) {
          const { toId } = outgoing[i];
          
          // If not the first arrow and this is a fork node
          // Return to the fork node before following this path
          if (i > 0) {
            const forkId = nodeId;
            const forkIndex = forks.get(forkId)!;
            
            // Add the fork node again to return to it
            result.push(forkId);
          }
          
          // Follow this path completely
          if (!visited.has(toId)) {
            buildPath(toId);
          }
        }
      };
      
      // Start building the path
      buildPath(startNode);
      
      return result;
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
    //if (currentCanvas) {
    //  localStorage.setItem('pendingCanvasState', JSON.stringify(currentCanvas));
    //}
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
    <div className="h-screen w-screen overflow-hidden bg-gray-100 flex items-center justify-center relative canvas-theme-aware">      {/* Top UI controls */}
      <div className="absolute top-4 right-4 flex space-x-2 z-50">
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
      
      {/* Navigation buttons */}
      <Button
        variant="ghost"
        size="icon"
        className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${textColor} opacity-50 hover:opacity-100 ${theme === 'light' ? 'hover:bg-gray-300' : 'hover:bg-gray-800'} z-50`}
        onClick={handlePrevious}
        disabled={currentElementIndex === 0 || isTransitioning}
      >
        <ChevronLeft size={24} />
      </Button>
      
      <Button
        variant="ghost"
        size="icon"
        className={`absolute right-4 top-1/2 transform -translate-y-1/2 ${textColor} opacity-50 hover:opacity-100 ${theme === 'light' ? 'hover:bg-gray-300' : 'hover:bg-gray-800'} z-50`}
        onClick={handleNext}
        disabled={currentElementIndex === presentationPath.length - 1 || isTransitioning}
      >
        <ChevronRight size={24} />
      </Button>
      
      {/* Canvas container */}
      <div 
        className="relative w-full h-full overflow-hidden"
        style={{
          backgroundSize: '30px 30px',
          backgroundImage: gridColor,
        }}
      >
        {/* Global arrow marker definition */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
          <defs>
            <marker
              id="presentation-arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="currentColor" />
            </marker>
          </defs>
        </svg>
        
        {/* Canvas transformation container */}
        <div
          className="absolute top-0 left-0 transform origin-top-left transition-all ease-out"
          style={{
            transform: `translate(${-viewportPosition.x}px, ${-viewportPosition.y}px)`,
          }}
        >
          {/* Canvas elements */}
          {currentCanvas.elements.map(element => (
            <div
              key={element.id}
              className="absolute"
              style={{
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
                opacity: 1,
                zIndex: element.type === 'arrow' ? 0 : 1
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
              
              {element.type === 'drawing' && element.points && element.points.length > 0 && (
                <svg 
                  className="absolute top-0 left-0 w-full h-full pointer-events-none" 
                  style={{
                    left: 0, 
                    top: 0, 
                    width: '100%', 
                    height: '100%',
                    overflow: 'visible'
                  }}
                >
                  <polyline
                    points={element.points.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={element.color || (theme === 'light' ? '#000000' : '#FFFFFF')}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              )}
              
              {element.type === 'shape' && (
                <svg className="w-full h-full pointer-events-none">
                  {element.shapeType === 'circle' && (
                    <ellipse
                      cx={(element.width || 100) / 2}
                      cy={(element.height || 100) / 2}
                      rx={(element.width || 100) / 2 - 5}
                      ry={(element.height || 100) / 2 - 5}
                      fill={element.color || '#FFFFFF'} 
                      stroke={theme === 'light' ? '#000000' : '#FFFFFF'}
                      strokeWidth="2"
                    />
                  )}
                  {element.shapeType === 'triangle' && (
                    <polygon
                      points={`${(element.width || 100) / 2},5 5,${(element.height || 100) - 5} ${(element.width || 100) - 5},${(element.height || 100) - 5}`}
                      fill={element.color || '#FFFFFF'}
                      stroke={theme === 'light' ? '#000000' : '#FFFFFF'}
                      strokeWidth="2"
                    />
                  )}
                  {element.shapeType === 'diamond' && (
                    <polygon
                      points={`${(element.width || 100) / 2},5 ${(element.width || 100) - 5},${(element.height || 100) / 2} ${(element.width || 100) / 2},${(element.height || 100) - 5} 5,${(element.height || 100) / 2}`}
                      fill={element.color || '#FFFFFF'}
                      stroke={theme === 'light' ? '#000000' : '#FFFFFF'}
                      strokeWidth="2"
                    />
                  )}
                </svg>
              )}
            </div>
          ))}
          
          {/* ARROW OVERLAY LAYER - Separate to ensure arrows appear above elements */}
          <svg 
            className="absolute top-0 left-0 w-full h-full"
            style={{
              position: 'absolute',
              width: '100000px', 
              height: '100000px',
              overflow: 'visible',
              zIndex: 20,
              pointerEvents: 'none'
            }}
          >
            {currentCanvas.elements
              .filter(element => element.type === 'arrow' && element.fromId && element.toId)
              .map(arrow => {
                const fromElement = currentCanvas.elements.find(el => el.id === arrow.fromId);
                const toElement = currentCanvas.elements.find(el => el.id === arrow.toId);
                
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
                  (presentationPath[currentElementIndex] === arrow.fromId && 
                  presentationPath[currentElementIndex + 1] === arrow.toId);
                
                // Use appropriate arrow color based on theme
                const arrowColor = arrow.color || (theme === 'light' ? '#555555' : '#FFFFFF');
                
                return (
                  <line
                    key={`arrow-${arrow.id}`}
                    x1={fromX}
                    y1={fromY}
                    x2={toX}
                    y2={toY}
                    stroke={arrowColor}
                    strokeWidth={highlightCurrentConnection ? 2 : 1}
                    markerEnd="url(#presentation-arrowhead)"
                    strokeDasharray={highlightCurrentConnection ? "none" : "5,5"}
                    style={{ color: arrowColor }}
                  />
                );
              })}
          </svg>
        </div>
      </div>
      
      {/* Slide counter */}
      <div className={`absolute bottom-4 left-1/2 transform -translate-x-1/2 ${textColor} ${theme === 'light' ? 'bg-gray-200' : 'bg-black'} bg-opacity-50 px-3 py-1 rounded-full z-50`}>
        {currentElementIndex + 1} / {presentationPath.length}
      </div>
    </div>
  );
};
export default PresentationMode;
