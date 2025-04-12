
import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import PresentationMode from '@/components/canvas/PresentationMode';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { CanvasProvider } from '@/contexts/CanvasContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const PresentationPage: React.FC = () => {
  const navigate = useNavigate();

  // Load canvas data from localStorage if it exists
  useEffect(() => {
    const pendingCanvasState = localStorage.getItem('pendingCanvasState');
    if (!pendingCanvasState) {
      // If no canvas data is found, redirect back to canvas page
      navigate('/canvas');
    }
  }, [navigate]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <CanvasProvider>
            <Helmet>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
              <meta name="apple-mobile-web-app-capable" content="yes" />
              <meta name="mobile-web-app-capable" content="yes" />
              <title>Canvas Presentation</title>
            </Helmet>
            <PresentationMode />
          </CanvasProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default PresentationPage;
