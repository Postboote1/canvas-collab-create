
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import CanvasEditor from '@/components/canvas/CanvasEditor';
import CanvasShare from '@/components/canvas/CanvasShare';
import { useCanvas } from '@/contexts/CanvasContext';
import { useAuth } from '@/contexts/AuthContext';

const CanvasPage: React.FC = () => {
  const { currentCanvas } = useCanvas();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Redirect if no canvas is loaded
  useEffect(() => {
    if (!currentCanvas) {
      navigate('/dashboard');
    }
  }, [currentCanvas, navigate]);
  
  if (!currentCanvas) {
    return <div>Loading...</div>;
  }
  
  const isCreator = user && currentCanvas.createdBy === user.id;
  
  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white border-b py-2 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold truncate max-w-xs">
            {currentCanvas.name}
          </h1>
        </div>
        
        <div className="flex items-center gap-2">
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
            onClick={() => navigate('/dashboard')}
          >
            Exit
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <CanvasEditor readOnly={!isCreator} />
      </div>
    </div>
  );
};

export default CanvasPage;
