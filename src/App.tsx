
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CanvasPage from './pages/CanvasPage';
import CreateCanvasPage from './pages/CreateCanvasPage';
import CreateTempCanvasPage from './pages/CreateTempCanvasPage';
import JoinPage from './pages/JoinPage';
import NotFound from './pages/NotFound';
import AdminPage from './pages/AdminPage';
import Layout from './components/layout/Layout';
import { CanvasProvider } from './contexts/CanvasContext';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { AnalyticsProvider } from './contexts/AnalyticsContext';
import { Toaster } from '@/components/ui/sonner';
import CookieConsent from './components/common/CookieConsent';
import PresentationMode from './components/canvas/PresentationMode';
import { ThemeProvider } from './contexts/ThemeContext';

// Add window augmentation for canvas export methods
declare global {
  interface Window {
    __canvasExportMethods?: {
      exportAsImage: () => void;
      exportAsPDF: () => void;
    };
  }
}

function App() {
  return (
    <AuthProvider>
      <CanvasProvider>
        <WebSocketProvider>
          <AnalyticsProvider>
            <ThemeProvider>
              <Router>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="login" element={<LoginPage />} />
                    <Route path="register" element={<RegisterPage />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="create" element={<CreateCanvasPage />} />
                    <Route path="create-temp" element={<CreateTempCanvasPage />} />
                    <Route path="join/:joinCode?" element={<JoinPage />} />
                    <Route path="admin" element={<AdminPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                  <Route path="/canvas" element={<CanvasPage />} />
                  <Route path="/presentation" element={<PresentationMode />} />
                </Routes>
                <CookieConsent />
              </Router>
              <Toaster position="top-right" />
            </ThemeProvider>
          </AnalyticsProvider>
        </WebSocketProvider>
      </CanvasProvider>
    </AuthProvider>
  );
}

export default App;
