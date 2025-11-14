import React, { useState, useEffect, useMemo, useCallback } from 'react';

const useDebouncedValue = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export type FilterValues = {
  linea: string[];
  numWO: string[];
  numDoc: string[];
  equipo: string[];
  estadoWO: string[];
  tipDoc: string[];
  articulo: string[];
  proveedor: string[];
  fchObjetivo: string | null;
};

type FilterOptions = {
  linea: string[];
  numWO: string[];
  numDoc: string[];
  equipo: string[];
  estadoWO: string[];
  tipDoc: string[];
  articulo: string[];
  proveedor: string[];
};

type FilterPanelProps = {
  filterValues: FilterValues;
  onFilterChange: (filters: FilterValues) => void;
  onClearFilters: () => void;
  workOrders?: any[];
  selectedScenario?: number | null;
  defaultLineFilter?: string;
  onDefaultLineChange?: (line: string) => void;
  availableLines?: string[]; 
  allWorkOrders?: any[];
  filterOptions?: FilterOptions; // ✅ NUEVO: Recibir opciones desde el componente padre
};

// ✅ Definir valores iniciales seguros para los filtros
const createSafeFilterValues = (filterValues: Partial<FilterValues>): FilterValues => {
  return {
    linea: Array.isArray(filterValues.linea) ? filterValues.linea : [],
    numWO: Array.isArray(filterValues.numWO) ? filterValues.numWO : [],
    numDoc: Array.isArray(filterValues.numDoc) ? filterValues.numDoc : [],
    equipo: Array.isArray(filterValues.equipo) ? filterValues.equipo : [],
    estadoWO: Array.isArray(filterValues.estadoWO) ? filterValues.estadoWO : [],
    tipDoc: Array.isArray(filterValues.tipDoc) ? filterValues.tipDoc : [],
    articulo: Array.isArray(filterValues.articulo) ? filterValues.articulo : [],
    proveedor: Array.isArray(filterValues.proveedor) ? filterValues.proveedor : [],
    fchObjetivo: filterValues.fchObjetivo || null
  };
};

const FilterPanel: React.FC<FilterPanelProps> = ({ 
  filterValues: rawFilterValues,
  onFilterChange,
  onClearFilters,
  workOrders = [],
  selectedScenario = null,
  defaultLineFilter = '',
  onDefaultLineChange = () => {},
  availableLines = [],
  allWorkOrders = [],
  filterOptions: providedFilterOptions // ✅ NUEVO: Opciones proporcionadas por el padre
}) => {
  // ✅ CORREGIDO: Asegurarnos de que filterValues tiene todos los arrays inicializados
  const filterValues = useMemo(() => 
    createSafeFilterValues(rawFilterValues)
  , [rawFilterValues]);

  const [activeTab, setActiveTab] = useState<string>('linea');
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebouncedValue(searchText, 300);

  // Log renderizados para depuración
  console.log('🔄 FilterPanel renderizado', { 
    filterValuesLineas: filterValues.linea,
    defaultLineFilter,
    workOrdersCount: workOrders.length,
    activeTab,
    providedOptions: !!providedFilterOptions
  });

  // ✅ CORREGIDO: Usar las opciones proporcionadas por el padre o generar como fallback
  const filterOptions = useMemo(() => {
    // Si el padre proporciona las opciones, usarlas directamente
    if (providedFilterOptions) {
      console.log('📊 Usando opciones proporcionadas por el padre');
      return {
        ...providedFilterOptions,
        linea: availableLines.length > 0 ? availableLines : providedFilterOptions.linea
      };
    }

    // Fallback: generar opciones localmente (código original)
    try {
      const safeAllWorkOrders = Array.isArray(allWorkOrders) 
        ? allWorkOrders.filter(wo => wo && typeof wo === 'object' && typeof wo.numWO !== 'undefined')
        : [];

      const safeWorkOrders = Array.isArray(workOrders) 
        ? workOrders.filter(wo => wo && typeof wo === 'object' && typeof wo.numWO !== 'undefined')
        : [];

      // Obtener todas las líneas disponibles
      let allAvailableLines;
      if (availableLines && availableLines.length > 0) {
        allAvailableLines = availableLines;
      } else if (safeAllWorkOrders.length > 0) {
        const lineas = safeAllWorkOrders
          .map(wo => wo.linea)
          .filter(val => val !== null && val !== undefined && val !== '')
          .map(val => String(val));
        allAvailableLines = [...new Set(lineas)].sort();
      } else {
        const lineas = safeWorkOrders
          .map(wo => wo.linea)
          .filter(val => val !== null && val !== undefined && val !== '')
          .map(val => String(val));
        allAvailableLines = [...new Set(lineas)].sort();
      }

      // Si no hay work orders filtrados, usar solo líneas disponibles
      if (safeWorkOrders.length === 0) {
        return {
          linea: allAvailableLines,
          numWO: [],
          numDoc: [],
          equipo: [],
          estadoWO: [],
          tipDoc: [],
          articulo: [],
          proveedor: []
        };
      }

      const extractUniqueValues = (key: string) => {
        const values = safeWorkOrders
          .map(wo => wo[key])
          .filter(val => val !== null && val !== undefined && val !== '')
          .map(val => String(val));
        return [...new Set(values)].sort();
      };

      const result = {
        linea: allAvailableLines,
        numWO: extractUniqueValues('numWO'),
        numDoc: extractUniqueValues('numDoc'),
        equipo: extractUniqueValues('equipo'),
        estadoWO: extractUniqueValues('estadoWO'),
        tipDoc: extractUniqueValues('tipDoc'),
        articulo: extractUniqueValues('articulo') || [],
        proveedor: extractUniqueValues('proveedor') || []
      };
      
      console.log('📊 Opciones de filtro generadas (fallback):', {
        lineaCount: result.linea.length,
        numWOCount: result.numWO.length,
        equipoCount: result.equipo.length
      });
      
      return result;
    } catch (error) {
      console.error('❌ Error al generar opciones de filtros:', error);
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
  }, [providedFilterOptions, availableLines, allWorkOrders, workOrders]);

  // ✅ CORREGIDO: Asegurarnos de que currentValues siempre es un array válido
  const toggleFilterValue = useCallback((type: keyof FilterValues, value: string) => {
    try {
      console.log(`🔍 Toggling filter: ${type}="${value}"`);
      
      // ✅ CORREGIDO: Crear copia segura de los filtros con arrays inicializados
      const newFilters = createSafeFilterValues(filterValues);
      
      if (type === 'fchObjetivo') {
        newFilters[type] = value || null;
      } else {
        // ✅ CORREGIDO: Asegurarnos de que currentValues siempre sea un array
        const currentValues = Array.isArray(newFilters[type]) 
          ? newFilters[type] as string[] 
          : [];
        
        const isSelected = currentValues.includes(value);
        
        // Actualizar el array de valores seleccionados
        if (isSelected) {
          newFilters[type] = currentValues.filter(v => v !== value);
          console.log(`🔍 Removiendo ${value} de ${type}`);
        } else {
          newFilters[type] = [...currentValues, value];
          console.log(`🔍 Añadiendo ${value} a ${type}`);
        }
        
        // Si estamos en la pestaña de línea, NO actualizar la línea predeterminada automáticamente
        // La línea predeterminada solo se actualiza cuando se limpia el filtro
        if (type === 'linea') {
          console.log(`🔍 Filtro de línea cambiado, manteniendo línea predeterminada: ${defaultLineFilter}`);
          // No cambiar la línea predeterminada aquí
        }
      }
      
      // CRUCIAL: Aplicar los filtros a través del callback proporcionado
      console.log(`🔍 Aplicando nuevos filtros:`, newFilters);
      onFilterChange(newFilters);
      
    } catch (error) {
      console.error('❌ Error al cambiar filtro:', error);
    }
  }, [filterValues, onFilterChange, onDefaultLineChange]);

  const selectAll = useCallback(() => {
    if (activeTab === 'fchObjetivo') return;
    
    try {
      console.log(`🔍 Seleccionando todas las opciones en: ${activeTab}`);
      
      // ✅ CORREGIDO: Crear copia segura de los filtros
      const newFilters = createSafeFilterValues(filterValues);
      newFilters[activeTab as keyof FilterOptions] = [...filterOptions[activeTab as keyof FilterOptions]];
      
      // Si estamos seleccionando todas las líneas, podemos mantener la predeterminada
      if (activeTab === 'linea' && defaultLineFilter && newFilters.linea.includes(defaultLineFilter)) {
        console.log(`🏠 Manteniendo línea predeterminada: ${defaultLineFilter}`);
      }
      
      console.log(`🔍 Nuevos filtros después de Seleccionar Todos:`, newFilters);
      onFilterChange(newFilters);
    } catch (error) {
      console.error('❌ Error al seleccionar todos:', error);
    }
  }, [activeTab, filterValues, filterOptions, onFilterChange, defaultLineFilter]);

  const selectNone = useCallback(() => {
    try {
      console.log(`🔍 Deseleccionando todas las opciones en: ${activeTab}`);
      
      // ✅ CORREGIDO: Crear copia segura de los filtros
      const newFilters = createSafeFilterValues(filterValues);
      
      if (activeTab === 'fchObjetivo') {
        newFilters.fchObjetivo = null;
      } else {
        newFilters[activeTab as keyof FilterOptions] = [];
      }
      
      console.log(`🔍 Nuevos filtros después de Seleccionar Ninguno:`, newFilters);
      onFilterChange(newFilters);
    } catch (error) {
      console.error('❌ Error al deseleccionar todos:', error);
    }
  }, [activeTab, filterValues, onFilterChange]);

  // Limpiar búsqueda al cambiar de pestaña
  useEffect(() => {
    setSearchText('');
  }, [activeTab]);

  // Filtrar opciones según el texto de búsqueda
  const filteredOptions = useMemo(() => {
    try {
      if (activeTab === 'fchObjetivo') return [];
      
      const options = filterOptions[activeTab as keyof FilterOptions] || [];
      if (!debouncedSearchText) return options;
      
      const filtered = options.filter(option => 
        String(option).toLowerCase().includes(debouncedSearchText.toLowerCase())
      );
      
      console.log(`🔍 Opciones filtradas por búsqueda: ${filtered.length}/${options.length} para "${debouncedSearchText}"`);
      
      return filtered;
    } catch (error) {
      console.error('❌ Error al filtrar opciones:', error);
      return [];
    }
  }, [filterOptions, activeTab, debouncedSearchText]);

  // Renderizar las opciones del filtro activo
  const renderFilterOptions = () => {
    if (activeTab === 'fchObjetivo') {
      return (
        <div className="p-3 h-full">
          <label className="block text-sm mb-1">Fecha Objetivo</label>
          <input 
            type="date" 
            className="w-full px-2 py-1 border rounded text-sm"
            value={filterValues.fchObjetivo || ''}
            onChange={(e) => onFilterChange({
              ...createSafeFilterValues(filterValues),
              fchObjetivo: e.target.value || null
            })}
          />
        </div>
      );
    }

    return (
      <div className="p-3 h-full flex flex-col">
        <div className="mb-2 flex justify-between items-center flex-shrink-0">
          <span className="text-sm font-medium">Seleccionar</span>
          <div>
            <button 
              className="text-xs text-blue-600 mr-2 hover:text-blue-800"
              onClick={selectAll}
              disabled={filteredOptions.length === 0}
            >
              Todos
            </button>
            <button 
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={selectNone}
            >
              Ninguno
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto border rounded">
          {filteredOptions.length === 0 ? (
            <div className="p-2 text-center text-gray-500 text-xs">
              {debouncedSearchText ? 'No se encontraron resultados' : 'No hay opciones disponibles'}
            </div>
          ) : (
            filteredOptions.map(option => (
              <div key={option} className="flex items-center px-2 py-1 hover:bg-gray-50">
                <input
                  type="checkbox"
                  id={`${activeTab}-${option}`}
                  checked={Array.isArray(filterValues[activeTab as keyof FilterValues]) 
                    ? (filterValues[activeTab as keyof FilterValues] as string[]).includes(option)
                    : false}
                  onChange={() => toggleFilterValue(activeTab as keyof FilterValues, option)}
                  className="mr-2"
                />
                <label htmlFor={`${activeTab}-${option}`} className="text-xs cursor-pointer flex-grow">
                  {option}
                </label>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // ✅ NUEVO: Pestañas con diseño mejorado para mostrar todos los nombres
  const filterTabs = [
    { key: 'linea', label: 'Línea' },
    { key: 'numWO', label: 'NumWO' },
    { key: 'numDoc', label: 'NumDoc' },
    { key: 'equipo', label: 'Equipo' },
    { key: 'estadoWO', label: 'Estado' },
    { key: 'tipDoc', label: 'TipDoc' },
    { key: 'articulo', label: 'Artículo' },
    { key: 'proveedor', label: 'Proveedor' },
    { key: 'fchObjetivo', label: 'Fecha' }
  ];

  // Contar filtros aplicados
  const appliedFiltersCount = useMemo(() => {
    return Object.entries(filterValues).reduce((count, [key, values]) => {
      if (Array.isArray(values) && values.length > 0) return count + 1;
      if (key === 'fchObjetivo' && values) return count + 1;
      return count;
    }, 0);
  }, [filterValues]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-gray-800">FILTROS</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {appliedFiltersCount} aplicado{appliedFiltersCount !== 1 ? 's' : ''}
            </span>
            <button
              onClick={onClearFilters}
              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 transition-colors"
              disabled={appliedFiltersCount === 0}
            >
              Limpiar
            </button>
          </div>
        </div>
        {selectedScenario && (
          <div className="mt-2 text-xs text-gray-600">
            Escenario: {selectedScenario}
          </div>
        )}
      </div>

      {/* ✅ MEJORADO: Pestañas en grid para mostrar todas a la vez */}
      <div className="border-b bg-gray-50 flex-shrink-0 p-2">
        <div className="grid grid-cols-3 gap-1">
          {filterTabs.map(tab => {
            const isActive = activeTab === tab.key;
            const hasValues = (Array.isArray(filterValues[tab.key as keyof FilterValues]) && 
                              (filterValues[tab.key as keyof FilterValues] as string[]).length > 0) || 
                             (tab.key === 'fchObjetivo' && filterValues.fchObjetivo);
            const count = tab.key === 'fchObjetivo' ? 
                         (filterValues.fchObjetivo ? 1 : 0) : 
                         (filterValues[tab.key as keyof FilterValues] as string[])?.length || 0;
            
            return (
              <button
                key={tab.key}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors text-center relative ${
                  isActive 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 bg-white border'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {hasValues && (
                  <span className={`absolute -top-1 -right-1 text-xs rounded-full px-1 min-w-4 h-4 flex items-center justify-center ${
                    isActive ? 'bg-white text-blue-500' : 'bg-red-500 text-white'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Búsqueda */}
      {activeTab !== 'fchObjetivo' && (
        <div className="p-3 border-b flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              placeholder={`Buscar en ${filterTabs.find(t => t.key === activeTab)?.label}...`}
              className="w-full px-3 py-2 pr-8 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
          {debouncedSearchText && (
            <p className="text-xs text-gray-500 mt-1">
              {filteredOptions.length} resultado{filteredOptions.length !== 1 ? 's' : ''} para "{debouncedSearchText}"
            </p>
          )}
        </div>
      )}

      {/* Opciones del filtro activo */}
      <div className="flex-1 overflow-hidden">
        {renderFilterOptions()}
      </div>

      {/* Resumen de filtros aplicados */}
      <div className="p-3 border-t bg-gray-50 flex-shrink-0 max-h-32 overflow-y-auto">
        <div className="text-xs font-medium text-gray-700 mb-2">
          Filtros aplicados ({appliedFiltersCount}):
        </div>
        {appliedFiltersCount === 0 ? (
          <div className="text-xs text-gray-500 italic">
            No hay filtros aplicados
          </div>
        ) : (
          <div className="space-y-1">
            {Object.entries(filterValues).map(([key, values]) => {
              const tabLabel = filterTabs.find(t => t.key === key)?.label || key;
              if (Array.isArray(values) && values.length > 0) {
                return (
                  <div key={key} className="flex flex-wrap gap-1">
                    <span className="text-xs font-medium text-gray-600">{tabLabel}:</span>
                    {values.slice(0, 3).map(value => (
                      <span key={value} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                        {value}
                        {key === 'linea' && value === defaultLineFilter && (
                          <span className="ml-1">🏠</span>
                        )}
                      </span>
                    ))}
                    {values.length > 3 && (
                      <span className="text-xs text-gray-500">+{values.length - 3} más</span>
                    )}
                  </div>
                );
              }
              if (key === 'fchObjetivo' && values) {
                return (
                  <div key={key} className="flex items-center gap-1">
                    <span className="text-xs font-medium text-gray-600">{tabLabel}:</span>
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                      {values}
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;