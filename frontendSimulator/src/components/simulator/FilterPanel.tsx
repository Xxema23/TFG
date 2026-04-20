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
  equipo: string[];
  estadoWO: string[];
  sigCode: string[];
  palets: string[];
  fchObjetivo: string | null;
};

type FilterOptions = {
  linea: string[];
  numWO: string[];
  equipo: string[];
  estadoWO: string[];
  sigCode: string[];
  palets: string[];
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
  filterOptions?: FilterOptions;
};

const createSafeFilterValues = (filterValues: Partial<FilterValues>): FilterValues => {
  return {
    linea: Array.isArray(filterValues.linea) ? filterValues.linea : [],
    numWO: Array.isArray(filterValues.numWO) ? filterValues.numWO : [],
    equipo: Array.isArray(filterValues.equipo) ? filterValues.equipo : [],
    estadoWO: Array.isArray(filterValues.estadoWO) ? filterValues.estadoWO : [],
    sigCode: Array.isArray(filterValues.sigCode) ? filterValues.sigCode : [],
    palets: Array.isArray(filterValues.palets) ? filterValues.palets : [],
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
  filterOptions: providedFilterOptions
}) => {
  const filterValues = useMemo(() => 
    createSafeFilterValues(rawFilterValues)
  , [rawFilterValues]);

  const [activeTab, setActiveTab] = useState<string>('linea');
  const [searchText, setSearchText] = useState<string>('');
  const debouncedSearchText = useDebouncedValue(searchText, 300);

  const filterOptions = useMemo(() => {
    if (providedFilterOptions) {
      return {
        linea: availableLines.length > 0 ? availableLines : providedFilterOptions.linea,
        numWO: providedFilterOptions.numWO || [],
        equipo: providedFilterOptions.equipo || [],
        estadoWO: providedFilterOptions.estadoWO || [],
        sigCode: providedFilterOptions.sigCode || [],
        palets: providedFilterOptions.palets || []
      };
    }

    try {
      const safeAllWorkOrders = Array.isArray(allWorkOrders) 
        ? allWorkOrders.filter(wo => wo && typeof wo === 'object' && typeof wo.numWO !== 'undefined')
        : [];

      const safeWorkOrders = Array.isArray(workOrders) 
        ? workOrders.filter(wo => wo && typeof wo === 'object' && typeof wo.numWO !== 'undefined')
        : [];

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

  // ========================================
  // ✅ NUEVO: VOLVER A MULTI-SELECT PERO CON LOCALSTORAGE
  // ========================================
  const toggleFilterValue = useCallback((type: keyof FilterValues, value: string) => {
    try {
      const newFilters = createSafeFilterValues(filterValues);
      
      if (type === 'fchObjetivo') {
        newFilters[type] = value || null;
      } else {
        const currentValues = Array.isArray(newFilters[type]) 
          ? newFilters[type] as string[] 
          : [];
        
        const isSelected = currentValues.includes(value);
        
        if (isSelected) {
          newFilters[type] = currentValues.filter(v => v !== value);
        } else {
          newFilters[type] = [...currentValues, value];
        }
        
        // ✅ NUEVO: Si es filtro de línea, guardar en localStorage
        if (type === 'linea') {
          const updatedLines = isSelected 
            ? currentValues.filter(v => v !== value)
            : [...currentValues, value];
          
          if (updatedLines.length > 0 && onDefaultLineChange) {
            // Guardar la última línea seleccionada como "principal"
            const lastSelectedLine = isSelected ? updatedLines[updatedLines.length - 1] : value;
            onDefaultLineChange(lastSelectedLine);
            console.log('💾 [FilterPanel] Líneas seleccionadas:', updatedLines);
            console.log('🏠 [FilterPanel] Línea principal:', lastSelectedLine);
          }
        }
      }
      
      onFilterChange(newFilters);
      
    } catch (error) {
      console.error('❌ Error al cambiar filtro:', error);
    }
  }, [filterValues, onFilterChange, onDefaultLineChange]);
  // ========================================

  const selectAll = useCallback(() => {
    if (activeTab === 'fchObjetivo') return;
    
    try {
      const newFilters = createSafeFilterValues(filterValues);
      newFilters[activeTab as keyof FilterOptions] = [...filterOptions[activeTab as keyof FilterOptions]];
      
      onFilterChange(newFilters);
      
      // ✅ NUEVO: Si es línea, guardar todas en localStorage
      if (activeTab === 'linea' && filterOptions.linea.length > 0 && onDefaultLineChange) {
        const lastLine = filterOptions.linea[filterOptions.linea.length - 1];
        onDefaultLineChange(lastLine);
        console.log('💾 [FilterPanel] Todas las líneas seleccionadas:', filterOptions.linea.length);
      }
    } catch (error) {
      console.error('❌ Error al seleccionar todos:', error);
    }
  }, [activeTab, filterValues, filterOptions, onFilterChange, onDefaultLineChange]);

  const selectNone = useCallback(() => {
    try {
      const newFilters = createSafeFilterValues(filterValues);
      
      if (activeTab === 'fchObjetivo') {
        newFilters.fchObjetivo = null;
      } else {
        newFilters[activeTab as keyof FilterOptions] = [];
      }
      
      onFilterChange(newFilters);
    } catch (error) {
      console.error('❌ Error al deseleccionar todos:', error);
    }
  }, [activeTab, filterValues, onFilterChange]);

  useEffect(() => {
    setSearchText('');
  }, [activeTab]);

  const filteredOptions = useMemo(() => {
    try {
      if (activeTab === 'fchObjetivo') return [];
      
      const options = filterOptions[activeTab as keyof FilterOptions] || [];
      if (!debouncedSearchText) return options;
      
      const filtered = options.filter(option => 
        String(option).toLowerCase().includes(debouncedSearchText.toLowerCase())
      );
      
      return filtered;
    } catch (error) {
      console.error('❌ Error al filtrar opciones:', error);
      return [];
    }
  }, [filterOptions, activeTab, debouncedSearchText]);

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
                  {activeTab === 'linea' && option === defaultLineFilter && (
                    <span className="ml-1 text-blue-500">★</span>
                  )}
                </label>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const filterTabs = [
    { key: 'linea', label: 'Línea' },
    { key: 'numWO', label: 'NumWO' },
    { key: 'equipo', label: 'Equipo' },
    { key: 'estadoWO', label: 'Estado' },
    { key: 'sigCode', label: 'Sig Code' },
    { key: 'palets', label: 'Palets' },
    { key: 'fchObjetivo', label: 'Fecha' }
  ];

  const appliedFiltersCount = useMemo(() => {
    return Object.entries(filterValues).reduce((count, [key, values]) => {
      if (Array.isArray(values) && values.length > 0) return count + 1;
      if (key === 'fchObjetivo' && values) return count + 1;
      return count;
    }, 0);
  }, [filterValues]);

  return (
    <div className="h-full flex flex-col bg-white">
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

      <div className="flex-1 overflow-hidden">
        {renderFilterOptions()}
      </div>

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