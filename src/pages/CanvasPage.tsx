import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, Save } from 'lucide-react';
import CanvasEditor from '@/components/canvas/CanvasEditor';
import CanvasShare from '@/components/canvas/CanvasShare';
import { useCanvas } from '@/contexts/CanvasContext';
import { useAuth } from '@/contexts/AuthContext';
import { Helmet } from 'react-helmet';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { toast } from 'sonner';

const CanvasPage: React.FC = () => {
  const { currentCanvas, saveCurrentCanvasToAccount, setCurrentCanvas } = useCanvas();
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  
  // Redirect if no canvas is loaded
  useEffect(() => {
    if (!currentCanvas) {
      navigate('/create-temp');
    }
  }, [currentCanvas, navigate]);

  // Update the useEffect that loads the pending canvas
  useEffect(() => {
    // More robust check for pending canvas state
    const loadPendingCanvas = () => {
      try {
        const pendingCanvasState = localStorage.getItem('pendingCanvasState');
        
        if (pendingCanvasState) {
          const canvasData = JSON.parse(pendingCanvasState);
          console.log('Loading pending canvas state:', canvasData);
          
          // Only load the pending canvas if:
          // 1. We don't have a current canvas, OR
          // 2. The current canvas is empty but the pending one has elements, OR
          // 3. The current canvas has a different ID from the pending one
          const shouldLoadPending = 
            !currentCanvas || 
            (currentCanvas.id !== canvasData.id) || 
            (currentCanvas.elements.length === 0 && canvasData.elements.length > 0);
          
          if (shouldLoadPending) {
            console.log('Setting canvas from pending state');
            setCurrentCanvas(canvasData);
            toast.success(`Canvas "${canvasData.name}" loaded`);
            
            // Remove the pending state after successfully loading it
            setTimeout(() => {
              localStorage.removeItem('pendingCanvasState');
            }, 2000);
          }
        }
      } catch (error) {
        console.error('Error loading pending canvas state:', error);
        toast.error('Failed to load shared canvas');
      }
    };
    
    // Run once on mount
    loadPendingCanvas();
    
    // Also run when currentCanvas changes
    const intervalId = setInterval(loadPendingCanvas, 2000);
    
    return () => clearInterval(intervalId);
  }, [currentCanvas, setCurrentCanvas]);
  
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
        <div className="bg-card border-b py-2 px-4 flex items-center justify-between dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold truncate max-w-xs">
              {currentCanvas.name}
            </h1>
            {isAnonymous && (
              <span className="text-sm text-muted-foreground">(Temporary)</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {isAnonymous && (
              <Button
                variant="default"
                size="sm"
                className="flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleSaveToAccount}
                disabled={isSaving}
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save to Account'}
              </Button>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 bg-blue-500 text-white hover:bg-blue-600"
              onClick={() => navigate('/presentation')}
            >
              <Play size={16} />
              Present
            </Button>
            
            <CanvasShare />
            
            <Button
              variant="outline"
              size="sm"
              className="bg-gray-700 text-white hover:bg-gray-800"
              onClick={() => navigate('/')}
            >
              Exit
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
