
import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '@/services/pocketbaseService';
import { toast } from 'sonner';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  canvasLimit: number;
  storageLimit: number;
  currentStorage: number;
  isEmailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoggedIn: () => boolean;
  refreshUserData: () => Promise<void>;
  canCreateCanvas: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  // Initialize user from stored auth
  useEffect(() => {
    loadUserFromStorage();
  }, []);
  
  const loadUserFromStorage = async () => {
    if (pb.client.authStore.isValid) {
      try {
        const userData = await pb.client.collection('users').getOne(pb.client.authStore.model.id);
        const isAdminUser = userData.role === 'admin';
        
        setUser({
          id: userData.id,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          canvasLimit: userData.canvasLimit || 5,
          storageLimit: userData.storageLimit || 26214400,
          currentStorage: userData.currentStorage || 0,
          isEmailVerified: userData.verified
        });
        
        setIsAdmin(isAdminUser);
      } catch (error) {
        console.error("Error loading user from storage:", error);
        logout();
      }
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      await pb.client.collection('users').authWithPassword(email, password);
      
      // Force refresh auth model from server to get latest role
      try {
        const userData = await pb.client.collection('users').getOne(pb.client.authStore.model.id);
        pb.client.authStore.save(pb.client.authStore.token, userData);
      } catch (e) {
        console.error("Error refreshing user data:", e);
      }
      
      await loadUserFromStorage();
      toast.success('Login successful');
      return true;
    } catch (error) {
      console.error("Login error:", error);
      toast.error('Invalid credentials. Please try again.');
      return false;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    try {
      // Check if registration is allowed
      const settings = await pb.getSettings();
      if (settings && settings.allowRegistration === false) {
        toast.error('Registration is currently disabled by the administrator');
        return false;
      }
      
      // Default values if settings are null
      const canvasLimit = settings?.maxCanvasesPerUser || 5;
      const storageLimit = settings?.maxStoragePerUser || 26214400;
      
      const data = {
        username,
        email,
        password,
        passwordConfirm: password,
        role: 'user',
        canvasLimit,
        storageLimit,
        currentStorage: 0
      };
      
      await pb.client.collection('users').create(data);
      
      // Request email verification
      try {
        await pb.client.collection('users').requestVerification(email);
        toast.success('Registration successful! Please check your email to verify your account.');
      } catch (verifyError) {
        console.error("Verification request error:", verifyError);
        toast.success('Registration successful! Email verification is currently unavailable.');
      }
      
      return true;
    } catch (error) {
      console.error("Registration error:", error);
      toast.error('Registration failed. Please try again.');
      return false;
    }
  };

  const logout = () => {
    pb.client.authStore.clear();
    setUser(null);
    setIsAdmin(false);
  };

  const isLoggedIn = () => {
    return pb.client.authStore.isValid;
  };
  
  const refreshUserData = async () => {
    if (isLoggedIn()) {
      await loadUserFromStorage();
    }
  };
  
  const canCreateCanvas = async (): Promise<boolean> => {
    if (!user) return false;
    
    // Admins can always create canvases
    if (user.role === 'admin') return true;
    
    const usage = await pb.getUserStorageUsage(user.id);
    return usage.canvasCount < user.canvasLimit;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAdmin, 
      login, 
      register, 
      logout, 
      isLoggedIn,
      refreshUserData,
      canCreateCanvas
    }}>
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
