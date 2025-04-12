import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import Layout from '@/components/layout/Layout';
import { useCanvas } from '@/contexts/CanvasContext';

const CreateTempCanvasPage: React.FC = () => {
  const [name, setName] = useState('');
  const [isInfinite, setIsInfinite] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const { createTempCanvas, setCurrentCanvas } = useCanvas();
  const navigate = useNavigate();

  // Check for pending canvas state on load
  useEffect(() => {
    const pendingCanvasState = localStorage.getItem('pendingCanvasState');
    if (pendingCanvasState) {
      try {
        const canvas = JSON.parse(pendingCanvasState);
        setCurrentCanvas(canvas);
        localStorage.removeItem('pendingCanvasState'); // Clear after using
        
        // Also restore connection if it exists
        localStorage.removeItem('pendingConnection');
        
        toast.success('Shared canvas loaded');
        navigate('/canvas');
      } catch (error) {
        console.error('Error loading pending canvas state:', error);
        toast.error('Failed to load shared canvas');
      }
    }
  }, [setCurrentCanvas, navigate]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Please enter a name for your canvas');
      return;
    }
    
    setIsLoading(true);
    try {
      const canvas = await createTempCanvas(name.trim(), isInfinite);
      navigate('/canvas');
    } catch (error) {
      console.error('Error creating canvas:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Layout>
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
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Note: This canvas will not be saved to your account.</p>
          <p className="mt-2">
            <Button 
              variant="link" 
              className="p-0 h-auto" 
              onClick={() => navigate('/login')}
            >
              Login or register
            </Button>
            {' to save canvases to your account.'}
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default CreateTempCanvasPage;
