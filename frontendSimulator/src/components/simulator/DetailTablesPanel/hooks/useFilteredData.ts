// src/components/simulator/DetailTablesPanel/hooks/UseFilteredData.ts - CORREGIDO
import { useMemo, useCallback } from 'react';
import { IWorkOrderFrontend } from '../../../../interfaces/ISimulatorData';

// Definir FilterValues actualizada que coincida con las propiedades reales
export interface FilterValues {
  // Propiedades que coinciden con IWorkOrderFrontend (camelCase)
  numWO: string[];
  numDoc: string[];
  equipo: string[];
  estadoWO: string[];
  tipDoc: string[];
  articulo: string[];
  proveedor: string[];
  fchObjetivo: string; // Fecha como string
  linea?: string[];
  secuencia?: string[];
  
  // También soportar PascalCase para compatibilidad (si viene del backend así)
  NumWO?: string[];
  NumDoc?: string[];
  Equipo?: string[];
  EstadoWO?: string[];
  TipDoc?: string[];
  Articulo?: string[];
  Proveedor?: string[];
  FechaObjetivo?: string;
  
  [key: string]: string | string[] | undefined; // Para extensibilidad
}

interface UseFilteredDataResult {
  filteredData: IWorkOrderFrontend[];
  clearFilters: () => void;
  filterCounts: Record<string, number>;
  totalCount: number;
  filteredCount: number;
  hasActiveFilters: boolean;
}

// Función auxiliar para normalizar strings
const normalizeString = (str: string | undefined | null): string => {
  if (!str) return '';
  return str.toString().toLowerCase().trim();
};

// Función auxiliar para verificar si un filtro incluye un valor
const includesValue = (filterArray: string[] | undefined, value: string | undefined | null): boolean => {
  if (!filterArray || filterArray.length === 0) return true; // Sin filtros
  if (!value) return false; // Valor vacío pero hay filtros
  
  const normalizedValue = normalizeString(value);
  return filterArray.some(filterItem => 
    normalizeString(filterItem) === normalizedValue
  );
};

// Función auxiliar para comparar fechas
const compareDates = (woDate: string | undefined | null, filterDate: string | undefined | null): boolean => {
  if (!filterDate) return true; // Sin filtro de fecha
  if (!woDate) return false; // WO sin fecha pero hay filtro
  
  try {
    // Normalizar fechas a formato YYYY-MM-DD
    const woDateNormalized = woDate.split('T')[0];
    const filterDateNormalized = filterDate.split('T')[0];
    return woDateNormalized === filterDateNormalized;
  } catch (error) {
    console.warn('Error al comparar fechas:', error, { woDate, filterDate });
    return normalizeString(woDate) === normalizeString(filterDate);
  }
};

// Función para verificar si hay filtros activos
const hasActiveFilters = (filters: FilterValues): boolean => {
  // Verificar filtros camelCase
  const camelCaseActive = (
    (filters.numWO?.length || 0) > 0 ||
    (filters.numDoc?.length || 0) > 0 ||
    (filters.equipo?.length || 0) > 0 ||
    (filters.estadoWO?.length || 0) > 0 ||
    (filters.tipDoc?.length || 0) > 0 ||
    (filters.articulo?.length || 0) > 0 ||
    (filters.proveedor?.length || 0) > 0 ||
    !!filters.fchObjetivo ||
    (filters.linea?.length || 0) > 0 ||
    (filters.secuencia?.length || 0) > 0
  );
  
  // Verificar filtros PascalCase
  const pascalCaseActive = (
    (filters.NumWO?.length || 0) > 0 ||
    (filters.NumDoc?.length || 0) > 0 ||
    (filters.Equipo?.length || 0) > 0 ||
    (filters.EstadoWO?.length || 0) > 0 ||
    (filters.TipDoc?.length || 0) > 0 ||
    (filters.Articulo?.length || 0) > 0 ||
    (filters.Proveedor?.length || 0) > 0 ||
    !!filters.FechaObjetivo
  );
  
  return camelCaseActive || pascalCaseActive;
};

export const UseFilteredData = (
  workOrders: IWorkOrderFrontend[] = [],
  filterValues: FilterValues,
  selectedScenario?: number
): UseFilteredDataResult => {
  
  // Filtrar los work orders basándose en los filtros aplicados
  const filteredData = useMemo(() => {
    // Validación: Asegurar que workOrders existe
    if (!workOrders || !Array.isArray(workOrders)) {
      console.warn('⚠️ UseFilteredData: workOrders is not an array:', workOrders);
      return [];
    }

    // Si no hay filtros activos, devolver todos los datos
    if (!hasActiveFilters(filterValues)) {
      return [...workOrders];
    }

    let filtered = [...workOrders];

    try {
      // Filtro por NumWO (soportar ambos formatos)
      const numWOFilter = filterValues.numWO || filterValues.NumWO;
      if (numWOFilter && numWOFilter.length > 0) {
        filtered = filtered.filter(wo => includesValue(numWOFilter, wo.numWO));
      }

      // Filtro por NumDoc
      const numDocFilter = filterValues.numDoc || filterValues.NumDoc;
      if (numDocFilter && numDocFilter.length > 0) {
        filtered = filtered.filter(wo => includesValue(numDocFilter, wo.numDoc));
      }

      // Filtro por Equipo
      const equipoFilter = filterValues.equipo || filterValues.Equipo;
      if (equipoFilter && equipoFilter.length > 0) {
        filtered = filtered.filter(wo => includesValue(equipoFilter, wo.equipo));
      }

      // Filtro por EstadoWO
      const estadoWOFilter = filterValues.estadoWO || filterValues.EstadoWO;
      if (estadoWOFilter && estadoWOFilter.length > 0) {
        filtered = filtered.filter(wo => includesValue(estadoWOFilter, wo.estadoWO));
      }

      // Filtro por TipDoc
      const tipDocFilter = filterValues.tipDoc || filterValues.TipDoc;
      if (tipDocFilter && tipDocFilter.length > 0) {
        filtered = filtered.filter(wo => includesValue(tipDocFilter, wo.tipDoc));
      }

      // Filtro por Articulo - usar la propiedad correcta de IWorkOrderFrontend
      const articuloFilter = filterValues.articulo || filterValues.Articulo;
      if (articuloFilter && articuloFilter.length > 0) {
        filtered = filtered.filter(wo => {
          // Buscar en las propiedades que realmente existen
          const articulo = (wo as any).articulo || (wo as any).item || (wo as any).producto || wo.equipo;
          return includesValue(articuloFilter, articulo);
        });
      }

      // Filtro por Proveedor - usar la propiedad correcta de IWorkOrderFrontend
      const proveedorFilter = filterValues.proveedor || filterValues.Proveedor;
      if (proveedorFilter && proveedorFilter.length > 0) {
        filtered = filtered.filter(wo => {
          // Buscar en las propiedades que realmente existen
          const proveedor = (wo as any).proveedor || (wo as any).supplier || (wo as any).vendor;
          return includesValue(proveedorFilter, proveedor);
        });
      }

      // Filtro por Línea
      if (filterValues.linea && filterValues.linea.length > 0) {
        filtered = filtered.filter(wo => includesValue(filterValues.linea, wo.linea));
      }

      // Filtro por Secuencia
      if (filterValues.secuencia && filterValues.secuencia.length > 0) {
        filtered = filtered.filter(wo => includesValue(filterValues.secuencia, wo.secuencia?.toString()));
      }

      // Filtro por FechaObjetivo
      const fechaFilter = filterValues.fchObjetivo || filterValues.FechaObjetivo;
      if (fechaFilter) {
        filtered = filtered.filter(wo => compareDates(wo.fchObjetivo, fechaFilter));
      }

      // Filtro por escenario (si es necesario)
      if (selectedScenario && selectedScenario > 0) {
        // Agregar lógica de filtro por escenario si la propiedad existe
        filtered = filtered.filter(wo => {
          const woScenario = (wo as any).escenario || (wo as any).scenarioId;
          return woScenario === selectedScenario;
        });
      }

      console.log(`🔍 Filtros aplicados: ${workOrders.length} → ${filtered.length} work orders`);
      return filtered;
      
    } catch (error) {
      console.error('Error al aplicar filtros:', error);
      return workOrders; // En caso de error, devolver datos originales
    }
  }, [workOrders, filterValues, selectedScenario]);

  // Calcular conteos de filtros para estadísticas
  const filterCounts = useMemo(() => {
    if (!workOrders || !Array.isArray(workOrders)) {
      return {};
    }

    const counts: Record<string, number> = {};
    
    try {
      // Contar filtros activos (priorizar camelCase)
      Object.entries(filterValues).forEach(([key, values]) => {
        if (key === 'fchObjetivo' || key === 'FechaObjetivo') {
          counts['fechaObjetivo'] = values ? 1 : 0;
        } else if (Array.isArray(values) && values.length > 0) {
          counts[key] = values.length;
        }
      });

      // Añadir conteos útiles
      counts.total = workOrders.length;
      counts.filtered = filteredData.length;
      
    } catch (error) {
      console.error('Error al calcular conteos de filtros:', error);
    }

    return counts;
  }, [workOrders, filterValues, filteredData.length]);

  // Función para limpiar filtros
  const clearFilters = useCallback(() => {
    console.log('🧹 Solicitud de limpieza de filtros...');
    // Esta función será implementada por el componente padre
    // que pasará una función real como prop si es necesario
  }, []);

  // Memorizar si hay filtros activos
  const hasFiltersActive = useMemo(() => 
    hasActiveFilters(filterValues), 
    [filterValues]
  );

  return {
    filteredData,
    clearFilters,
    filterCounts,
    totalCount: workOrders?.length || 0,
    filteredCount: filteredData.length,
    hasActiveFilters: hasFiltersActive
  };
};