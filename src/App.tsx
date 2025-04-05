
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CanvasProvider } from "@/contexts/CanvasContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { AnalyticsProvider } from "@/contexts/AnalyticsContext";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import CreateCanvasPage from "./pages/CreateCanvasPage";
import CanvasPage from "./pages/CanvasPage";
import JoinPage from "./pages/JoinPage";
import AdminPage from "./pages/AdminPage";
import PresentationMode from "./components/canvas/PresentationMode";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CanvasProvider>
        <WebSocketProvider>
          <AnalyticsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/create" element={<CreateCanvasPage />} />
                  <Route path="/canvas" element={<CanvasPage />} />
                  <Route path="/join" element={<JoinPage />} />
                  <Route path="/join/:code" element={<JoinPage />} />
                  <Route path="/admin" element={<AdminPage />} />
                  <Route path="/presentation" element={<PresentationMode />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AnalyticsProvider>
        </WebSocketProvider>
      </CanvasProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
