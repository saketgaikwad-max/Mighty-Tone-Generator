import './index.css';

import { App as KonstaApp } from 'konsta/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <KonstaApp theme="ios" dark>
      <App />
    </KonstaApp>
  </StrictMode>,
);
