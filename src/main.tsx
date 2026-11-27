import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

console.log(
  '%c🌱 Aadhunik Krishak %c— Growing smart farms in Nepal with React, Supabase & AI!',
  'background: #15803d; color: #fff; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
  'color: #166534; font-weight: 500;'
);