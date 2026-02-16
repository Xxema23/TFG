import { useState, useEffect, useCallback, useMemo } from 'react';
import { IWorkOrderFrontend, IPalet } from '../../../../interfaces/ISimulatorData';
import { IFabricacionConHoras } from '../../../../interfaces/IFabricacionConHoras';
import {
  getWorkOrderColors,
  updateWorkOrderDate,
  updateWorkOrderSequence,
  invalidateWorkOrderCache,
  getCacheStats,
  getPalets,
  createPaletsMap,
} from '../../../../services/SimulatorServices';
import { useFabricacionesConHoras } from '../../../../hooks/UseFrabricacionesConHoras';
import { UseSmartCache } from './UseSmartCache';
import { UsePerformanceMonitor } from './UsePerformanceMonitor';

interface UseSimulatorDataResult {
  workOrders: IWorkOrderFrontend[];
  workOrderColors: Record<string, string>;
  availableWOs: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateWODate: (woId: string, newDate: string) => Promise<boolean>;
  updateWOSequence: (workOrders: { wo: string; secuencia: number }[]) => Promise<boolean>;
  cacheStats: any;
  refreshCache: () => void;
  clearCache: () => void;
  defaultLineFilter: string | null;
  setDefaultLineFilter: (line: string | null) => void;
  filteredWorkOrders: IWorkOrderFrontend[];
  allWorkOrders: IWorkOrderFrontend[];
  availableComponents: string[];
  componentAvailability: Record<string, Record<string, any>>;
}

// ✅ CACHE GLOBAL para paletsMap (evita recalcular)
let globalPaletsMap: Map<string, IPalet> | null = null;
let globalPaletsLength = 0;

const mapFabricacionToWorkOrder = (
  fabricacion: IFabricacionConHoras, 
  paletsMap: Map<string, IPalet>
): IWorkOrderFrontend => {
  if (!fabricacion.NumWO || !fabricacion.Linea || !fabricacion.Fch_Objetivo) {
    throw new Error(`Fabricación con datos incompletos: ${JSON.stringify(fabricacion)}`);
  }

  const uniqueId = `${fabricacion.NumWO}-${fabricacion.Fch_Objetivo}-${fabricacion.Linea}-${fabricacion.Secuencia || 0}`;
  const palet = paletsMap.get(fabricacion.NumWO);
  
  const parseHorasTotales = (valor: any): number => {
    if (valor === undefined || valor === null) return 0;

    if (typeof valor === 'string') {
      const trimmed = valor.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return 0;
      const cleanString = trimmed.replace(/[^0-9.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleanString);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    if (typeof valor === 'number') {
      return isNaN(valor) ? 0 : valor;
    }
    
    try {
      const parsed = parseFloat(String(valor));
      return isNaN(parsed) ? 0 : parsed;
    } catch {
      return 0;
    }
  };

  return {
    id: uniqueId,
    numWO: fabricacion.NumWO,
    equipo: fabricacion.Equipo || '',
    secuencia: fabricacion.Secuencia || 0,
    linea: fabricacion.Linea,
    numDoc: fabricacion.Numero_de_pedido || '',
    tipDoc: fabricacion.Tipo_de_pedido || '',
    estadoWO: (fabricacion.Estado_WO || 0).toString(),
    fchObjetivo: fabricacion.Fch_Objetivo,
    fchAcuse: fabricacion.Fch_Acuse || '',
    fchAlbarAn: fabricacion.Fch_Albaran || '',
    importe: fabricacion.Importe || 0,
    cshTotal: parseHorasTotales(fabricacion.horas_totales_de_la_wo),
    paletInfo: palet ? {
      num_de_palet: palet.num_de_palet,
      palet_2nd_number: palet.palet_2nd_number
    } : null
  };
};

const MOCK_COMPONENT_DATA = {
  generarComponentesMock: (workOrders: IWorkOrderFrontend[]): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    const equipos = [...new Set(workOrders.map(wo => wo.equipo))].filter(Boolean);
    
    equipos.forEach((equipo) => {
      const numComponentes = Math.floor(Math.random() * 4) + 2;
      const componentesEquipo: string[] = [];
      
      for (let i = 1; i <= numComponentes; i++) {
        componentesEquipo.push(`COMP-${equipo}-${i}`);
      }
      
      workOrders
        .filter(wo => wo.equipo === equipo)
        .forEach(wo => {
          result[wo.id] = componentesEquipo;
        });
    });
    
    return result;
  },
  
  generarDisponibilidadMock: (componentes: string[]): Record<string, Record<string, any>> => {
    const result: Record<string, Record<string, any>> = {};
    
    componentes.forEach(comp => {
      result[comp] = {
        stock: Math.floor(Math.random() * 50),
        pedido: Math.floor(Math.random() * 30),
        fchEntrega: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        disponible: Math.floor(Math.random() * 80) - 10,
      };
    });
    
    return result;
  }
};

export const UseSimulatorData = (): UseSimulatorDataResult => {
  const { 
    data: fabricacionesData = [], 
    isLoading: fabricacionesLoading, 
    error: fabricacionesError,
    refetch: refetchFabricaciones
  } = useFabricacionesConHoras();

  const [workOrderColors, setWorkOrderColors] = useState<Record<string, string>>({});
  const [colorsLoading, setColorsLoading] = useState(false);
  const [colorsError, setColorsError] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<any>({});
  const [defaultLineFilter, setDefaultLineFilter] = useState<string | null>("L8");
  const [componentesMap, setComponentesMap] = useState<Record<string, string[]>>({});

  const [palets, setPalets] = useState<IPalet[]>([]);
  const [paletsLoading, setPaletsLoading] = useState(false);
  const [paletsError, setPaletsError] = useState<string | null>(null);

  const { getCached, invalidate, getStats } = UseSmartCache();
  const monitor = UsePerformanceMonitor();

  const loadPalets = useCallback(async () => {
    try {
      setPaletsLoading(true);
      setPaletsError(null);
      
      const paletsData = await getCached('palets', getPalets, 5 * 60 * 1000);
      setPalets(paletsData);
      setCacheStats(getStats());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error cargando palets';
      setPaletsError(errorMessage);
      console.error('❌ Error cargando palets:', error);
    } finally {
      setPaletsLoading(false);
    }
  }, [getCached, getStats]);

  // ✅ OPTIMIZADO: Usar cache global para paletsMap
  const paletsMap = useMemo(() => {
    if (palets.length === 0) {
      globalPaletsMap = null;
      globalPaletsLength = 0;
      return new Map<string, IPalet>();
    }

    // Solo recalcular si cambió el length
    if (globalPaletsMap && globalPaletsLength === palets.length) {
      return globalPaletsMap;
    }

    globalPaletsMap = createPaletsMap(palets);
    globalPaletsLength = palets.length;
    return globalPaletsMap;
  }, [palets.length]); // ✅ Solo length

  // ✅ OPTIMIZADO: Dependencies solo con .length
  const allWorkOrders = useMemo(() => {
    if (!fabricacionesData || fabricacionesData.length === 0) {
      return [];
    }

    const validFabricaciones = fabricacionesData.filter((fabricacion) => {
      return fabricacion.NumWO && fabricacion.Linea && fabricacion.Fch_Objetivo;
    });
    
    const processedKeys = new Set<string>();
    const workOrders: IWorkOrderFrontend[] = [];
    
    validFabricaciones.forEach((fabricacion) => {
      const uniqueKey = `${fabricacion.NumWO}-${fabricacion.Fch_Objetivo}-${fabricacion.Linea}-${fabricacion.Secuencia || 0}`;
      
      if (!processedKeys.has(uniqueKey)) {
        processedKeys.add(uniqueKey);
        
        try {
          const mappedWO = mapFabricacionToWorkOrder(fabricacion, paletsMap);
          workOrders.push(mappedWO);
        } catch (error) {
          console.error('❌ Error mapeando fabricación:', {
            NumWO: fabricacion.NumWO,
            error: error instanceof Error ? error.message : error
          });
        }
      }
    });
    
    return workOrders;
  }, [
    fabricacionesData.length,
    fabricacionesData[0]?.NumWO,
    fabricacionesData[fabricacionesData.length - 1]?.NumWO,
    paletsMap
  ]); // ✅ Dependencies optimizadas

  const loadWorkOrderColors = useCallback(async () => {
    try {
      setColorsLoading(true);
      setColorsError(null);
      
      const colorsData = await getCached('workOrderColors', getWorkOrderColors, 5 * 60 * 1000);
      setWorkOrderColors(colorsData);
      setCacheStats(getStats());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error cargando colores';
      setColorsError(errorMessage);
      console.error('❌ Error cargando colores:', error);
    } finally {
      setColorsLoading(false);
    }
  }, [getCached, getStats]);

  useEffect(() => {
    if (fabricacionesData.length > 0) {
      loadWorkOrderColors();
      loadPalets();
    }
  }, [fabricacionesData.length, loadWorkOrderColors, loadPalets]);

  useEffect(() => {
    if (allWorkOrders.length > 0) {
      const nuevosMockComponentes = MOCK_COMPONENT_DATA.generarComponentesMock(allWorkOrders);
      setComponentesMap(nuevosMockComponentes);
    }
  }, [allWorkOrders.length]); // ✅ Solo length

  useEffect(() => {
    if (defaultLineFilter && allWorkOrders.length > 0) {
      const hasDefaultLine = allWorkOrders.some(wo => wo.linea === defaultLineFilter);
      
      if (!hasDefaultLine) {
        const availableLines = [...new Set(allWorkOrders.map(wo => wo.linea))].filter(Boolean);
        if (availableLines.length > 0) {
          setDefaultLineFilter(availableLines[0]);
        }
      }
    }
  }, [allWorkOrders.length, defaultLineFilter]);

  const loading = fabricacionesLoading || colorsLoading || paletsLoading;
  const error = fabricacionesError ? 
    (fabricacionesError instanceof Error ? fabricacionesError.message : 'Error cargando fabricaciones') :
    colorsError || paletsError;

  const updateWODate = useCallback(
    async (woId: string, newDate: string): Promise<boolean> => {
      return monitor.measureAsync('update-wo-date', async () => {
        try {
          const success = await updateWorkOrderDate(woId, newDate);

          if (success) {
            await refetchFabricaciones();
            invalidate('workOrderColors');
            invalidate('palets');
            setCacheStats(getStats());
            return true;
          }
          return false;
        } catch {
          return false;
        }
      });
    },
    [monitor, refetchFabricaciones, invalidate, getStats]
  );

  const updateWOSequence = useCallback(
    async (updates: { wo: string; secuencia: number }[]): Promise<boolean> => {
      return monitor.measureAsync('update-wo-sequence-batch', async () => {
        try {
          const success = await updateWorkOrderSequence(updates);

          if (success) {
            await refetchFabricaciones();
            invalidate('workOrderColors');
            invalidate('palets');
            setCacheStats(getStats());
            return true;
          }
          return false;
        } catch {
          return false;
        }
      });
    },
    [monitor, refetchFabricaciones, invalidate, getStats]
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      refetchFabricaciones(),
      loadWorkOrderColors(),
      loadPalets()
    ]);
  }, [refetchFabricaciones, loadWorkOrderColors, loadPalets]);

  const refreshCache = useCallback(() => {
    setCacheStats(getStats());
  }, [getStats]);

  const clearCache = useCallback(() => {
    invalidateWorkOrderCache();
    invalidate('workOrderColors');
    invalidate('palets');
    setCacheStats(getStats());
  }, [invalidate, getStats]);

  const availableWOs = useMemo(() => {
    return monitor.measureSync('calculate-available-wos', () =>
      allWorkOrders.map((wo) => wo.id)
    );
  }, [allWorkOrders.length, monitor]); // ✅ Solo length

  const availableComponents = useMemo(() => {
    const allComponentIds = new Set<string>();
    
    Object.values(componentesMap).forEach(componentesList => {
      componentesList.forEach(componentId => {
        allComponentIds.add(componentId);
      });
    });
    
    return Array.from(allComponentIds).sort();
  }, [componentesMap]);

  const componentAvailability = useMemo(() => {
    return MOCK_COMPONENT_DATA.generarDisponibilidadMock(availableComponents);
  }, [availableComponents.length]); // ✅ Solo length

  return {
    workOrders: allWorkOrders,
    workOrderColors,
    availableWOs,
    loading,
    error,
    refresh,
    updateWODate,
    updateWOSequence,
    cacheStats,
    refreshCache,
    clearCache,
    defaultLineFilter,
    setDefaultLineFilter,
    filteredWorkOrders: allWorkOrders, // ✅ Sin useMemo redundante
    allWorkOrders,
    availableComponents,
    componentAvailability,
  };
};