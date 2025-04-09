
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const CanvasJoin: React.FC = () => {
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const { connect, isPeerInitialized, isConnected, initializePeer } = useWebSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check for code in URL parameters
  useEffect(() => {
    const codeFromUrl = searchParams.get('code');
    if (codeFromUrl) {
      setJoinCode(codeFromUrl);
      // Auto-join if code is in URL
      handleJoinCanvas(null, codeFromUrl);
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
    
    try {
      // Initialize peer if not already initialized
      if (!isPeerInitialized) {
        setIsInitializing(true);
        try {
          await initializePeer();
        } catch (error) {
          console.error('Failed to initialize peer:', error);
          toast.error('Failed to initialize peer connection');
          setIsLoading(false);
          setIsInitializing(false);
          return;
        }
        setIsInitializing(false);
      }
      
      connect(codeToUse.trim());
      
      // Set a timeout to give up if connection takes too long
      setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          toast.error('Connection is taking too long. Please try again.');
        }
      }, 15000);
    } catch (error) {
      console.error('Error joining canvas:', error);
      toast.error('Failed to join canvas');
      setIsLoading(false);
    }
  };
  
  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md dark:bg-zinc-800 dark:border dark:border-zinc-700">
      <h2 className="text-2xl font-bold mb-6 text-center dark:text-white">Join a Canvas</h2>
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
