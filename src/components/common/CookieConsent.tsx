
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAnalytics } from '@/contexts/AnalyticsContext';

const CookieConsent: React.FC = () => {
  const { cookiesAccepted, acceptCookies, rejectCookies } = useAnalytics();
  const [isVisible, setIsVisible] = useState(true);
  
  if (cookiesAccepted || !isVisible) {
    return null;
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-50 animate-slide-in">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between">
        <div className="mb-4 md:mb-0 flex-1">
          <p className="text-sm text-gray-600">
            We use cookies to collect anonymous usage statistics to improve your experience.
            By using CanvasCollab, you agree to our use of cookies.
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              rejectCookies();
              setIsVisible(false);
            }}
          >
            Reject
          </Button>
          
          <Button 
            size="sm" 
            onClick={() => {
              acceptCookies();
              setIsVisible(false);
            }}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
