import React, { useState, useEffect } from 'react';
import App from './App';
import LandingPage from './components/Landing/LandingPage';

export const RootRouter: React.FC = () => {
  const [route, setRoute] = useState<'landing' | 'map'>(() => {
    if (typeof window === 'undefined') return 'landing';
    const p = window.location.pathname.toLowerCase();
    if (p === '/map' || p === '/radar' || p === '/surveillance') {
      return 'map';
    }
    return 'landing';
  });

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname.toLowerCase();
      if (p === '/map' || p === '/radar' || p === '/surveillance') {
        setRoute('map');
      } else {
        setRoute('landing');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToMap = () => {
    window.history.pushState(null, '', '/map');
    setRoute('map');
  };

  const navigateToLanding = () => {
    window.history.pushState(null, '', '/');
    setRoute('landing');
  };

  if (route === 'landing') {
    return <LandingPage onNavigateToMap={navigateToMap} />;
  }

  return <App onNavigateToLanding={navigateToLanding} />;
};

export default RootRouter;
