import React, { useEffect } from 'react';
import { FabricacionesProvider } from '../contexts/FabricacionesContext'; // ✅ AGREGAR ESTE IMPORT
import Simulator from '../components/simulator/Simulator';

const Home: React.FC = () => {
  // Prevenir scroll en toda la página
  useEffect(() => {
    // Desactivar el scroll
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Restaurar al desmontar
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <FabricacionesProvider> {/* ✅ MOVER EL PROVIDER AQUÍ */}
      <div className="w-full h-screen overflow-hidden m-0 p-0">
        <Simulator />
      </div>
    </FabricacionesProvider>
  );
};

export default Home;