
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AnalyticsContextType {
  cookiesAccepted: boolean;
  acceptCookies: () => void;
  rejectCookies: () => void;
  trackPageView: (page: string) => void;
  getStats: () => {
    visitors: number;
    canvasesCreated: number;
    canvasesJoined: number;
    pageViews: { [key: string]: number };
  };
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

export const AnalyticsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cookiesAccepted, setCookiesAccepted] = useState(false);

  // Check cookie consent on mount
  useEffect(() => {
    const consentStatus = localStorage.getItem('cookieConsent');
    if (consentStatus === 'accepted') {
      setCookiesAccepted(true);
    }
    
    // Initialize analytics storage if not exists
    if (!localStorage.getItem('canvasStats')) {
      localStorage.setItem('canvasStats', JSON.stringify({
        visitors: 0,
        canvasesCreated: 0,
        canvasesJoined: 0,
        pageViews: {}
      }));
    }
    
    // Track visitor if consent is already given
    if (consentStatus === 'accepted') {
      trackVisitor();
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookieConsent', 'accepted');
    setCookiesAccepted(true);
    trackVisitor();
  };

  const rejectCookies = () => {
    localStorage.setItem('cookieConsent', 'rejected');
    setCookiesAccepted(false);
  };

  const trackVisitor = () => {
    try {
      const visitorTracked = localStorage.getItem('visitorTracked');
      
      if (!visitorTracked) {
        const stats = JSON.parse(localStorage.getItem('canvasStats') || '{}');
        stats.visitors = (stats.visitors || 0) + 1;
        localStorage.setItem('canvasStats', JSON.stringify(stats));
        localStorage.setItem('visitorTracked', 'true');
      }
    } catch (error) {
      console.error('Failed to track visitor:', error);
    }
  };

  const trackPageView = (page: string) => {
    if (!cookiesAccepted) return;
    
    try {
      const stats = JSON.parse(localStorage.getItem('canvasStats') || '{}');
      if (!stats.pageViews) {
        stats.pageViews = {};
      }
      stats.pageViews[page] = (stats.pageViews[page] || 0) + 1;
      localStorage.setItem('canvasStats', JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to track page view:', error);
    }
  };

  const getStats = () => {
    try {
      return JSON.parse(localStorage.getItem('canvasStats') || '{}');
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        visitors: 0,
        canvasesCreated: 0,
        canvasesJoined: 0,
        pageViews: {}
      };
    }
  };

  return (
    <AnalyticsContext.Provider value={{
      cookiesAccepted,
      acceptCookies,
      rejectCookies,
      trackPageView,
      getStats
    }}>
      {children}
    </AnalyticsContext.Provider>
  );
};

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};
