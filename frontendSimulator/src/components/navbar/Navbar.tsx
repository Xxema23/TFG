import React from 'react';
import { Link } from 'react-router-dom';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-blue-900 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <img 
            src="/carrier-logo.png" 
            alt="Carrier Logo" 
            className="h-8 mr-3"
          />
          <span className="text-xl font-bold">Planning Simulator</span>
        </div>
        
        <div className="flex space-x-8">
          <Link to="/" className="hover:underline">Inicio</Link>
          <Link to="/informacion" className="hover:underline">Información</Link>
          <Link to="/servicios" className="hover:underline">Servicios</Link>
          <Link to="/contact" className="hover:underline">Contacto</Link>
        </div>
        
        <button className="bg-blue-600 text-white py-1 px-4 rounded hover:bg-blue-700">
          Generar Excel
        </button>
      </div>
    </nav>
  );
};

export default Navbar;