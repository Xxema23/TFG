import { useState, useEffect, useCallback, useMemo } from 'react';
import { IWorkOrderFrontend, IPalet } from '../../../../interfaces/ISimulatorData';
import { IFabricacionConHoras } from '../../../../interfaces/IFabricacionConHoras';
import {
  getWorkOrderColors,
  updateWorkOrderDate,
  updateWorkOrderSequence,
  invalidateWorkOrderCache,
  getCacheStats,
  getPalets, // ✅ NUEVA importación
  createPaletsMap, // ✅ NUEVA importación
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

// ✅ ACTUALIZADA: Función para mapear fabricación a work order CON palets
// ✅ FUNCIÓN CORREGIDA Y ROBUSTA
const mapFabricacionToWorkOrder = (
  fabricacion: IFabricacionConHoras, 
  paletsMap: Map<string, IPalet>
): IWorkOrderFrontend => {
  // ✅ Validación de campos obligatorios
  if (!fabricacion.NumWO || !fabricacion.Linea || !fabricacion.Fch_Objetivo) {
    throw new Error(`Fabricación con datos incompletos: ${JSON.stringify(fabricacion)}`);
  }

  const uniqueId = `${fabricacion.NumWO}-${fabricacion.Fch_Objetivo}-${fabricacion.Linea}-${fabricacion.Secuencia || 0}`;
  
  // Buscar palet por NumWO
  const palet = paletsMap.get(fabricacion.NumWO);
  
  // ✅ FUNCIÓN AUXILIAR: Parsear horas de forma ultra-segura
  const parseHorasTotales = (valor: any): number => {
    // Caso 1: undefined o null → 0
    if (valor === undefined || valor === null) {
      return 0;
    }

    // Caso 2: String vacío → 0
    if (typeof valor === 'string') {
      const trimmed = valor.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
        return 0;
      }
      
      // Limpiar y parsear
      const cleanString = trimmed.replace(/[^0-9.,]/g, '').replace(',', '.');
      const parsed = parseFloat(cleanString);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    // Caso 3: Número
    if (typeof valor === 'number') {
      return isNaN(valor) ? 0 : valor;
    }
    
    // Caso 4: Cualquier otro tipo → intentar convertir
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
    
    equipos.forEach((equipo, index) => {
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

  // ✅ NUEVO: Estados para palets
  const [palets, setPalets] = useState<IPalet[]>([]);
  const [paletsLoading, setPaletsLoading] = useState(false);
  const [paletsError, setPaletsError] = useState<string | null>(null);

  const { getCached, invalidate, getStats } = UseSmartCache();
  const monitor = UsePerformanceMonitor();

  // ✅ NUEVA: Función para cargar palets
  const loadPalets = useCallback(async () => {
    try {
      setPaletsLoading(true);
      setPaletsError(null);
      
      const paletsData = await getCached('palets', getPalets, 5 * 60 * 1000);
      setPalets(paletsData);
      setCacheStats(getStats());
      
      console.log('✅ Palets cargados:', paletsData.length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error cargando palets';
      setPaletsError(errorMessage);
      console.error('❌ Error cargando palets:', error);
    } finally {
      setPaletsLoading(false);
    }
  }, [getCached, getStats]);

  // ✅ NUEVO: Crear mapa de palets para búsqueda eficiente
  const paletsMap = useMemo(() => {
    return createPaletsMap(palets);
  }, [palets]);

  // ✅ ACTUALIZADO: Procesar datos de fabricaciones CON información de palets
const allWorkOrders = useMemo(() => {
  if (!fabricacionesData || fabricacionesData.length === 0) {
    console.log('📦 No hay datos de fabricaciones disponibles');
    return [];
  }

  console.log('🔄 Procesando fabricaciones a work orders con palets:', fabricacionesData.length);
  
  // ✅ FILTRAR fabricaciones válidas ANTES de procesarlas
  const validFabricaciones = fabricacionesData.filter((fabricacion, index) => {
    // Validar campos obligatorios
    if (!fabricacion.NumWO) {
      console.warn(`⚠️ [${index}] Fabricación sin NumWO, omitiendo`);
      return false;
    }
    
    if (!fabricacion.Linea) {
      console.warn(`⚠️ [${index}] Fabricación ${fabricacion.NumWO} sin Linea, omitiendo`);
      return false;
    }
    
    if (!fabricacion.Fch_Objetivo) {
      console.warn(`⚠️ [${index}] Fabricación ${fabricacion.NumWO} sin Fch_Objetivo, omitiendo`);
      return false;
    }
    
    return true;
  });

  console.log(`✅ Fabricaciones válidas: ${validFabricaciones.length}/${fabricacionesData.length}`);
  
  // Detectar problemas con horas_totales_de_la_wo
  const problemasHoras = validFabricaciones.filter(fab => 
    fab.horas_totales_de_la_wo === undefined || 
    fab.horas_totales_de_la_wo === null
  );
  
  if (problemasHoras.length > 0) {
    console.warn(`⚠️ ${problemasHoras.length} fabricaciones con horas_totales_de_la_wo undefined/null`);
    console.table(problemasHoras.slice(0, 5).map(fab => ({
      NumWO: fab.NumWO,
      Linea: fab.Linea,
      horas: fab.horas_totales_de_la_wo,
      tipo: typeof fab.horas_totales_de_la_wo
    })));
  }
  
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
        // No bloquear el proceso, continuar con las demás
      }
    }
  });
  
  const workOrdersWithPalets = workOrders.filter(wo => wo.paletInfo).length;
  console.log(`✅ Work orders procesadas: ${workOrders.length} WOs únicos (${workOrdersWithPalets} con palets)`);
  
  return workOrders;
}, [fabricacionesData, paletsMap]);

  // Para compatibilidad, devolver todos los work orders
  const filteredWorkOrders = useMemo(() => {
    console.log('📦 UseSimulatorData: Devolviendo TODOS los work orders:', allWorkOrders.length);
    return allWorkOrders;
  }, [allWorkOrders]);

  // Cargar colores de work orders
  const loadWorkOrderColors = useCallback(async () => {
    try {
      setColorsLoading(true);
      setColorsError(null);
      
      const colorsData = await getCached('workOrderColors', getWorkOrderColors, 5 * 60 * 1000);
      setWorkOrderColors(colorsData);
      setCacheStats(getStats());
      
      console.log('✅ Colores cargados:', Object.keys(colorsData).length);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error cargando colores';
      setColorsError(errorMessage);
      console.error('❌ Error cargando colores:', error);
    } finally {
      setColorsLoading(false);
    }
  }, [getCached, getStats]);

  // ✅ ACTUALIZADO: Cargar datos cuando hay fabricaciones
  useEffect(() => {
    if (fabricacionesData.length > 0) {
      loadWorkOrderColors();
      loadPalets(); // ✅ Cargar palets también
    }
  }, [fabricacionesData.length, loadWorkOrderColors, loadPalets]);

  // Generar componentes mock basados en todos los work orders
  useEffect(() => {
    if (allWorkOrders.length > 0) {
      const nuevosMockComponentes = MOCK_COMPONENT_DATA.generarComponentesMock(allWorkOrders);
      setComponentesMap(nuevosMockComponentes);
    }
  }, [allWorkOrders]);

  // Verificar si la línea por defecto existe
  useEffect(() => {
    if (defaultLineFilter && allWorkOrders.length > 0) {
      const hasDefaultLine = allWorkOrders.some(wo => wo.linea === defaultLineFilter);
      
      if (!hasDefaultLine) {
        const availableLines = [...new Set(allWorkOrders.map(wo => wo.linea))].filter(Boolean);
        if (availableLines.length > 0) {
          console.log(`⚠️ Línea ${defaultLineFilter} no encontrada, cambiando a ${availableLines[0]}`);
          setDefaultLineFilter(availableLines[0]);
        }
      }
    }
  }, [allWorkOrders, defaultLineFilter]);

  // ✅ ACTUALIZADO: Estados de carga y error combinados (incluyendo palets)
  const loading = fabricacionesLoading || colorsLoading || paletsLoading;
  const error = fabricacionesError ? 
    (fabricacionesError instanceof Error ? fabricacionesError.message : 'Error cargando fabricaciones') :
    colorsError || paletsError;

  // Función de actualización de fecha
  const updateWODate = useCallback(
    async (woId: string, newDate: string): Promise<boolean> => {
      return monitor.measureAsync('update-wo-date', async () => {
        try {
          const success = await updateWorkOrderDate(woId, newDate);

          if (success) {
            await refetchFabricaciones();
            invalidate('workOrderColors');
            invalidate('palets'); // ✅ Invalidar cache de palets también
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

  // Función de actualización de secuencia
  const updateWOSequence = useCallback(
    async (updates: { wo: string; secuencia: number }[]): Promise<boolean> => {
      return monitor.measureAsync('update-wo-sequence-batch', async () => {
        try {
          const success = await updateWorkOrderSequence(updates);

          if (success) {
            await refetchFabricaciones();
            invalidate('workOrderColors');
            invalidate('palets'); // ✅ Invalidar cache de palets también
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

  // ✅ ACTUALIZADO: Refrescar datos (incluyendo palets)
  const refresh = useCallback(async () => {
    await Promise.all([
      refetchFabricaciones(),
      loadWorkOrderColors(),
      loadPalets() // ✅ Incluir palets en el refresh
    ]);
  }, [refetchFabricaciones, loadWorkOrderColors, loadPalets]);

  // Refrescar caché
  const refreshCache = useCallback(() => {
    setCacheStats(getStats());
  }, [getStats]);

  // ✅ ACTUALIZADO: Limpiar caché (incluyendo palets)
  const clearCache = useCallback(() => {
    invalidateWorkOrderCache();
    invalidate('workOrderColors');
    invalidate('palets'); // ✅ Incluir palets
    setCacheStats(getStats());
  }, [invalidate, getStats]);

  // IDs de WOs disponibles
  const availableWOs = useMemo(() => {
    return monitor.measureSync('calculate-available-wos', () =>
      allWorkOrders.map((wo) => wo.id)
    );
  }, [allWorkOrders, monitor]);

  // Componentes disponibles
  const availableComponents = useMemo(() => {
    const allComponentIds = new Set<string>();
    
    Object.values(componentesMap).forEach(componentesList => {
      componentesList.forEach(componentId => {
        allComponentIds.add(componentId);
      });
    });
    
    return Array.from(allComponentIds).sort();
  }, [componentesMap]);

  // Disponibilidad de componentes
  const componentAvailability = useMemo(() => {
    return MOCK_COMPONENT_DATA.generarDisponibilidadMock(availableComponents);
  }, [availableComponents]);

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
    filteredWorkOrders,
    allWorkOrders,
    availableComponents,
    componentAvailability,
  };
};