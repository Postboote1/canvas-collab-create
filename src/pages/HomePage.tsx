import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Layout from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';

const HomePage: React.FC = () => {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  
  return (
    
      <div className="py-12 md:py-20">
        {/* Hero Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Collaborate on Visual Canvas in Real-Time
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              Create, share, and present ideas with a powerful collaborative canvas tool for teams.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="w-full sm:w-auto"
                onClick={() => navigate('/create-temp')}
              >
                Create Canvas
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full sm:w-auto"
                onClick={() => navigate('/join')}
              >
                Join Existing Canvas
              </Button>
            </div>
            {!isLoggedIn() && (
              <p className="mt-4 text-sm text-gray-500">
                <Link to="/register" className="text-canvas-blue hover:underline">Sign up</Link> or <Link to="/login" className="text-canvas-blue hover:underline">log in</Link> to save your canvases
              </p>
            )}
          </div>
        </div>
        
        {/* Features Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything You Need for Visual Collaboration
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Powerful tools for brainstorming, mapping, designing, and presenting ideas.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="text-canvas-blue mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Infinite Canvas</h3>
              <p className="text-gray-600">
                Create without constraints on an infinite canvas or choose page-based layouts for document-style exports.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="text-canvas-blue mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-Time Collaboration</h3>
              <p className="text-gray-600">
                Work together with your team in real-time with instant syncing and seamless collaboration.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <div className="text-canvas-blue mb-4">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Presentation Mode</h3>
              <p className="text-gray-600">
                Turn your canvas into a professional presentation with just one click. Navigate between connected elements.
              </p>
            </div>
          </div>
        </div>
        
        {/* How It Works Section */}
        <div className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                How It Works
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Get started in three simple steps
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-canvas-blue text-white text-2xl font-bold mb-4">
                  1
                </div>
                <h3 className="text-xl font-semibold mb-2">Create or Join</h3>
                <p className="text-gray-600">
                  Create a new canvas or join an existing one with a code or QR scan.
                </p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-canvas-blue text-white text-2xl font-bold mb-4">
                  2
                </div>
                <h3 className="text-xl font-semibold mb-2">Collaborate</h3>
                <p className="text-gray-600">
                  Add cards, text, drawings, images, and connect ideas together in real-time.
                </p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-canvas-blue text-white text-2xl font-bold mb-4">
                  3
                </div>
                <h3 className="text-xl font-semibold mb-2">Present & Export</h3>
                <p className="text-gray-600">
                  Turn your canvas into a presentation or export it as an image or PDF.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* CTA Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-canvas-blue rounded-lg shadow-xl overflow-hidden">
            <div className="px-6 py-12 md:p-12 text-center text-white">
              <h2 className="text-3xl font-bold mb-4">
                Ready to get started?
              </h2>
              <p className="text-xl mb-8 max-w-2xl mx-auto">
                Join today and create your first collaborative canvas in minutes.
              </p>
              <Button 
                size="lg" 
                variant="outline" 
                className="bg-white text-canvas-blue hover:bg-gray-100 border-white"
                onClick={() => navigate('/create-temp')}
              >
                Create Canvas
              </Button>
            </div>
          </div>
        </div>
      </div>
    
  );
};

export default HomePage;
