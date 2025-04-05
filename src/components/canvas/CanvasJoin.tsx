
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCanvas } from '@/contexts/CanvasContext';
import { toast } from 'sonner';

const CanvasJoin: React.FC = () => {
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loadCanvasByCode } = useCanvas();
  const navigate = useNavigate();
  
  const handleJoinCanvas = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!joinCode.trim()) {
      toast.error('Please enter a join code');
      return;
    }
    
    setIsLoading(true);
    try {
      const success = await loadCanvasByCode(joinCode.trim());
      if (success) {
        navigate(`/canvas`);
      }
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
          <label htmlFor="join-code" className="block text-sm font-medium mb-1">
            Enter 6-digit join code
          </label>
          <Input
            id="join-code"
            placeholder="e.g. ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="text-center text-xl uppercase"
          />
        </div>
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading}
        >
          {isLoading ? 'Joining...' : 'Join Canvas'}
        </Button>
      </form>
      
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>
          Don't have a code? <a href="/create" className="text-canvas-blue hover:underline">Create your own canvas</a>
        </p>
      </div>
    </div>
  );
};

export default CanvasJoin;
