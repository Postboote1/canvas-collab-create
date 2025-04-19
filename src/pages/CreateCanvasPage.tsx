
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useCanvas } from '@/contexts/CanvasContext';

const CreateCanvasPage: React.FC = () => {
  const [name, setName] = useState('');
  const [isInfinite, setIsInfinite] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, isLoggedIn } = useAuth();
  const { createCanvas, userCanvases } = useCanvas();
  const navigate = useNavigate();
  
  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);
  
  // Check if user has reached canvas limit
  useEffect(() => {
    if (userCanvases.length >= 5) {
      toast.error('You can only create up to 5 canvases. Please delete one first.');
      navigate('/dashboard');
    }
  }, [userCanvases, navigate]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear any pending canvas state in localStorage
    localStorage.removeItem('pendingCanvasState');
    if (!name.trim()) {
      toast.error('Please enter a name for your canvas');
      return;
    }
    
    setIsLoading(true);
    try {
      const canvas = await createCanvas(name.trim(), isInfinite);
      navigate('/canvas');
    } catch (error) {
      console.error('Error creating canvas:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!user) {
    return <div>Loading...</div>;
  }
  
  return (
    
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Create New Canvas</h1>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="canvas-name" className="block text-sm font-medium mb-1">
              Canvas Name
            </label>
            <Input
              id="canvas-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Canvas"
              required
            />
          </div>
          
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="canvas-type" className="block text-sm font-medium">
                  Canvas Type
                </label>
                <p className="text-sm text-gray-500">
                  {isInfinite 
                    ? 'Infinite canvas with no boundaries' 
                    : 'Page-based canvas for easy PDF export'}
                </p>
              </div>
              <Switch
                id="canvas-type"
                checked={isInfinite}
                onCheckedChange={setIsInfinite}
              />
            </div>
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'Create Canvas'}
          </Button>
        </form>
      </div>
    
  );
};

export default CreateCanvasPage;
