import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Layout from '@/components/layout/Layout';
import { pb } from '@/services/pocketbaseService';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card} from '@/components/ui/card';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [registrationAllowed, setRegistrationAllowed] = useState(true);
  const isMobile = useIsMobile();
  
  const { register } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    checkRegistrationSettings();
  }, []);

  const checkRegistrationSettings = async () => {
    try {
      const settings = await pb.getSettings();
      setRegistrationAllowed(settings?.allowRegistration ?? true);
    } catch (error) {
      console.error("Failed to check registration settings:", error);
      // Default to allowing registration if we can't check
      setRegistrationAllowed(true);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registrationAllowed) {
      setError('Registration is currently disabled by the administrator');
      return;
    }
    
    // Reset error
    setError('');
    
    // Validation
    if (!username || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    setIsLoading(true);
    const success = await register(username, email, password);
    setIsLoading(false);
    
    if (success) {
      navigate('/login');
    }
  };
  
  if (!registrationAllowed) {
    return (
      <Layout>
        <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-center">Registration Disabled</h1>
          <p className="text-center text-gray-600 mb-6">
            New user registration is currently disabled by the administrator.
          </p>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </Button>
        </div>
      </Layout>
    );
  }
  
  return (
    <div className="container px-4 py-4 flex items-center justify-center min-h-[calc(100vh-64px)]">
      <Card className={`w-full ${isMobile ? 'max-w-sm mt-0' : 'max-w-md'} shadow-lg animate-fade-in`}>
        <h1 className="text-2xl font-bold mb-6 text-center">Create an Account</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Username
            </label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Password must be at least 6 characters long
            </p>
          </div>
          
          <div className="mb-6">
            <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">
              Confirm Password
            </label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>
        
        <div className="mt-6 text-center text-sm">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="text-canvas-blue hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default RegisterPage;