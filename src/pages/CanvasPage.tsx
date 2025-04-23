import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, Save } from 'lucide-react';
import CanvasEditor from '@/components/canvas/CanvasEditor';
import CanvasShare from '@/components/canvas/CanvasShare';
import { useCanvas } from '@/contexts/CanvasContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { Helmet } from 'react-helmet';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

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
    const handleForceRefresh = (event) => {
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
          //console.log('Loading pending canvas state:', canvasData);
          
          // Modified logic: Only load if it's clearly the same canvas with updates
          // or if we have no canvas yet
          const shouldLoadPending = 
            !currentCanvas || 
            (currentCanvas && currentCanvas.id === canvasData.id && 
             canvasData.elements && canvasData.elements.length >= (currentCanvas.elements?.length || 0));
          
          if (shouldLoadPending) {
            //console.log('Setting canvas from pending state, elements count:', canvasData.elements.length);
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
      
      <div className="h-screen flex flex-col dark:bg-zinc-900">
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
            
            <CanvasShare />
            
            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              className="bg-gray-700 text-white hover:bg-gray-800 text-xs md:text-sm"
              onClick={() => navigate('/')}
            >
              {isMobile ? "Exit" : "Back to Home"}
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <CanvasEditor readOnly={isReadOnly} />
        </div>
      </div>
    </ThemeProvider>
  );
};

export default CanvasPage;
