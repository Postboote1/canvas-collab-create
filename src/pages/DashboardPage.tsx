
import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PlusCircle, ExternalLink, Trash } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { useCanvas } from '@/contexts/CanvasContext';

const DashboardPage: React.FC = () => {
  const { user, isLoggedIn } = useAuth();
  const { userCanvases, loadCanvas } = useCanvas();
  const navigate = useNavigate();
  
  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);
  
  const handleCreateCanvas = () => {
    navigate('/create');
  };
  
  const handleOpenCanvas = async (id: string) => {
    const success = await loadCanvas(id);
    if (success) {
      navigate('/canvas');
    } else {
      toast.error('Failed to load canvas');
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  if (!user) {
    return <div>Loading...</div>;
  }
  
  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Canvases</h1>
            <p className="text-gray-600">
              Manage your saved canvases or create a new one
            </p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <Button
              onClick={handleCreateCanvas}
              className="flex items-center gap-2"
              disabled={userCanvases.length >= 5}
            >
              <PlusCircle size={18} />
              Create New Canvas
            </Button>
            {userCanvases.length >= 5 && (
              <p className="text-sm text-red-500 mt-2">
                You've reached the limit of 5 canvases.
              </p>
            )}
          </div>
        </div>
        
        {userCanvases.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">You don't have any canvases yet</h2>
            <p className="text-gray-600 mb-6">
              Create your first canvas to start collaborating
            </p>
            <Button onClick={handleCreateCanvas}>
              Create Canvas
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userCanvases.map((canvas) => (
              <div
                key={canvas.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 truncate">{canvas.name}</h3>
                  <p className="text-gray-500 text-sm mb-4">
                    Created: {formatDate(canvas.createdAt)}
                  </p>
                  <p className="text-gray-600 mb-4">
                    Join Code: <span className="font-mono font-medium">{canvas.joinCode}</span>
                  </p>
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={() => handleOpenCanvas(canvas.id)}
                    >
                      <ExternalLink size={14} />
                      Open
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 border-red-200 hover:bg-red-50 flex items-center gap-1"
                    >
                      <Trash size={14} />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Card to create new canvas if limit not reached */}
            {userCanvases.length < 5 && (
              <div
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer"
                onClick={handleCreateCanvas}
              >
                <div className="p-6 text-center">
                  <div className="mb-4">
                    <PlusCircle size={48} className="text-gray-400 mx-auto" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-600">Create New Canvas</h3>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DashboardPage;
