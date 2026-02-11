import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { reportWebVitals } from './lib/performance'

// Register service worker for PWA support (Mobile Optimization #46)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}

// Set viewport height CSS variable for mobile (Mobile Optimization #33)
const setVH = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};
setVH();
window.addEventListener('resize', setVH, { passive: true });

// Report Web Vitals (Speed Optimization #46-50)
reportWebVitals();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
