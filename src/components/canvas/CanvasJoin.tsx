
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
  const { connect, isPeerInitialized, isConnected, initializePeer } = useWebSocket();
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
  
  // If connection is established, navigate to canvas
  useEffect(() => {
    if (isConnected && isLoading) {
      setIsLoading(false);
      navigate('/canvas');
    }
  }, [isConnected, isLoading, navigate]);
  
  const handleJoinCanvas = async (e: React.FormEvent | null, codeOverride?: string) => {
    if (e) e.preventDefault();
    
    const codeToUse = codeOverride || joinCode;
    
    if (!codeToUse.trim()) {
      toast.error('Please enter a peer ID');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Initialize peer if not already initialized
      if (!isPeerInitialized) {
        setIsInitializing(true);
        try {
          await initializePeer();
        } catch (error) {
          console.error('Failed to initialize peer:', error);
          setError('Failed to initialize peer connection. Try again later.');
          toast.error('Failed to initialize peer connection. Try again later.');
          setIsLoading(false);
          setIsInitializing(false);
          return;
        }
        setIsInitializing(false);
      }
      
      connect(codeToUse.trim());
      
      // Set a timeout to give up if connection takes too long
      setTimeout(() => {
        if (isLoading && !isConnected) {
          setIsLoading(false);
          setError('Connection is taking too long. Please verify the peer ID and try again.');
          toast.error('Connection is taking too long. Please try again.');
        }
      }, 20000);
    } catch (error) {
      console.error('Error joining canvas:', error);
      setError('Failed to join canvas. Please check your network and try again.');
      toast.error('Failed to join canvas');
      setIsLoading(false);
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
