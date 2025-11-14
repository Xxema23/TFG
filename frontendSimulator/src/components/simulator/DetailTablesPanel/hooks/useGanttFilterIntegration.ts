// src/components/simulator/DetailTablesPanel/hooks/UseGanttFilterIntegration.ts
import { useMemo, useState, useEffect, useCallback } from 'react';
import { IFabricacionConHoras } from '../../../../interfaces/IFabricacionConHoras';

interface SimulatorWorkOrder {
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
  articulo: string;
  proveedor: string;
}

export interface FilterValues {
  linea: string[];
  numWO: string[];
  numDoc: string[];
  equipo: string[];
  estadoWO: string[];
  tipDoc: string[];
  articulo: string[];
  proveedor: string[];
  fchObjetivo: string | null;
}

interface UseGanttFilterIntegrationProps {
  simulatorWorkOrders: SimulatorWorkOrder[];
  ganttWorkOrders: IFabricacionConHoras[];
  filterValues: FilterValues;
  hasActiveFilters: boolean;
}

interface ConversionStats {
  total: number;
  converted: number;
  failed: number;
  missingFields: string[];
}

export interface UseGanttFilterIntegrationResult {
  filteredWorkOrdersForGantt: IFabricacionConHoras[] | null;
  dataSource: 'simulator' | 'gantt' | 'none';
  syncStatus: 'synced' | 'partial' | 'unsynced';
  conversionStats: ConversionStats;
  refreshConversion: () => void;
}

// Función para validar campos requeridos
const validateWorkOrder = (wo: SimulatorWorkOrder): { isValid: boolean; missingFields: string[] } => {
  const requiredFields = ['numWO', 'linea'];
  const missingFields: string[] = [];
  
  requiredFields.forEach(field => {
    const value = wo[field as keyof SimulatorWorkOrder];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      missingFields.push(field);
    }
  });
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};

// Función para formatear fecha de manera segura
const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) {
    return new Date().toISOString().split('T')[0];
  }
  
  try {
    // Si ya viene en formato ISO, extraer solo la fecha
    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }
    
    // Si viene en formato DD/MM/YYYY, convertir a YYYY-MM-DD
    if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    
    // Validar que la fecha sea válida
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('Fecha inválida, usando fecha actual:', dateString);
      return new Date().toISOString().split('T')[0];
    }
    
    return dateString;
  } catch (error) {
    console.error('Error al formatear fecha:', error, dateString);
    return new Date().toISOString().split('T')[0];
  }
};

// Función para validar número
const validateNumber = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  return defaultValue;
};

/**
 * Convierte un WorkOrder del simulador a IFabricacionConHoras
 */
const convertSimulatorToGantt = (wo: SimulatorWorkOrder): IFabricacionConHoras | null => {
  try {
    // Validar campos requeridos
    const validation = validateWorkOrder(wo);
    if (!validation.isValid) {
      console.warn('⚠️ WorkOrder inválida - campos faltantes:', validation.missingFields, wo);
      return null;
    }

    // Formatear fecha
    const formattedDate = formatDate(wo.fchObjetivo);
    
    // Crear objeto convertido con validaciones y nombres correctos de IFabricacionConHoras
    const converted: IFabricacionConHoras = {
      // Propiedades obligatorias de IFabricacionConHoras
      NumWO: wo.numWO.trim(),
      Equipo: wo.equipo?.trim() || '',
      Secuencia: Math.max(1, validateNumber(wo.secuencia, 1)),
      Linea: wo.linea.trim(),
      Numero_de_pedido: wo.numDoc?.trim() || '',
      Tipo_de_pedido: wo.tipDoc?.trim() || '',
      Estado_WO: validateNumber(wo.estadoWO, 0),
      Fch_Objetivo: formattedDate,
      Fch_Acuse: formatDate(wo.fchAcuse) || '',
      Fch_Albaran: formatDate(wo.fchAlbarAn) || '',
      Importe: validateNumber(wo.importe, 0), // Propiedad requerida añadida
      horas_totales_de_la_wo: validateNumber(wo.cshTotal, 8).toString()
    };

    // Añadir propiedades adicionales de forma segura
    const extendedConverted = {
      ...converted,
      // Propiedades adicionales si existen
      ...(wo.cshTotal !== undefined && { cshTotal: validateNumber(wo.cshTotal, 0) }),
      ...(wo.articulo && { articulo: wo.articulo.trim() }),
      ...(wo.proveedor && { proveedor: wo.proveedor.trim() })
    };

    return extendedConverted as IFabricacionConHoras;

    return converted;
  } catch (error) {
    console.error('❌ Error convirtiendo WorkOrder:', error, wo);
    return null;
  }
};

/**
 * Determina si dos work orders representan la misma orden
 */
const areWorkOrdersEqual = (
  simulatorWO: SimulatorWorkOrder,
  ganttWO: IFabricacionConHoras
): boolean => {
  try {
    const numWOMatch = simulatorWO.numWO?.trim() === ganttWO.NumWO?.trim();
    const lineaMatch = simulatorWO.linea?.trim() === ganttWO.Linea?.trim();
    const secuenciaMatch = Math.abs(
      validateNumber(simulatorWO.secuencia, 1) - validateNumber(ganttWO.Secuencia, 1)
    ) <= 0.001;
    
    return numWOMatch && lineaMatch && secuenciaMatch;
  } catch (error) {
    console.error('Error comparando work orders:', error, { simulatorWO, ganttWO });
    return false;
  }
};

/**
 * Calcula estadísticas de conversión
 */
const calculateConversionStats = (
  simulatorWorkOrders: SimulatorWorkOrder[],
  results: IFabricacionConHoras[],
  failed: number
): ConversionStats => {
  const missingFieldsSet = new Set<string>();
  
  simulatorWorkOrders.forEach(wo => {
    Object.entries(wo).forEach(([key, value]) => {
      if (!value || 
          (typeof value === 'string' && value.trim() === '') || 
          (typeof value === 'number' && value === 0 && key !== 'secuencia')) {
        missingFieldsSet.add(key);
      }
    });
  });
  
  return {
    total: simulatorWorkOrders.length,
    converted: results.length,
    failed,
    missingFields: Array.from(missingFieldsSet)
  };
};

/**
 * Hook principal para la integración de filtros con el Gantt
 */
export const UseGanttFilterIntegration = ({
  simulatorWorkOrders,
  ganttWorkOrders,
  filterValues,
  hasActiveFilters
}: UseGanttFilterIntegrationProps): UseGanttFilterIntegrationResult => {
  const [conversionStats, setConversionStats] = useState<ConversionStats>({
    total: 0,
    converted: 0,
    failed: 0,
    missingFields: []
  });

  // Función para forzar reconversión
  const refreshConversion = useCallback(() => {
    // Al cambiar este timestamp, se fuerza la reconversión en el useMemo
    setConversionStats(prev => ({ ...prev, total: prev.total }));
  }, []);

  // Conversión de work orders con memoización
  const convertedWorkOrders = useMemo(() => {
    // Validar entrada
    if (!simulatorWorkOrders || !Array.isArray(simulatorWorkOrders)) {
      console.warn('⚠️ simulatorWorkOrders no es un array válido:', simulatorWorkOrders);
      return null;
    }

    if (!hasActiveFilters || simulatorWorkOrders.length === 0) {
      console.log('🔄 UseGanttFilterIntegration: Sin filtros activos o sin work orders del simulador');
      setConversionStats({ total: 0, converted: 0, failed: 0, missingFields: [] });
      return null;
    }

    console.log('🔄 UseGanttFilterIntegration: Convirtiendo work orders filtradas:', simulatorWorkOrders.length);

    const results: IFabricacionConHoras[] = [];
    let failed = 0;

    // Procesar cada work order
    for (const wo of simulatorWorkOrders) {
      try {
        const converted = convertSimulatorToGantt(wo);
        if (converted) {
          results.push(converted);
        } else {
          failed++;
        }
      } catch (error) {
        console.error('Error procesando work order:', error, wo);
        failed++;
      }
    }

    // Calcular estadísticas
    const newStats = calculateConversionStats(simulatorWorkOrders, results, failed);
    setConversionStats(newStats);

    console.log('✅ Conversión completada:', newStats);
    return results;
  }, [simulatorWorkOrders, hasActiveFilters]);

  // Calcular estado de sincronización
  const syncStatus = useMemo((): 'synced' | 'partial' | 'unsynced' => {
    if (!hasActiveFilters || !convertedWorkOrders) {
      return 'synced';
    }

    if (!ganttWorkOrders || ganttWorkOrders.length === 0) {
      return 'unsynced';
    }

    if (simulatorWorkOrders.length === 0) {
      return 'synced';
    }

    try {
      let matchedCount = 0;
      for (const simulatorWO of simulatorWorkOrders) {
        const hasMatch = ganttWorkOrders.some(ganttWO => 
          areWorkOrdersEqual(simulatorWO, ganttWO)
        );
        if (hasMatch) {
          matchedCount++;
        }
      }

      const matchPercentage = matchedCount / simulatorWorkOrders.length;
      
      if (matchPercentage >= 0.9) {
        return 'synced';
      } else if (matchPercentage >= 0.5) {
        return 'partial';
      } else {
        return 'unsynced';
      }
    } catch (error) {
      console.error('Error calculando estado de sincronización:', error);
      return 'unsynced';
    }
  }, [simulatorWorkOrders, ganttWorkOrders, convertedWorkOrders, hasActiveFilters]);

  // Determinar fuente de datos
  const dataSource = useMemo((): 'simulator' | 'gantt' | 'none' => {
    if (!hasActiveFilters) {
      return (ganttWorkOrders && ganttWorkOrders.length > 0) ? 'gantt' : 'none';
    }

    if (convertedWorkOrders && convertedWorkOrders.length > 0) {
      return 'simulator';
    }

    return 'none';
  }, [hasActiveFilters, convertedWorkOrders, ganttWorkOrders]);

  // Determinar work orders finales para el Gantt
  const filteredWorkOrdersForGantt = useMemo((): IFabricacionConHoras[] | null => {
    switch (dataSource) {
      case 'simulator':
        return convertedWorkOrders || [];
      case 'gantt':
        return null; // null indica que debe usar los datos originales del Gantt
      case 'none':
      default:
        return [];
    }
  }, [dataSource, convertedWorkOrders]);

  // Logging para desarrollo (sin process.env)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log('🔄 UseGanttFilterIntegration: Estado actualizado:', {
        hasActiveFilters,
        simulatorWOCount: simulatorWorkOrders?.length || 0,
        ganttWOCount: ganttWorkOrders?.length || 0,
        convertedWOCount: convertedWorkOrders?.length || 0,
        dataSource,
        syncStatus,
        conversionStats
      });
    }
  }, [
    hasActiveFilters,
    simulatorWorkOrders?.length,
    ganttWorkOrders?.length,
    convertedWorkOrders?.length,
    dataSource,
    syncStatus,
    conversionStats
  ]);

  return {
    filteredWorkOrdersForGantt,
    dataSource,
    syncStatus,
    conversionStats,
    refreshConversion
  };
};