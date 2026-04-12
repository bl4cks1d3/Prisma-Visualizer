import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress ResizeObserver loop limit exceeded error
if (typeof window !== 'undefined') {
  const resizeObserverError = 'ResizeObserver loop completed with undelivered notifications.';
  const originalError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (message === resizeObserverError || message === 'ResizeObserver loop limit exceeded') {
      return true;
    }
    if (originalError) {
      return originalError(message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener('error', (e) => {
    if (e.message === resizeObserverError || e.message === 'ResizeObserver loop limit exceeded') {
      e.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
