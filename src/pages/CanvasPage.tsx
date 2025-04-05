
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

const CanvasPage: React.FC = () => {
  const { currentCanvas, saveCurrentCanvasToAccount } = useCanvas();
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  
  // Redirect if no canvas is loaded
  useEffect(() => {
    if (!currentCanvas) {
      navigate('/create-temp');
    }
  }, [currentCanvas, navigate]);
  
  if (!currentCanvas) {
    return <div>Loading...</div>;
  }
  
  const isCreator = user && currentCanvas.createdBy === user.id;
  const isAnonymous = currentCanvas.createdBy === 'anonymous';
  
  const handleSaveToAccount = async () => {
    if (!isLoggedIn()) {
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
                className="flex items-center gap-1"
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
              className="flex items-center gap-1"
              onClick={() => navigate('/presentation')}
            >
              <Play size={16} />
              Present
            </Button>
            
            <CanvasShare />
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
            >
              Exit
            </Button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <CanvasEditor readOnly={!isAnonymous && !isCreator} />
        </div>
      </div>
    </ThemeProvider>
  );
};

export default CanvasPage;
