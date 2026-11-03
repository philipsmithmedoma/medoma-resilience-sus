import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import { App } from './app/App';
import { initTheme } from './lib/theme';
import { initLocale } from './lib/i18n';

// Development only: the store on window so that the demo state can be set and read from a browser script.
if (import.meta.env.DEV) void import('./data/store').then((m) => Object.assign(window, { __store: m.useStore }));

initTheme();
initLocale();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
