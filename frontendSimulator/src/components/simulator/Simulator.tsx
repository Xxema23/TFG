import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFabricacionesContext, useFabricacionesActions } from '../../contexts/FabricacionesContext';
import ScenarioTabs from './ScenarioTabs';
import ControlButtons from './ControlButtons';
import GanttWOs from '../ganttWOs/GanttWOs';
import FilterPanel, { FilterValues } from './FilterPanel';
import ResizableVerticalPanel from './ResizableVerticalPanel';
import DetailTablesPanel from './DetailTablesPanel/index';

import { IFabricacionConHoras } from '../../interfaces/IFabricacionConHoras';
import { UseSimulatorData } from './DetailTablesPanel/hooks/useSimulatorData';
import axios from '../../api';
import { IPalet } from '../../interfaces/ISimulatorData';

const DEBUG_MODE = false;

const filterFabricaciones = (
  fabricaciones: IFabricacionConHoras[],
  filterValues: FilterValues,
  defaultLineFilter: string | null,
  paletsMap: Map<string, IPalet>
): IFabricacionConHoras[] => {
  if (!Array.isArray(fabricaciones) || fabricaciones.length === 0) return [];

  try {
    let filtered = fabricaciones;

    if (filterValues.linea?.length > 0)
      filtered = filtered.filter(fab => filterValues.linea.includes(fab.Linea));

    if (filterValues.fchObjetivo)
      filtered = filtered.filter(fab =>
        (fab.Fch_Objetivo?.split('T')[0] || fab.Fch_Objetivo) === filterValues.fchObjetivo
      );

    if (filterValues.numWO?.length > 0)
      filtered = filtered.filter(fab => filterValues.numWO.includes(fab.NumWO));

    if (filterValues.equipo?.length > 0)
      filtered = filtered.filter(fab => filterValues.equipo.includes(fab.Equipo));

    if (filterValues.estadoWO?.length > 0)
    filtered = filtered.filter(fab => filterValues.estadoWO.includes(fab.Estado_WO || ''));

    if (filterValues.palets?.length > 0)
      filtered = filtered.filter(fab => {
        const palet = paletsMap.get(fab.NumWO);
        return palet && filterValues.palets.includes(palet.num_de_palet);
      });
    
    if (filterValues.sigCode?.length > 0)
    filtered = filtered.filter(fab => filterValues.sigCode.includes(fab.sig_code || ''));

    return filtered;
  } catch (error) {
    console.error('Error en filterFabricaciones:', error);
    return fabricaciones;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ FIX CRÍTICO: Componentes declarados FUERA de Simulator para evitar re-mount
// en cada render.
// ─────────────────────────────────────────────────────────────────────────────

interface GanttPanelProps {
  fabricacionesFiltradas: IFabricacionConHoras[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const GanttPanel = React.memo(({
  fabricacionesFiltradas,
  hasActiveFilters,
  onClearFilters
}: GanttPanelProps) => {
  if (fabricacionesFiltradas.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No se encontraron órdenes de trabajo</h3>
          <p className="mt-2 text-sm text-gray-500">
            No hay resultados para los filtros seleccionados. Prueba a modificar los criterios de búsqueda.
          </p>
          <div className="mt-4">
            <button
              onClick={onClearFilters}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <GanttWOs
      filteredWorkOrders={fabricacionesFiltradas}
      filterActive={hasActiveFilters}
      refetchFabricaciones={async () => {}}
    />
  );
});

interface DetailPanelProps {
  availableComponents: string[];
  componentAvailability: Record<string, any>;
  handleReorderWO: (ids: string[]) => void;
  selectedWorkOrderIds: string[];
  availableWOs: string[];
  fabricacionesFiltradas: IFabricacionConHoras[];
  hasActiveFilters: boolean;
  defaultLineFilter: string | null;
  lastUpdated: Date | null;
  fabricaciones: IFabricacionConHoras[];
  paletsMap: Map<string, IPalet>;
}

const DetailPanel = React.memo(({
  availableComponents,
  componentAvailability,
  handleReorderWO,
  selectedWorkOrderIds,
  availableWOs,
  fabricacionesFiltradas,
  hasActiveFilters,
  defaultLineFilter,
  lastUpdated,
  fabricaciones,
  paletsMap,
}: DetailPanelProps) => {
  try {
    return (
      <DetailTablesPanel
        workOrders={[]}
        availableComponents={availableComponents}
        componentAvailability={componentAvailability}
        onReorderWO={handleReorderWO}
        selectedWorkOrderIds={selectedWorkOrderIds}
        availableWOs={availableWOs}
        filteredFabrications={fabricacionesFiltradas}
        useFilteredData={hasActiveFilters}
        defaultLineFilter={defaultLineFilter}
        lastUpdated={lastUpdated}
        ganttCapacity={undefined}
        ganttWorkingDays={undefined}
        paletsMap={paletsMap}
      />
    );
  } catch (error) {
    console.warn('Error con DetailTablesPanel:', error);
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Error cargando tablas de detalle</p>
          <p className="text-sm text-gray-500">Datos del contexto: {fabricaciones.length} fabricaciones</p>
        </div>
      </div>
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const Simulator: React.FC = () => {
  const { fabricaciones, lastUpdated } = useFabricacionesContext();

  const [activeScenario, setActiveScenarioLocal] = useState<number | null>(1);
  const [visibleScenarioCount, setVisibleScenarioCount] = useState<number>(1);  
  const { setActiveScenario } = useFabricacionesActions();

  const handleScenarioChange = useCallback((scenarioId: number | null) => {
    setActiveScenarioLocal(scenarioId);
    if (scenarioId) setActiveScenario(scenarioId);
  }, [setActiveScenario]);
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState<string[]>([]);

  const STORAGE_KEY = 'simulator_last_selected_line';
  const DEFAULT_LINE = "S21";

  const getStoredLine = useCallback((): string => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored?.trim()) return stored.trim();
    } catch (error) {
      console.warn('⚠️ Error leyendo localStorage:', error);
    }
    return DEFAULT_LINE;
  }, []);

  const saveLineToStorage = useCallback((line: string): void => {
    try {
      if (line?.trim()) localStorage.setItem(STORAGE_KEY, line.trim());
    } catch (error) {
      console.warn('⚠️ Error guardando en localStorage:', error);
    }
  }, []);

  const [filterValues, setFilterValues] = useState<FilterValues>({
      linea: [getStoredLine()],
      numWO: [],
      equipo: [],
      estadoWO: [],
      sigCode: [],
      palets: [],
      fchObjetivo: null
  });

  const [hasInitialized, setHasInitialized] = useState(false);

  const [paletsMap, setPaletsMap] = useState<Map<string, IPalet>>(new Map());

    useEffect(() => {
      axios.get('http://192.168.18.4:8000/api/palets')
        .then(r => {
          const map = new Map<string, IPalet>();
          r.data.forEach((p: IPalet) => {
            if (p.num_orden) map.set(p.num_orden, p);
          });
          setPaletsMap(map);
        });
    }, []);

  const filterValuesRef = useRef(filterValues);
  filterValuesRef.current = filterValues;

  const {
    availableComponents = [],
    componentAvailability = {},
    loading: isLoading,
    error,
    defaultLineFilter,
    setDefaultLineFilter
  } = UseSimulatorData();

  const fabricacionesFiltradas = useMemo(() => {
    if (fabricaciones.length === 0) return [];
    return filterFabricaciones(fabricaciones, filterValues, defaultLineFilter, paletsMap);
  }, [fabricaciones, filterValues, defaultLineFilter, paletsMap]);

  const hasActiveFilters = useMemo(() => {
    if (!filterValues || typeof filterValues !== 'object') return false;
    const lineFilter = Array.isArray(filterValues.linea) ? filterValues.linea : [];
    const hasOtherFilters = Object.entries(filterValues).some(([key, val]) => {
      if (key === 'linea') return false;
      if (key === 'fchObjetivo') return val !== null && val !== undefined && val !== '';
      return Array.isArray(val) && val.length > 0;
    });
    return lineFilter.length > 0 || hasOtherFilters;
  }, [filterValues]);

  const availableLines = useMemo(() => {
    if (fabricaciones.length === 0) return [];
    const lines = new Set<string>();
    for (const fab of fabricaciones) {
      if (fab.Linea?.trim()) lines.add(fab.Linea.trim());
    }
    return Array.from(lines).sort();
  }, [fabricaciones]);

  const filterOptions = useMemo(() => {
    if (!Array.isArray(fabricaciones) || fabricaciones.length === 0) {
      return { linea: availableLines, numWO: [], equipo: [], estadoWO: [], sigCode: [], palets: []};
    }

    const extractValues = (key: keyof IFabricacionConHoras): string[] => {
      const values = new Set<string>();
      for (const fab of fabricaciones) {
        if (fab[key] != null) {
          const val = String(fab[key]).trim();
          if (val) values.add(val);
        }
      }
      return Array.from(values).sort();
    };

    const paletNums = [...new Set(
        Array.from(paletsMap.values())
          .filter(p => p.num_de_palet)
          .map(p => p.num_de_palet)
      )].sort();

    return {
        linea: availableLines,
        numWO: extractValues('NumWO'),
        equipo: extractValues('Equipo'),
        estadoWO: extractValues('Estado_WO'),
        sigCode: extractValues('sig_code'),
        palets: paletNums
    };
  }, [fabricaciones, availableLines, paletsMap]);

  const availableWOs = useMemo(() => {
    return fabricacionesFiltradas.map((_, i) => `wo_${i}`);
  }, [fabricacionesFiltradas]);

  const handleReorderWO = useCallback((reorderedWOIds: string[]) => {
    if (Array.isArray(reorderedWOIds)) {
      setSelectedWorkOrderIds(prev =>
        Array.isArray(prev) && prev.length > 0 ? reorderedWOIds : prev
      );
    }
  }, []);

  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    if (!newFilters || typeof newFilters !== 'object') return;
    const hasChanged = JSON.stringify(filterValuesRef.current) !== JSON.stringify(newFilters);
    if (hasChanged) setFilterValues(newFilters);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterValues({
        linea: [defaultLineFilter || DEFAULT_LINE],
        numWO: [],
        equipo: [],
        estadoWO: [],
        sigCode: [],
        palets: [],
        fchObjetivo: null
    });
  }, [defaultLineFilter]);

  const handleDefaultLineChange = useCallback((line: string) => {
    if (typeof line === 'string' && line.trim() && setDefaultLineFilter) {
      const trimmedLine = line.trim();
      if (getStoredLine() !== trimmedLine) saveLineToStorage(trimmedLine);
      setDefaultLineFilter(trimmedLine);
    }
  }, [setDefaultLineFilter, saveLineToStorage, getStoredLine]);

  useEffect(() => {
    if (hasInitialized || !setDefaultLineFilter || fabricaciones.length === 0 || availableLines.length === 0) return;

    const storedLine = getStoredLine();
    const lineToUse =
      availableLines.includes(storedLine) ? storedLine :
      availableLines.includes(DEFAULT_LINE) ? DEFAULT_LINE :
      availableLines[0];

    setDefaultLineFilter(lineToUse);
    setFilterValues(prev => ({ ...prev, linea: [lineToUse] }));
    saveLineToStorage(lineToUse);
    setHasInitialized(true);
  }, [fabricaciones.length, availableLines.length]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos del simulador...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error al cargar datos</h3>
          <p className="text-red-600 mb-4">{String(error)}</p>
          <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden">
      <div className="flex justify-between items-center p-2 bg-white border-b flex-shrink-0">
        <ScenarioTabs
            selectedScenario={activeScenario}
            onScenarioChange={handleScenarioChange}
            visibleCount={visibleScenarioCount}
            onVisibleCountChange={setVisibleScenarioCount}
          />
        <div className="flex items-center space-x-2">
          <ControlButtons 
            scenarioId={activeScenario} 
            currentView="details" 
            onViewChange={() => {}}
            fabricacionesFiltradas={fabricacionesFiltradas}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizableVerticalPanel
          top={
            <div className="flex h-full">
              <div className="w-3/4 border-r overflow-hidden">
                <GanttPanel
                  fabricacionesFiltradas={fabricacionesFiltradas}
                  hasActiveFilters={hasActiveFilters}
                  onClearFilters={clearAllFilters}
                />
              </div>
              <div className="w-1/4 overflow-hidden">
                <FilterPanel
                  filterValues={filterValues}
                  onFilterChange={handleFilterChange}
                  onClearFilters={clearAllFilters}
                  workOrders={[]}
                  selectedScenario={activeScenario}
                  filterOptions={filterOptions}
                  defaultLineFilter={defaultLineFilter || undefined}
                  onDefaultLineChange={handleDefaultLineChange}
                  availableLines={availableLines}
                  allWorkOrders={[]}
                />
              </div>
            </div>
          }
            bottom={
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-hidden">
                  <DetailPanel
                    availableComponents={availableComponents}
                    componentAvailability={componentAvailability}
                    handleReorderWO={handleReorderWO}
                    selectedWorkOrderIds={selectedWorkOrderIds}
                    availableWOs={availableWOs}
                    fabricacionesFiltradas={fabricacionesFiltradas}
                    hasActiveFilters={hasActiveFilters}
                    defaultLineFilter={defaultLineFilter}
                    lastUpdated={lastUpdated}
                    fabricaciones={fabricaciones}
                    paletsMap={paletsMap}
                  />
                </div>
              </div>
          }
          initialBottomHeight="40%"
        />
      </div>
    </div>
  );
};

export default Simulator;