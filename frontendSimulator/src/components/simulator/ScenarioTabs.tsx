import React from 'react';
import { useFabricacionesActions } from '../../contexts/FabricacionesContext';

type ScenarioTabsProps = {
  selectedScenario: number | null;
  onScenarioChange: (scenarioId: number | null) => void;
};

const scenarios = [
  { id: 1, name: 'Escenario 1-1.5 a 3T' },
  { id: 2, name: 'Escenario 2-1.3 a 2T' },
  { id: 3, name: 'Escenario 3-3T' },
];

const ScenarioTabs: React.FC<ScenarioTabsProps> = ({ selectedScenario, onScenarioChange }) => {
  const { setActiveScenario } = useFabricacionesActions();

  const handleScenarioChange = (scenarioId: number) => {
    setActiveScenario(scenarioId);
    onScenarioChange(scenarioId);
  };

  return (
    <div className="flex space-x-1">
      {scenarios.map(scenario => (
        <button
          key={scenario.id}
          className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
            selectedScenario === scenario.id
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
          }`}
          onClick={() => handleScenarioChange(scenario.id)}
        >
          {scenario.name}
        </button>
      ))}
    </div>
  );
};

export default ScenarioTabs;