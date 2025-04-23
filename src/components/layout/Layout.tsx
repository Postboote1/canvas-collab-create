import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import NavBar from './NavBar';
import Footer from './Footer';
import CookieConsent from '../common/CookieConsent';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { Outlet } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { trackPageView } = useAnalytics();
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Track page view on route change
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname, trackPageView]);
  
  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className={`flex-grow px-2 sm:px-6 py-3 sm:py-4 ${isMobile ? 'pb-16' : ''}`}>
        {children || <Outlet />}
      </main>
      <Footer />
      <CookieConsent />
    </div>
  );
};

export default Layout;
