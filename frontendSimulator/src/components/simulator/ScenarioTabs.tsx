import React, { useState, useEffect } from 'react';

type ScenarioTabsProps = {
  onScenarioChange: (scenarioId: number | null) => void;
};

const ScenarioTabs: React.FC<ScenarioTabsProps> = ({ onScenarioChange }) => {
  const [scenarios, setScenarios] = useState([
    { id: 1, name: 'Escenario 1-1.5 a 3T' },
    { id: 2, name: 'Escenario 2-1.3 a 2T' },
    { id: 3, name: 'Escenario 3-3T' },
  ]);
  
  const [activeScenarioId, setActiveScenarioId] = useState<number | null>(null);

  useEffect(() => {
    if (scenarios.length > 0 && activeScenarioId === null) {
      setActiveScenarioId(scenarios[0].id);
      onScenarioChange(scenarios[0].id);
    }
  }, [scenarios, activeScenarioId, onScenarioChange]);

  const handleScenarioChange = (scenarioId: number) => {
    setActiveScenarioId(scenarioId);
    onScenarioChange(scenarioId);
  };

  const handleAddScenario = () => {
    alert('Agregar escenario - pendiente de implementación');
  };

  return (
    <div className="flex space-x-1">
      {scenarios.map(scenario => (
// Modificación en los estilos de botones para mejor coincidencia con la imagen
      <button
        key={scenario.id}
        className={`px-4 py-2 text-sm rounded-md font-medium ${
          activeScenarioId === scenario.id 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-200 hover:bg-gray-300'
        }`}
        onClick={() => handleScenarioChange(scenario.id)}
      >
        {scenario.name}
      </button>
      ))}
      <button 
        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
        onClick={handleAddScenario}
      >
        Agregar escenario +
      </button>
    </div>
  );
};

export default ScenarioTabs;