import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { FabricacionesProvider } from './contexts/FabricacionesContext';
import { CapacityProvider } from './contexts/CapacityContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CapacityProvider>
      <FabricacionesProvider>
        <App />
      </FabricacionesProvider>
    </CapacityProvider>
  </React.StrictMode>
);