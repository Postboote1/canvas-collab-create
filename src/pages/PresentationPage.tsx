
import React from 'react';
import { Helmet } from 'react-helmet';
import PresentationMode from '@/components/canvas/PresentationMode';
import { ThemeProvider } from '@/contexts/ThemeContext';

const PresentationPage: React.FC = () => {
  return (
    <ThemeProvider>
      <Helmet>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <title>Canvas Presentation</title>
      </Helmet>
      <PresentationMode />
    </ThemeProvider>
  );
};

export default PresentationPage;
