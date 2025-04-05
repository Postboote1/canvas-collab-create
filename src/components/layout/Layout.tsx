
import React, { useEffect } from 'react';
import NavBar from './NavBar';
import Footer from './Footer';
import CookieConsent from '../common/CookieConsent';
import { useAnalytics } from '@/contexts/AnalyticsContext';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { trackPageView } = useAnalytics();
  const location = useLocation();
  
  // Track page view on route change
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname, trackPageView]);
  
  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
      <CookieConsent />
    </div>
  );
};

export default Layout;
