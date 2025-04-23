import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Menu, LogOut, User, Bell, PlusCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from '@/contexts/ThemeContext';

const NavBar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { theme } = useTheme();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center">
          <Link to="/" className="flex items-center mr-4">
            <img src="/favicon.svg" alt="Logo" className="h-8 w-8 mr-2" />
            <span className={`font-bold text-canvas-blue ${isMobile ? 'text-base' : 'text-xl'}`}>
              CanvasCollab
            </span>
          </Link>
        </div>
        
        {isMobile ? (
          // Mobile navigation (hamburger menu)
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="ml-auto">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[250px] sm:w-[300px]">
              <nav className="flex flex-col gap-4 mt-8">
                {/* Mobile navigation links */}
                <Link to="/" className="flex items-center py-2 hover:text-canvas-blue transition-colors">
                  <Home className="mr-2 h-4 w-4" />
                  <span>Home</span>
                </Link>
                
                {user ? (
                  <>
                    <Link to="/dashboard" className="flex items-center py-2 hover:text-canvas-blue transition-colors">
                      <User className="mr-2 h-4 w-4" />
                      <span>My Canvases</span>
                    </Link>
                    
                    {isAdmin && (
                      <Link to="/admin" className="flex items-center py-2 hover:text-canvas-blue transition-colors">
                        <Bell className="mr-2 h-4 w-4" />
                        <span>Admin</span>
                      </Link>
                    )}
                    
                    <Link to="/create" className="flex items-center py-2 hover:text-canvas-blue transition-colors">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      <span>Create New Canvas</span>
                    </Link>
                    
                    <button 
                      onClick={handleLogout}
                      className="flex items-center py-2 w-full text-left hover:text-red-500 transition-colors"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </button>
                    
                    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm text-muted-foreground">
                        Logged in as: {user.username}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="flex items-center py-2 hover:text-canvas-blue transition-colors">
                      <User className="mr-2 h-4 w-4" />
                      <span>Login</span>
                    </Link>
                    
                    <Link to="/register" className="flex items-center py-2 hover:text-canvas-blue transition-colors">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      <span>Register</span>
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        ) : (
          // Desktop navigation
          <nav className="flex items-center space-x-4 lg:space-x-6">
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
                
                {isAdmin && (
                  <Link 
                    to="/admin" 
                    className="text-gray-600 hover:text-canvas-blue transition-colors"
                  >
                    Admin
                  </Link>
                )}
              </>
            ) : null}
          </nav>
        )}
        
        {/* Desktop auth buttons */}
        {!isMobile && (
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/create"
                  className="bg-canvas-blue hover:bg-canvas-highlight text-white px-3 py-1.5 rounded-md text-sm transition-colors"
                >
                  <PlusCircle className="h-4 w-4 inline-block mr-1" />
                  New Canvas
                </Link>
                
                <span className="text-gray-600 dark:text-gray-300 text-sm">
                  {user.username}
                </span>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate('/login')}
                >
                  Login
                </Button>
                <Button 
                  size="sm"
                  onClick={() => navigate('/register')}
                  className="bg-canvas-blue hover:bg-canvas-highlight text-white"
                >
                  Register
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default NavBar;
