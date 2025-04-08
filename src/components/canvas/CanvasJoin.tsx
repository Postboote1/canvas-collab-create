
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { toast } from 'sonner';

const CanvasJoin: React.FC = () => {
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { connect, isPeerInitialized } = useWebSocket();
  const navigate = useNavigate();
  
  const handleJoinCanvas = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!joinCode.trim()) {
      toast.error('Please enter a peer ID');
      return;
    }
    
    if (!isPeerInitialized) {
      toast.error('Peer connection not initialized yet. Please try again in a moment.');
      return;
    }
    
    setIsLoading(true);
    try {
      connect(joinCode.trim());
      navigate('/canvas');
    } catch (error) {
      console.error('Error joining canvas:', error);
      toast.error('Failed to join canvas');
    } finally {
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
          disabled={isLoading || !isPeerInitialized}
        >
          {isLoading ? 'Joining...' : 'Join Canvas'}
        </Button>
        
        {!isPeerInitialized && (
          <p className="text-sm text-orange-500 mt-2 text-center">
            Initializing peer connection...
          </p>
        )}
      </form>
    </div>
  );
};

export default CanvasJoin;
