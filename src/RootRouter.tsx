import React, { useState, useEffect, Suspense, lazy } from 'react';
// The map workspace (Mapbox, Three.js, ~1 MB gzip) loads only when /map is opened,
// so the landing page no longer pays for it.
const App = lazy(() => import('./App'));
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

  return (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#05070c' }} aria-busy="true" />}>
      <App onNavigateToLanding={navigateToLanding} />
    </Suspense>
  );
};

export default RootRouter;
