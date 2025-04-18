import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const CanvasJoin: React.FC = () => {
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { connect, isPeerInitialized, isConnected, initializePeer, registerHandler, syncComplete } = useWebSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check for code in URL parameters
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setJoinCode(codeFromUrl);
      // Auto-join if code is in URL, with slight delay to let components mount
      setTimeout(() => {
        handleJoinCanvas(null, codeFromUrl);
      }, 500);
    }
  }, [searchParams]);
  
  // If connection is established, check for canvas data
  useEffect(() => {
    if (isConnected) {
      // Check for canvas data in multiple ways
      const pendingCanvas = localStorage.getItem('pendingCanvasState');
      
      if (pendingCanvas || syncComplete) {
        setIsLoading(false);
        console.log('Successfully connected and canvas data received, navigating to canvas page');
        
        // Delay navigation slightly to allow state updates
        setTimeout(() => {
          navigate('/canvas');
        }, 500);
      }
    }
  }, [isConnected, syncComplete, navigate]);
  
  const handleJoinCanvas = async (e: React.FormEvent | null, codeOverride?: string) => {
    if (e) e.preventDefault();
  
    const codeToUse = codeOverride || joinCode;
    if (!codeToUse.trim()) {
      toast.error('Please enter a valid join code');
      return;
    }
  
    setIsLoading(true);
    setError(null);
  
    try {
      if (!isPeerInitialized) {
        setIsInitializing(true);
        await initializePeer();
        setIsInitializing(false);
      }
      
      await connect(codeToUse);
      
      // After connecting, check for canvas data even if sync flag isn't set
      setTimeout(() => {
        const pendingCanvas = localStorage.getItem('pendingCanvasState');
        if (pendingCanvas) {
          navigate('/canvas');
        }
      }, 5000); // Give some time for canvas state to be received
    } catch (error) {
      console.error('Error joining canvas:', error);
      setError('Failed to join canvas. Please check the join code and try again.');
      setIsLoading(false);
      
      // Even if there's an error, check if we got canvas data
      const pendingCanvas = localStorage.getItem('pendingCanvasState');
      if (pendingCanvas) {
        toast.info('Canvas data found, proceeding to canvas');
        navigate('/canvas');
      }
    }
  };
  
  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-zinc-800 dark:border dark:border-zinc-700">
      <h2 className="text-2xl font-bold mb-6 text-center dark:text-white">Join a Canvas</h2>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleJoinCanvas}>
        <div className="mb-4">
          <Input
            placeholder="Enter peer ID to join"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="text-center text-xl"
          />
        </div>
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading || isInitializing}
        >
          {isLoading ? (
            <span className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </span>
          ) : isInitializing ? (
            <span className="flex items-center">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Initializing...
            </span>
          ) : (
            'Join Canvas'
          )}
        </Button>
      </form>
    </div>
  );
};

export default CanvasJoin;
