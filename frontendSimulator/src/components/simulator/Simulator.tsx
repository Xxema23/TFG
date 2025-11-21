import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFabricacionesContext } from '../../contexts/FabricacionesContext';
import ScenarioTabs from './ScenarioTabs';
import ControlButtons from './ControlButtons';
import GanttWOs from '../ganttWOs/GanttWOs';
import FilterPanel, { FilterValues } from './FilterPanel';
import ResizableVerticalPanel from './ResizableVerticalPanel';
import DetailTablesPanel from './DetailTablesPanel/index';

import { IFabricacionConHoras } from '../../interfaces/IFabricacionConHoras';
import { UseSimulatorData } from './DetailTablesPanel/hooks/useSimulatorData';

interface IWorkOrderFrontend {
  id: string;
  numWO: string;
  equipo: string;
  secuencia: number;
  linea: string;
  numDoc: string;
  tipDoc: string;
  estadoWO: string;
  fchObjetivo: string;
  fchAcuse: string;
  fchAlbarAn: string;
  importe: number;
  cshTotal: number;
  cliente?: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  precioUnitario?: number;
}

const filterFabricaciones = (
  fabricaciones: IFabricacionConHoras[],
  filterValues: FilterValues,
  defaultLineFilter: string | null
): IFabricacionConHoras[] => {
  if (!Array.isArray(fabricaciones) || fabricaciones.length === 0) {
    return [];
  }

  try {
    let filtered = [...fabricaciones];

    if (filterValues.linea && Array.isArray(filterValues.linea) && filterValues.linea.length > 0) {
      filtered = filtered.filter(fab => {
        return filterValues.linea.includes(fab.Linea);
      });
    }

    if (filterValues.fchObjetivo) {
      filtered = filtered.filter(fab => {
        const fabDate = fab.Fch_Objetivo?.split('T')[0] || fab.Fch_Objetivo;
        return fabDate === filterValues.fchObjetivo;
      });
    }

    if (filterValues.numWO && Array.isArray(filterValues.numWO) && filterValues.numWO.length > 0) {
      filtered = filtered.filter(fab => {
        return filterValues.numWO.includes(fab.NumWO);
      });
    }

    if (filterValues.equipo && Array.isArray(filterValues.equipo) && filterValues.equipo.length > 0) {
      filtered = filtered.filter(fab => {
        return filterValues.equipo.includes(fab.Equipo);
      });
    }

    if (filterValues.numDoc && Array.isArray(filterValues.numDoc) && filterValues.numDoc.length > 0) {
      filtered = filtered.filter(fab => {
        return filterValues.numDoc.includes(fab.Numero_de_pedido || '');
      });
    }

    if (filterValues.tipDoc && Array.isArray(filterValues.tipDoc) && filterValues.tipDoc.length > 0) {
      filtered = filtered.filter(fab => {
        return filterValues.tipDoc.includes(fab.Tipo_de_pedido || '');
      });
    }

    if (filterValues.estadoWO && Array.isArray(filterValues.estadoWO) && filterValues.estadoWO.length > 0) {
      filtered = filtered.filter(fab => {
        const estadoStr = fab.Estado_WO === 1 ? 'Activo' : 
                         fab.Estado_WO === 2 ? 'En Proceso' : 
                         fab.Estado_WO === 3 ? 'Completado' : 
                         fab.Estado_WO === 0 ? 'Pendiente' : 
                         `Estado ${fab.Estado_WO || 'N/A'}`;
        return filterValues.estadoWO.includes(estadoStr);
      });
    }

    return filtered;
  } catch (error) {
    console.error('Error en filterFabricaciones:', error);
    return fabricaciones;
  }
};

const Simulator: React.FC = () => {
  const { fabricaciones, lastUpdated } = useFabricacionesContext();
  
  const [activeScenario, setActiveScenario] = useState<number | null>(1);
  const [selectedWorkOrderIds, setSelectedWorkOrderIds] = useState<string[]>([]);
  
  const DEFAULT_LINE = "S21"; // ✅ Línea por defecto
  
  const [filterValues, setFilterValues] = useState<FilterValues>({
    linea: [DEFAULT_LINE],
    numWO: [],
    numDoc: [],
    equipo: [],
    estadoWO: [],
    tipDoc: [],
    articulo: [],
    proveedor: [],
    fchObjetivo: null
  });

  const [ganttWorkOrders, setGanttWorkOrders] = useState<IFabricacionConHoras[]>([]);
  const [ganttDataLoaded, setGanttDataLoaded] = useState(false);

  const filterValuesRef = useRef(filterValues);
  filterValuesRef.current = filterValues;

  const {
    allWorkOrders = [],
    workOrderColors = {},
    availableComponents = [],
    componentAvailability = {},
    loading: isLoading,
    error,
    defaultLineFilter,
    setDefaultLineFilter
  } = UseSimulatorData();

  const fabricacionesFiltradas = useMemo(() => {
    console.log('🔍 [fabricacionesFiltradas] Evaluando:', {
      total: fabricaciones.length,
      filterValues,
      lastUpdated: lastUpdated?.toISOString()
    });
    
    if (fabricaciones.length === 0) {
      console.log('⚠️ No hay fabricaciones para filtrar');
      return [];
    }
    
    const resultado = filterFabricaciones(fabricaciones, filterValues, defaultLineFilter);
    
    console.log('✅ Fabricaciones filtradas:', {
      total: fabricaciones.length,
      filtradas: resultado.length,
      lastUpdated: lastUpdated?.toISOString(),
      lineasFiltradas: filterValues.linea,
      primeras3: resultado.slice(0, 3).map(f => ({
        NumWO: f.NumWO,
        Linea: f.Linea,
        Fch: f.Fch_Objetivo,
        Seq: f.Secuencia
      }))
    });
    
    return resultado;
  }, [fabricaciones, filterValues, defaultLineFilter, lastUpdated]);

  const hasActiveFilters = useMemo(() => {
    if (!filterValues || typeof filterValues !== 'object') return false;
    
    const lineFilter = Array.isArray(filterValues.linea) ? filterValues.linea : [];
    const hasLineFilter = lineFilter.length > 0;
    
    const hasOtherFilters = Object.entries(filterValues).some(([key, val]) => {
      if (key === 'linea') return false;
      if (key === 'fchObjetivo') return val !== null && val !== undefined && val !== '';
      return Array.isArray(val) && val.length > 0;
    });
    
    return hasLineFilter || hasOtherFilters;
  }, [filterValues]);

  const availableLines = useMemo(() => {
    if (fabricaciones.length === 0) return [];
    
    const lines = new Set<string>();
    for (const fab of fabricaciones) {
      if (fab.Linea && typeof fab.Linea === 'string' && fab.Linea.trim()) {
        lines.add(fab.Linea.trim());
      }
    }
    return Array.from(lines).sort();
  }, [fabricaciones]);

  const filterOptions = useMemo(() => {
    const dataForOptions = fabricaciones;

    if (!Array.isArray(dataForOptions) || dataForOptions.length === 0) {
      return {
        linea: availableLines,
        numWO: [],
        numDoc: [],
        equipo: [],
        estadoWO: [],
        tipDoc: [],
        articulo: [],
        proveedor: []
      };
    }

    const extractValues = (key: keyof IFabricacionConHoras): string[] => {
      const values = new Set<string>();
      for (const fab of dataForOptions) {
        if (fab && fab[key] != null) {
          const val = String(fab[key]).trim();
          if (val !== '') {
            values.add(val);
          }
        }
      }
      return Array.from(values).sort();
    };

    return {
      linea: availableLines,
      numWO: extractValues('NumWO'),
      numDoc: extractValues('Numero_de_pedido'),
      equipo: extractValues('Equipo'),
      estadoWO: dataForOptions.map(fab => {
        return fab.Estado_WO === 1 ? 'Activo' : 
               fab.Estado_WO === 2 ? 'En Proceso' : 
               fab.Estado_WO === 3 ? 'Completado' : 
               fab.Estado_WO === 0 ? 'Pendiente' : 
               `Estado ${fab.Estado_WO || 'N/A'}`;
      }).filter((val, index, arr) => arr.indexOf(val) === index).sort(),
      tipDoc: extractValues('Tipo_de_pedido'),
      articulo: [] as string[],
      proveedor: [] as string[]
    };
  }, [fabricaciones, availableLines]);

  useEffect(() => {
    if (fabricacionesFiltradas.length >= 0) {
      setGanttWorkOrders(fabricacionesFiltradas);
      setGanttDataLoaded(true);
    }
  }, [fabricacionesFiltradas]);

  const availableWOs = useMemo(() => {
    return fabricacionesFiltradas.map((_, index) => `wo_${index}`);
  }, [fabricacionesFiltradas]);

  const handleReorderWO = useCallback((reorderedWOIds: string[]) => {
    if (Array.isArray(reorderedWOIds)) {
      setSelectedWorkOrderIds(prev => 
        Array.isArray(prev) && prev.length > 0 ? reorderedWOIds : prev
      );
    }
  }, []);

  const handleFilterChange = useCallback((newFilters: FilterValues) => {
    if (!newFilters || typeof newFilters !== 'object') {
      console.warn('handleFilterChange: newFilters no es válido');
      return;
    }

    const currentFilters = filterValuesRef.current;
    const hasChanged = JSON.stringify(currentFilters) !== JSON.stringify(newFilters);
    
    if (hasChanged) {
      setFilterValues(newFilters);
    }
  }, []);

  const clearAllFilters = useCallback(() => {
    const currentLine = defaultLineFilter || DEFAULT_LINE;
    setFilterValues({
      linea: [currentLine],
      numWO: [],
      numDoc: [],
      equipo: [],
      estadoWO: [],
      tipDoc: [],
      articulo: [],
      proveedor: [],
      fchObjetivo: null
    });
  }, [defaultLineFilter, DEFAULT_LINE]);

  const handleDefaultLineChange = useCallback((line: string) => {
    if (typeof line === 'string' && line.trim() && setDefaultLineFilter) {
      const trimmedLine = line.trim();
      setDefaultLineFilter(trimmedLine);
      
      setFilterValues(prev => ({
        ...prev,
        linea: [trimmedLine]
      }));
    }
  }, [setDefaultLineFilter]);

  useEffect(() => {
    if (setDefaultLineFilter && fabricaciones.length > 0 && availableLines.length > 0) {
      const hasDefaultLine = availableLines.includes(DEFAULT_LINE);
      
      console.log('🔧 Configurando línea por defecto:', {
        DEFAULT_LINE,
        hasDefaultLine,
        availableLines: availableLines.slice(0, 5),
        currentDefault: defaultLineFilter
      });
      
      if (hasDefaultLine) {
        setDefaultLineFilter(DEFAULT_LINE);
        setFilterValues(prev => ({
          ...prev,
          linea: [DEFAULT_LINE]
        }));
        console.log(`✅ Línea por defecto configurada: ${DEFAULT_LINE}`);
      } else {
        const firstLine = availableLines[0];
        setDefaultLineFilter(firstLine);
        setFilterValues(prev => ({
          ...prev,
          linea: [firstLine]
        }));
        console.log(`⚠️ ${DEFAULT_LINE} no encontrada, usando primera línea: ${firstLine}`);
      }
    }
  }, [fabricaciones.length, availableLines, setDefaultLineFilter, DEFAULT_LINE, defaultLineFilter]);

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
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error al cargar datos</h3>
            <p className="text-red-600 mb-4">{String(error)}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      </div>
    );
  }

  const SafeGanttWOs = () => {
    if (fabricacionesFiltradas.length === 0) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">
                No se encontraron órdenes de trabajo
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {`No hay resultados para los filtros seleccionados. Prueba a modificar los criterios de búsqueda.`}
              </p>
              <div className="mt-4">
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Limpiar filtros
                </button>
              </div>
              <div className="mt-4 text-xs text-gray-400">
                Filtros activos: {Object.entries(filterValues)
                  .filter(([_, value]) => Array.isArray(value) ? value.length > 0 : Boolean(value))
                  .map(([key]) => key)
                  .join(', ')}
              </div>
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
  };

  const SafeDetailTablesPanel = () => {
    console.log('🔑 [SafeDetailTablesPanel] Rendering:', {
      contextLength: fabricaciones.length,
      filteredLength: fabricacionesFiltradas.length,
      hasActiveFilters: hasActiveFilters,
      lastUpdated: lastUpdated?.toISOString()
    });

    const baseProps = {
      workOrders: [],
      workOrderColors: workOrderColors,
      availableComponents: availableComponents,
      componentAvailability: componentAvailability,
      onReorderWO: handleReorderWO,
      selectedWorkOrderIds: selectedWorkOrderIds,
      availableWOs: availableWOs,
      
      filteredFabrications: fabricacionesFiltradas,
      useFilteredData: hasActiveFilters,
      defaultLineFilter: defaultLineFilter,
      lastUpdated: lastUpdated
    };

    try {
      return <DetailTablesPanel {...baseProps} />;
    } catch (error) {
      console.warn('Error con DetailTablesPanel:', error);
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-600 mb-2">Error cargando tablas de detalle</p>
            <p className="text-sm text-gray-500">
              Datos del contexto: {fabricaciones.length} fabricaciones
            </p>
          </div>
        </div>
      );
    }
  };

  const SafeScenarioTabs = () => {
    const propVariations = [
      { selectedScenario: activeScenario, onScenarioChange: setActiveScenario },
      { activeScenario: activeScenario, onScenarioSelect: setActiveScenario },
      { scenario: activeScenario, onChange: setActiveScenario },
      { current: activeScenario, onSelect: setActiveScenario }
    ];

    for (let i = 0; i < propVariations.length; i++) {
      try {
        return <ScenarioTabs {...propVariations[i]} />;
      } catch (error) {
        console.warn(`Error con ScenarioTabs propVariations[${i}]`);
        continue;
      }
    }

    return (
      <div className="px-4 py-2 bg-gray-100 rounded">
        <span className="text-sm text-gray-600">Scenarios</span>
      </div>
    );
  };

  const SafeControlButtons = () => {
    const propVariations = [
      { scenarioId: activeScenario, currentView: "details", onViewChange: () => {} },
      { scenario: activeScenario, view: "details", onViewChange: () => {} },
      { activeScenario: activeScenario, selectedView: "details", onViewSelect: () => {} }
    ];

    for (let i = 0; i < propVariations.length; i++) {
      try {
        return <ControlButtons {...propVariations[i]} />;
      } catch (error) {
        console.warn(`Error con ControlButtons propVariations[${i}]`);
        continue;
      }
    }

    return (
      <div className="flex space-x-2">
        <button className="px-3 py-1 bg-blue-500 text-white rounded text-sm">
          Control
        </button>
      </div>
    );
  };

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden">
      <div className="flex justify-between items-center p-2 bg-white border-b flex-shrink-0">
        <SafeScenarioTabs />
        
        <div className="flex items-center space-x-2">
          <SafeControlButtons />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ResizableVerticalPanel 
          top={
            <div className="flex h-full">
              <div className="w-3/4 border-r overflow-hidden">
                <SafeGanttWOs />
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
                <SafeDetailTablesPanel />
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