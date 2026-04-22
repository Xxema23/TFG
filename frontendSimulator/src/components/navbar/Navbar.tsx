import React from 'react';

const Navbar: React.FC = () => {
  return (
    <nav className="bg-blue-900 text-white p-4">
      <div className="container mx-auto flex justify-center items-center">
        <div className="flex items-center">
          <img 
            src="/logo.png" 
            alt="Carrier Logo" 
            className="h-8 mr-3"
          />
          <span className="text-xl font-bold">Planning Simulator</span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;