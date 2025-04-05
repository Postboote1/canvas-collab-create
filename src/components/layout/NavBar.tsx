
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const NavBar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="border-b bg-white py-4 px-6 flex items-center justify-between">
      <div className="flex items-center">
        <Link to="/" className="text-2xl font-bold text-canvas-blue">
          CanvasCollab
        </Link>
      </div>
      
      <div className="flex items-center space-x-4">
        <Link to="/" className="text-gray-600 hover:text-canvas-blue transition-colors">
          Home
        </Link>
        
        {user ? (
          <>
            <Link 
              to="/dashboard" 
              className="text-gray-600 hover:text-canvas-blue transition-colors"
            >
              My Canvases
            </Link>
            
            {user.isAdmin && (
              <Link 
                to="/admin" 
                className="text-gray-600 hover:text-canvas-blue transition-colors"
              >
                Admin
              </Link>
            )}
            
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">
                Hello, {user.username}
              </span>
              <Button 
                variant="outline" 
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Logout
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/login')}
            >
              Login
            </Button>
            <Button 
              onClick={() => navigate('/register')}
            >
              Register
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
