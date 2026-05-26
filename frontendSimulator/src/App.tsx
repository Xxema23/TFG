import React, { useEffect, useState, createContext, useContext } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Navbar from './components/navbar/Navbar';
import AppRouter from './router/AppRouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface LoadingContextType {
  isGlobalLoading: boolean;
  setGlobalLoading: (loading: boolean, message?: string) => void;
  loadingMessage: string;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

export const useGlobalLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useGlobalLoading debe usarse dentro de LoadingProvider');
  }
  return context;
};

const queryClient = new QueryClient();

function App() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Cargando...');

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);

    if (!isMobile) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = 'auto';
      document.body.style.overflow = 'auto';
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isMobile]);

  const setGlobalLoading = (loading: boolean, message: string = 'Cargando...') => {
    setIsGlobalLoading(loading);
    setLoadingMessage(message);
  };

  const loadingContextValue: LoadingContextType = {
    isGlobalLoading,
    setGlobalLoading,
    loadingMessage
  };

  return (
    <LoadingContext.Provider value={loadingContextValue}>
      <QueryClientProvider client={queryClient}>
        {/* ✅ DndProvider GLOBAL - Cubre toda la app */}
        <DndProvider backend={HTML5Backend}>
          <BrowserRouter>
            <div className={`App w-full ${isMobile ? 'min-h-screen' : 'h-screen overflow-hidden'} flex flex-col`}>
              <div className="flex-shrink-0">
                <Navbar />
              </div>
              <div className={`flex-grow ${isMobile ? '' : 'overflow-hidden'}`}>
                <AppRouter />
              </div>

              {isGlobalLoading && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center">
                  <div className="bg-white rounded-lg p-8 shadow-2xl flex flex-col items-center gap-4 min-w-[300px]">
                    <div className="relative w-16 h-16">
                      <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-200 rounded-full"></div>
                      <div className="absolute top-0 left-0 w-full h-full border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                    </div>

                    <div className="text-center">
                      <h3 className="text-xl font-semibold text-gray-800 mb-2">
                        {loadingMessage}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Por favor, no cierre ni recargue la página
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Este proceso puede tardar
                      </p>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </BrowserRouter>
        </DndProvider>
      </QueryClientProvider>
    </LoadingContext.Provider>
  );
}

export default App;