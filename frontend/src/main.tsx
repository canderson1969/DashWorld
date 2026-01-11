import React from 'react'
import ReactDOM from 'react-dom/client'
import DashWorld from './DashWorld'
import './index.css'
import { logger } from './utils/logger'

// Suppress console errors for known benign errors
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const errorString = args.join(' ');

  // Suppress video abort errors and Leaflet map errors
  if (
    errorString.includes('fetching process') ||
    errorString.includes('media resource') ||
    errorString.includes('aborted by the user agent') ||
    errorString.includes('dash-world-frontend') ||
    errorString.includes('_leaflet_pos') ||
    errorString.includes('Promise rejected without catch handler')
  ) {
    return; // Suppress this error
  }

  // Log all other errors normally
  originalConsoleError.apply(console, args);
};

// Global error handler for unhandled errors
window.addEventListener('error', (event) => {
  // Log resource loading errors (images, videos, scripts, etc.)
  if (event.target && event.target !== window) {
    const target = event.target as HTMLElement;
    const tagName = target.tagName?.toLowerCase();

    if (tagName === 'img' || tagName === 'video' || tagName === 'source') {
      const src = (target as HTMLImageElement | HTMLVideoElement).src;
      logger.error('Resource failed to load', {
        tagName,
        src,
        message: event.message || 'Resource loading failed'
      });

      // Prevent default browser console error for cleaner logs
      event.preventDefault();
    }
  }
});

// Global handler for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const errorMessage = error?.message || error?.reason || String(error);
  const errorService = error?.service || '';

  // Convert error to string for checking
  let errorString = '';
  try {
    errorString = JSON.stringify(error);
  } catch {
    errorString = String(error);
  }

  // Ignore video/media abort errors - these happen when switching videos quickly
  const isMediaAbortError =
    errorService === 'dash-world-frontend' ||
    errorMessage.includes('fetching process') ||
    errorMessage.includes('media resource') ||
    errorMessage.includes('aborted by the user agent') ||
    errorString.includes('dash-world-frontend') ||
    errorString.includes('fetching process');

  // Ignore Leaflet map errors - these happen when switching views quickly
  const isLeafletError =
    errorMessage.includes('_leaflet_pos') ||
    errorMessage.includes('leaflet');

  // Don't log known benign errors
  if (isMediaAbortError || isLeafletError) {
    event.preventDefault();
    return;
  }

  logger.error('Unhandled promise rejection', {
    reason: error instanceof Error ? error.message : String(error),
    promise: 'Promise rejected without catch handler'
  });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashWorld />
  </React.StrictMode>,
)
