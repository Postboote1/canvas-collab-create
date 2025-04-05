
import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoggedIn: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('canvasUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        localStorage.removeItem('canvasUser');
      }
    }
    setLoading(false);
  }, []);

  // Mock login function - in a real app this would call an API
  const login = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, this would be a server call to verify credentials
      const usersStr = localStorage.getItem('canvasUsers') || '[]';
      const users = JSON.parse(usersStr);
      
      const userMatch = users.find((u: any) => 
        u.username === username && u.password === `hashed_${password}_salted`
      );
      
      if (userMatch) {
        const loggedInUser = {
          id: userMatch.id,
          username: userMatch.username,
          isAdmin: userMatch.isAdmin || false
        };
        
        setUser(loggedInUser);
        localStorage.setItem('canvasUser', JSON.stringify(loggedInUser));
        toast.success('Successfully logged in!');
        return true;
      } else {
        toast.error('Invalid username or password');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to login. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Mock register function
  const register = async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get existing users
      const usersStr = localStorage.getItem('canvasUsers') || '[]';
      const users = JSON.parse(usersStr);
      
      // Check if username already exists
      if (users.some((u: any) => u.username === username)) {
        toast.error('Username already exists');
        return false;
      }
      
      // Create new user
      const newUser = {
        id: `user_${Date.now()}`,
        username,
        password: `hashed_${password}_salted`, // This is a mock hash - use a real hash function in production
        isAdmin: username === 'admin', // Simple way to create an admin account
        canvases: []
      };
      
      // Save to "database"
      users.push(newUser);
      localStorage.setItem('canvasUsers', JSON.stringify(users));
      
      // Log the user in
      const loggedInUser = {
        id: newUser.id,
        username: newUser.username,
        isAdmin: newUser.isAdmin
      };
      
      setUser(loggedInUser);
      localStorage.setItem('canvasUser', JSON.stringify(loggedInUser));
      toast.success('Account created successfully!');
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('canvasUser');
    toast.success('Logged out successfully');
  };

  const isLoggedIn = () => !!user;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
