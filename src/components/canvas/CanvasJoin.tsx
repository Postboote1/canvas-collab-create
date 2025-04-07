
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { toast } from 'sonner';

const CanvasJoin: React.FC = () => {
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { connect } = useWebSocket();
  const navigate = useNavigate();
  
  const handleJoinCanvas = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!joinCode.trim()) {
      toast.error('Please enter a join code');
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
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Join a Canvas</h2>
      <form onSubmit={handleJoinCanvas}>
        <div className="mb-4">
          <Input
            placeholder="Enter 6-digit join code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="text-center text-xl uppercase"
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Joining...' : 'Join Canvas'}
        </Button>
      </form>
    </div>
  );
};

export default CanvasJoin;
