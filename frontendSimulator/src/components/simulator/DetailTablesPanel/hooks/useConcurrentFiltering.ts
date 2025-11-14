// src/components/simulator/DetailTablesPanel/hooks/UseConcurrentFiltering.ts
import { startTransition, useDeferredValue, useState, useEffect, useCallback, useMemo } from 'react';
import { WorkOrder } from '../Types';

// Definir FilterValues si no existe en Types
export interface FilterValues {
  numWO: string[];
  numDoc: string[];
  equipo: string[];
  estadoWO: string[];
  tipDoc: string[];
  fchObjetivo: string;
  linea?: string[];
  secuencia?: string[];
  [key: string]: string | string[] | undefined; // Para extensibilidad
}

// Función para normalizar strings para comparación (case-insensitive y sin espacios)
const normalizeString = (str: string | undefined | null): string => {
  if (!str) return '';
  return str.toString().toLowerCase().trim();
};

// Función para comparar fechas
const compareDates = (woDate: string | undefined | null, filterDate: string | undefined | null): boolean => {
  if (!filterDate) return true; // Sin filtro de fecha
  if (!woDate) return false; // WO sin fecha pero hay filtro
  
  try {
    const woDateNormalized = new Date(woDate).toISOString().split('T')[0];
    const filterDateNormalized = new Date(filterDate).toISOString().split('T')[0];
    return woDateNormalized === filterDateNormalized;
  } catch (error) {
    console.warn('Error al comparar fechas:', error, { woDate, filterDate });
    return normalizeString(woDate) === normalizeString(filterDate);
  }
};

// Función para verificar si un array de filtros incluye un valor
const includesValue = (filterArray: string[], value: string | undefined | null): boolean => {
  if (!filterArray || filterArray.length === 0) return true; // Sin filtros
  if (!value) return false; // Valor vacío pero hay filtros
  
  const normalizedValue = normalizeString(value);
  return filterArray.some(filterItem => 
    normalizeString(filterItem) === normalizedValue
  );
};

// Función optimizada para aplicar filtros con validaciones robustas
const applyFilters = (wo: WorkOrder, filters: FilterValues): boolean => {
  if (!wo || !filters) return false;
  
  try {
    // Verificar filtros de arrays con normalización
    if (!includesValue(filters.numWO, wo.numWO)) return false;
    if (!includesValue(filters.numDoc, wo.numDoc)) return false;
    if (!includesValue(filters.equipo, wo.equipo)) return false;
    if (!includesValue(filters.estadoWO, wo.estadoWO)) return false;
    if (!includesValue(filters.tipDoc, wo.tipDoc)) return false;
    
    // Verificar filtro de fecha
    if (!compareDates(wo.fchObjetivo, filters.fchObjetivo)) return false;
    
    // Filtros adicionales si existen
    if (filters.linea && filters.linea.length > 0 && !includesValue(filters.linea, wo.linea)) return false;
    if (filters.secuencia && filters.secuencia.length > 0 && !includesValue(filters.secuencia, wo.secuencia?.toString())) return false;
    
    return true;
  } catch (error) {
    console.warn('Error al aplicar filtros:', error, { wo, filters });
    return false; // En caso de error, excluir el elemento
  }
};

// Función para validar FilterValues
const validateFilters = (filters: FilterValues): FilterValues => {
  // Extraer propiedades conocidas y el resto
  const {
    numWO,
    numDoc,
    equipo,
    estadoWO,
    tipDoc,
    fchObjetivo,
    linea,
    secuencia,
    ...otherFilters
  } = filters;

  return {
    // Validar propiedades principales
    numWO: Array.isArray(numWO) ? numWO : [],
    numDoc: Array.isArray(numDoc) ? numDoc : [],
    equipo: Array.isArray(equipo) ? equipo : [],
    estadoWO: Array.isArray(estadoWO) ? estadoWO : [],
    tipDoc: Array.isArray(tipDoc) ? tipDoc : [],
    fchObjetivo: fchObjetivo || '',
    linea: Array.isArray(linea) ? linea : [],
    secuencia: Array.isArray(secuencia) ? secuencia : [],
    // Añadir otras propiedades que no sean las principales
    ...otherFilters
  };
};

// Función para verificar si los filtros están vacíos
const areFiltersEmpty = (filters: FilterValues): boolean => {
  const validatedFilters = validateFilters(filters);
  
  return (
    validatedFilters.numWO.length === 0 &&
    validatedFilters.numDoc.length === 0 &&
    validatedFilters.equipo.length === 0 &&
    validatedFilters.estadoWO.length === 0 &&
    validatedFilters.tipDoc.length === 0 &&
    !validatedFilters.fchObjetivo &&
    (validatedFilters.linea?.length || 0) === 0 &&
    (validatedFilters.secuencia?.length || 0) === 0
  );
};

// Interfaz para el retorno del hook
interface UseConcurrentFilteringReturn {
  filteredData: WorkOrder[];
  filteredIds: string[];
  updateFilters: (newFilters: FilterValues) => void;
  resetFilters: () => void;
  filterValues: FilterValues;
  isFiltering: boolean;
  totalCount: number;
  filteredCount: number;
  hasActiveFilters: boolean;
}

export const UseConcurrentFiltering = (
  workOrders: WorkOrder[], 
  initialFilters: FilterValues
): UseConcurrentFilteringReturn => {
  // Validar y normalizar filtros iniciales
  const [filterValues, setFilterValues] = useState<FilterValues>(() => 
    validateFilters(initialFilters)
  );
  
  const [filteredData, setFilteredData] = useState<WorkOrder[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);
  
  // Usar deferred value para evitar bloqueos en la UI
  const deferredFilterValues = useDeferredValue(filterValues);
  
  // Memorizar si hay filtros activos
  const hasActiveFilters = useMemo(() => 
    !areFiltersEmpty(deferredFilterValues), 
    [deferredFilterValues]
  );
  
  // Memorizar IDs filtrados para mejor rendimiento
  const filteredIds = useMemo(() => 
    filteredData.map(wo => wo.id).filter(Boolean), 
    [filteredData]
  );
  
  // Función para actualizar filtros sin bloquear UI
  const updateFilters = useCallback((newFilters: FilterValues): void => {
    const validatedFilters = validateFilters(newFilters);
    
    setIsFiltering(true);
    startTransition(() => {
      setFilterValues(validatedFilters);
    });
  }, []);
  
  // Función para resetear filtros
  const resetFilters = useCallback((): void => {
    const emptyFilters: FilterValues = {
      numWO: [],
      numDoc: [],
      equipo: [],
      estadoWO: [],
      tipDoc: [],
      fchObjetivo: '',
      linea: [],
      secuencia: []
    };
    
    updateFilters(emptyFilters);
  }, [updateFilters]);
  
  // Aplicar filtros de forma diferida con optimizaciones
  useEffect(() => {
    if (!workOrders || !Array.isArray(workOrders)) {
      setFilteredData([]);
      setIsFiltering(false);
      return;
    }
    
    // Si no hay filtros activos, devolver todos los datos
    if (areFiltersEmpty(deferredFilterValues)) {
      setFilteredData(workOrders);
      setIsFiltering(false);
      return;
    }
    
    try {
      // Usar requestIdleCallback si está disponible para mejor rendimiento
      const filterFunction = () => {
        const filtered = workOrders.filter(wo => {
          if (!wo || !wo.id) return false; // Validar que la WO sea válida
          return applyFilters(wo, deferredFilterValues);
        });
        
        setFilteredData(filtered);
        setIsFiltering(false);
      };
      
      // Usar requestIdleCallback si está disponible, sino setTimeout
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(filterFunction, { timeout: 100 });
      } else {
        setTimeout(filterFunction, 0);
      }
    } catch (error) {
      console.error('Error al aplicar filtros:', error);
      setFilteredData([]);
      setIsFiltering(false);
    }
  }, [workOrders, deferredFilterValues]);
  
  // Log para debugging (solo en desarrollo)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log('🔍 Filtros aplicados:', {
        totalCount: workOrders?.length || 0,
        filteredCount: filteredData.length,
        hasActiveFilters,
        filterValues: deferredFilterValues
      });
    }
  }, [workOrders?.length, filteredData.length, hasActiveFilters, deferredFilterValues]);
  
  return { 
    filteredData, 
    filteredIds,
    updateFilters, 
    resetFilters,
    filterValues: deferredFilterValues,
    isFiltering,
    totalCount: workOrders?.length || 0,
    filteredCount: filteredData.length,
    hasActiveFilters
  };
};