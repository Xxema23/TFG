import React from 'react';
import { useFabricacionesActions } from '../../contexts/FabricacionesContext';

type ScenarioTabsProps = {
  selectedScenario: number | null;
  onScenarioChange: (scenarioId: number | null) => void;
  visibleCount: number;
  onVisibleCountChange: (count: number) => void;
};

const ALL_SCENARIOS = [
  { id: 1, name: 'Escenario 1-1.5 a 3T' },
  { id: 2, name: 'Escenario 2-1.3 a 2T' },
  { id: 3, name: 'Escenario 3-3T' },
];

const ScenarioTabs: React.FC<ScenarioTabsProps> = ({
  selectedScenario,
  onScenarioChange,
  visibleCount,
  onVisibleCountChange,
}) => {
  const { setActiveScenario } = useFabricacionesActions();

  const handleScenarioChange = (scenarioId: number) => {
    setActiveScenario(scenarioId);
    onScenarioChange(scenarioId);
  };

  const handleAddScenario = () => {
    const nextId = ALL_SCENARIOS[visibleCount].id;
    onVisibleCountChange(visibleCount + 1);
    handleScenarioChange(nextId);
  };

  const visibleScenarios = ALL_SCENARIOS.slice(0, visibleCount);
  const canAddMore = visibleCount < ALL_SCENARIOS.length;

  return (
    <div className="flex items-center space-x-1">
      {visibleScenarios.map(scenario => (
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
      {canAddMore && (
        <button
          className="px-3 py-2 text-sm rounded-md font-medium bg-gray-100 hover:bg-gray-200 text-gray-500 border border-dashed border-gray-400 transition-colors"
          onClick={handleAddScenario}
          title="Añadir escenario"
        >
          +
        </button>
      )}
    </div>
  );
};

export default ScenarioTabs;