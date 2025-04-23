import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, Save, Hand, Fingerprint } from 'lucide-react'; // Replace Touch with Fingerprint
import CanvasEditor from '@/components/canvas/CanvasEditor';
import CanvasShare from '@/components/canvas/CanvasShare';
import { useCanvas } from '@/contexts/CanvasContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { Helmet } from 'react-helmet';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTouchGesture } from '@/hooks/use-touch-gesture';

const CanvasPage: React.FC = () => {
  const { currentCanvas, saveCurrentCanvasToAccount, setCurrentCanvas } = useCanvas();
  const { user, isLoggedIn } = useAuth();
  const { isConnected } = useWebSocket();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const isMobile = useIsMobile();
  
  // Move these state hooks to the top level of the component
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [lastLoadedCanvasId, setLastLoadedCanvasId] = useState<string | null>(null);
  const [touchDrawingMode, setTouchDrawingMode] = useState(false);
  
  // Refs for touch gesture handling
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasScale = useRef(1);
  const canvasPosition = useRef({ x: 0, y: 0 });
  
  // Detect if we're using a touch device
  const isTouchDevice = typeof window !== 'undefined' && 
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  
  // Implement touch gestures for the canvas
  useTouchGesture(canvasContainerRef, {
    onPinch: (scale, center) => {
      // Update scale through the global canvas interface
      if (typeof window !== 'undefined' && window.__canvasInterface) {
        window.__canvasInterface.setScale(canvasScale.current * scale);
      }
    },
    onPan: (dx, dy, event) => {
      // Pan the canvas if we're not in drawing mode, otherwise let the drawing happen
      if (!touchDrawingMode && typeof window !== 'undefined' && window.__canvasInterface) {
        // If we have 2 or more touches, let the pinch zoom handle it
        if (event.touches.length >= 2) return;
        
        window.__canvasInterface.pan(dx, dy);
        canvasPosition.current = { 
          x: canvasPosition.current.x + dx, 
          y: canvasPosition.current.y + dy 
        };
      }
    },
    onDoubleTap: (x, y) => {
      // Double tap to zoom in
      if (typeof window !== 'undefined' && window.__canvasInterface) {
        // Calculate target scale (toggle between 1 and 2)
        const targetScale = canvasScale.current === 1 ? 2 : 1;
        window.__canvasInterface.setScale(targetScale);
        canvasScale.current = targetScale;
      }
    },
    onLongPress: (x, y) => {
      // Long press to enter selection mode
      if (!touchDrawingMode && typeof window !== 'undefined' && window.__canvasInterface) {
        window.__canvasInterface.setActiveTool('select');
        toast.success('Selection mode activated', { id: 'selection-mode' });
      }
    }
  });
  
  // Hook into canvas scale changes
  useEffect(() => {
    // Create a global hook for other components to interact with canvas
    if (typeof window !== 'undefined') {
      window.__canvasInterface = {
        setScale: (scale: number) => {
          // Handle scale changes from gesture controller
          canvasScale.current = scale;
          // Dispatch a custom event that the canvas editor can listen to
          window.dispatchEvent(new CustomEvent('canvas-scale', { detail: { scale } }));
        },
        pan: (dx: number, dy: number) => {
          // Handle pan changes from gesture controller
          window.dispatchEvent(new CustomEvent('canvas-pan', { detail: { dx, dy } }));
        },
        setActiveTool: (tool: string) => {
          // Handle tool changes from gesture controller
          window.dispatchEvent(new CustomEvent('canvas-tool', { detail: { tool } }));
        }
      };
    }
    
    return () => {
      // Clean up the global interface
      if (typeof window !== 'undefined') {
        delete window.__canvasInterface;
      }
    };
  }, []);
  
  // Redirect if no canvas is loaded
  useEffect(() => {
    if (!currentCanvas) {
      navigate('/create-temp');
    }
  }, [currentCanvas, navigate]);

  useEffect(() => {
    const handleCanvasUpdate = (e: Event) => {
      try {
        const pendingCanvasStr = localStorage.getItem('pendingCanvasState');
        if (pendingCanvasStr) {
          const canvasData = JSON.parse(pendingCanvasStr);
          console.log('Force updating canvas from localStorage after element update');
          setCurrentCanvas(canvasData);
        }
      } catch (error) {
        console.error('Error loading canvas during forced update:', error);
      }
    };
  
    window.addEventListener('canvas-update', handleCanvasUpdate);
    return () => {
      window.removeEventListener('canvas-update', handleCanvasUpdate);
    };
  }, [setCurrentCanvas]);

  useEffect(() => {
    const handleForceRefresh = (event: any) => {
      console.log("Force refresh event received:", event.detail);
      try {
        // Wait a brief moment to ensure all operations are complete
        setTimeout(() => {
          // Load the latest canvas data from localStorage
          const pendingCanvasStr = localStorage.getItem('pendingCanvasState');
          if (pendingCanvasStr) {
            const canvasData = JSON.parse(pendingCanvasStr);
            
            // Force update the canvas context
            setCurrentCanvas(canvasData);
            
            // Log the change for debugging
            console.log(`Canvas refreshed after ${event.detail.operation} operation. Elements: ${canvasData.elements.length}`);
          }
        }, 50);
      } catch (error) {
        console.error('Error during forced canvas refresh:', error);
      }
    };
  
    window.addEventListener('force-canvas-refresh', handleForceRefresh);
    return () => {
      window.removeEventListener('force-canvas-refresh', handleForceRefresh);
    };
  }, [setCurrentCanvas]);

  // Update the useEffect that loads the pending canvas
  useEffect(() => {
    // Don't declare state hooks inside useEffect
    const loadPendingCanvas = () => {
      try {
        // Only load from pending canvas if we don't already have a valid canvas
        // or if it appears to be the same canvas with updates
        const pendingCanvasState = localStorage.getItem('pendingCanvasState');
        
        if (pendingCanvasState) {
          const canvasData = JSON.parse(pendingCanvasState);
          
          // Modified logic: Only load if it's clearly the same canvas with updates
          // or if we have no canvas yet
          const shouldLoadPending = 
            !currentCanvas || 
            (currentCanvas && currentCanvas.id === canvasData.id && 
             canvasData.elements && canvasData.elements.length >= (currentCanvas.elements?.length || 0));
          
          if (shouldLoadPending) {
            setCurrentCanvas(canvasData);
            setLastLoadedCanvasId(canvasData.id);
            
            toast.success(`Canvas "${canvasData.name}" loaded with ${canvasData.elements.length} elements`, {
              id: 'canvas-loaded-toast',
              duration: 3000
            });
          }
        }
      } catch (error) {
        console.error('Error loading pending canvas state:', error);
        setLoadAttempts(prev => prev + 1);
        
        if (loadAttempts > 5) {
          toast.error('Failed to load shared canvas');
        }
      }
    };
    
    // Run once on mount
    loadPendingCanvas();
    
    // Also run periodically to catch any updates
    const intervalId = setInterval(loadPendingCanvas, 2000);
    
    return () => clearInterval(intervalId);
  }, [currentCanvas, setCurrentCanvas, isConnected, loadAttempts, lastLoadedCanvasId]); // Add new dependencies
  
  if (!currentCanvas) {
    return <div>Loading...</div>;
  }
  
  // Set readOnly to false for all users to allow collaborative editing
  const isReadOnly = false; // Let everyone edit the canvas
  
  // Check if the canvas was created anonymously
  const isAnonymous = currentCanvas.createdBy === 'anonymous';

  const handleSaveToAccount = async () => {
    if (!isLoggedIn()) {
      toast.info('Please log in to save this canvas');
      navigate('/login');
      return;
    }
    
    setIsSaving(true);
    try {
      await saveCurrentCanvasToAccount();
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <ThemeProvider>
      <Helmet>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <title>{currentCanvas.name} - Canvas Collaboration</title>
      </Helmet>
      
      <div className="h-screen flex flex-col dark:bg-zinc-900" ref={canvasContainerRef}>
        <div className="bg-card border-b py-2 px-2 md:px-4 flex items-center justify-between dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <h1 className="font-medium text-sm md:text-base truncate max-w-[150px] md:max-w-xs">
              {currentCanvas.name}
            </h1>
            {isAnonymous && (
              <span className="text-xs md:text-sm text-muted-foreground">(Temporary)</span>
            )}
          </div>
          
          <div className="flex items-center gap-1 md:gap-2 flex-wrap">
            {isAnonymous && (
              <Button
                variant="default"
                size={isMobile ? "sm" : "default"}
                className="flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs md:text-sm"
                onClick={handleSaveToAccount}
                disabled={isSaving}
              >
                <Save size={isMobile ? 14 : 16} />
                {isMobile ? '' : (isSaving ? 'Saving...' : 'Save to Account')}
              </Button>
            )}
            
            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              className="flex items-center gap-1 bg-blue-500 text-white hover:bg-blue-600 text-xs md:text-sm"
              onClick={() => navigate('/presentation')}
            >
              <Play size={isMobile ? 14 : 16} />
              {!isMobile && "Present"}
            </Button>
            
            {/* Touch mode toggle for mobile */}
            {isTouchDevice && (
              <Button
                variant={touchDrawingMode ? "default" : "outline"}
                size={isMobile ? "sm" : "default"}
                className={`flex items-center gap-1 text-xs md:text-sm ${
                  touchDrawingMode 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-gray-500 text-white hover:bg-gray-600'
                }`}
                onClick={() => setTouchDrawingMode(!touchDrawingMode)}
              >
                {touchDrawingMode ? <Fingerprint size={isMobile ? 14 : 16} /> : <Hand size={isMobile ? 14 : 16} />}
                {!isMobile && (touchDrawingMode ? "Draw" : "Pan")}
              </Button>
            )}
            
            <CanvasShare />
            
            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              className="bg-gray-700 text-white hover:bg-gray-800 text-xs md:text-sm"
              onClick={() => navigate('/')}
            >
              {isMobile ? "Exit" : "Exit"}
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden canvas-editor-container">
          <CanvasEditor 
            readOnly={isReadOnly} 
            touchDrawingMode={touchDrawingMode}
          />
          
          {/* Touch drawing mode indicator */}
          {isTouchDevice && touchDrawingMode && (
            <div className="touch-draw-mode">
              Touch Drawing Mode
            </div>
          )}
        </div>
      </div>
    </ThemeProvider>
  );
};

export default CanvasPage;
