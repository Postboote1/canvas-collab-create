
// @allowedFileUpdate src/App.tsx
import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/layout/Layout';
import DashboardPage from '@/pages/DashboardPage';
import HomePage from '@/pages/HomePage';
import CreateCanvasPage from '@/pages/CreateCanvasPage';
import CreateTempCanvasPage from '@/pages/CreateTempCanvasPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import AdminPage from '@/pages/AdminPage';
import NotFound from '@/pages/NotFound';
import CanvasPage from '@/pages/CanvasPage';
import JoinPage from '@/pages/JoinPage';
import PresentationPage from '@/pages/PresentationPage';
import CookieConsent from './components/common/CookieConsent';
import { AnalyticsProvider } from './contexts/AnalyticsContext';
import { AuthProvider } from './contexts/AuthContext';
import { CanvasProvider } from './contexts/CanvasContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ThemeProvider } from './contexts/ThemeContext';

function App() {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <ThemeProvider>
      <AnalyticsProvider>
        <AuthProvider>
          <CanvasProvider>
            <WebSocketProvider>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<HomePage />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="create" element={<CreateCanvasPage />} />
                  <Route path="create-temp" element={<CreateTempCanvasPage />} />
                  <Route path="login" element={<LoginPage />} />
                  <Route path="register" element={<RegisterPage />} />
                  <Route path="admin" element={<AdminPage />} />
                  <Route path="join/:code?" element={<JoinPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
                
                {/* Full-screen canvas routes */}
                <Route path="/canvas" element={<CanvasPage />} />
                <Route path="/presentation" element={<PresentationPage />} />
              </Routes>
              
              <Toaster position="top-center" />
              <CookieConsent />
            </WebSocketProvider>
          </CanvasProvider>
        </AuthProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}

export default App;
