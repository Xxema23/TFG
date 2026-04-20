import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { IWorkOrderFrontend, IPalet } from '../../../../interfaces/ISimulatorData';
import { IFabricacionConHoras } from '../../../../interfaces/IFabricacionConHoras';
import {
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
      const parsed = parseFloat(trimmed.replace(/[^0-9.,]/g, '').replace(',', '.'));
      return isNaN(parsed) ? 0 : parsed;
    }
    if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;
    try { return parseFloat(String(valor)) || 0; } catch { return 0; }
  };

  return {
    id: uniqueId,
    numWO: fabricacion.NumWO,
    equipo: fabricacion.Equipo || '',
    secuencia: fabricacion.Secuencia || 0,
    linea: fabricacion.Linea,
    estadoWO: fabricacion.Estado_WO || '',
    fchObjetivo: fabricacion.Fch_Objetivo,
    fchPedido: fabricacion.Fch_Pedido || '',
    fchPrometida: fabricacion.Fch_Prometida || '',
    importe: fabricacion.Importe || 0,
    sigCode: fabricacion.sig_code || '',
    cshTotal: parseHorasTotales(fabricacion.horas_totales_de_la_wo),
    paletInfo: palet ? { num_de_palet: palet.num_de_palet, palet_2nd_number: palet.palet_2nd_number } : null
  };
};

const MOCK_COMPONENT_DATA = {
  generarComponentesMock: (workOrders: IWorkOrderFrontend[]): Record<string, string[]> => {
    const result: Record<string, string[]> = {};
    const equipos = [...new Set(workOrders.map(wo => wo.equipo))].filter(Boolean);
    equipos.forEach(equipo => {
      const numComponentes = Math.floor(Math.random() * 4) + 2;
      const componentesEquipo = Array.from({ length: numComponentes }, (_, i) => `COMP-${equipo}-${i + 1}`);
      workOrders.filter(wo => wo.equipo === equipo).forEach(wo => { result[wo.id] = componentesEquipo; });
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

  const [cacheStats, setCacheStats] = useState<any>({});
  const [defaultLineFilter, setDefaultLineFilter] = useState<string | null>("L8");
  const [componentesMap, setComponentesMap] = useState<Record<string, string[]>>({});
  const [palets, setPalets] = useState<IPalet[]>([]);
  const [paletsLoading, setPaletsLoading] = useState(false);
  const [paletsError, setPaletsError] = useState<string | null>(null);

  const { getCached, invalidate, getStats } = UseSmartCache();
  const monitor = UsePerformanceMonitor();

  const getCachedRef = useRef(getCached);
  const getStatsRef  = useRef(getStats);
  getCachedRef.current = getCached;
  getStatsRef.current  = getStats;

  const loadPalets = useCallback(async () => {
    try {
      setPaletsLoading(true);
      setPaletsError(null);
      const paletsData = await getCachedRef.current('palets', getPalets, 5 * 60 * 1000);
      setPalets(paletsData);
      setCacheStats(getStatsRef.current());
    } catch (error) {
      setPaletsError(error instanceof Error ? error.message : 'Error cargando palets');
      console.error('❌ Error cargando palets:', error);
    } finally {
      setPaletsLoading(false);
    }
  }, []);

  const paletsMap = useMemo(() => {
    if (palets.length === 0) { globalPaletsMap = null; globalPaletsLength = 0; return new Map<string, IPalet>(); }
    if (globalPaletsMap && globalPaletsLength === palets.length) return globalPaletsMap;
    globalPaletsMap = createPaletsMap(palets);
    globalPaletsLength = palets.length;
    return globalPaletsMap;
  }, [palets.length]);

  const allWorkOrders = useMemo(() => {
    if (!fabricacionesData?.length) return [];
    const processedKeys = new Set<string>();
    const workOrders: IWorkOrderFrontend[] = [];
    fabricacionesData
      .filter(f => f.NumWO && f.Linea && f.Fch_Objetivo)
      .forEach(fabricacion => {
        const key = `${fabricacion.NumWO}-${fabricacion.Fch_Objetivo}-${fabricacion.Linea}-${fabricacion.Secuencia || 0}`;
        if (!processedKeys.has(key)) {
          processedKeys.add(key);
          try { workOrders.push(mapFabricacionToWorkOrder(fabricacion, paletsMap)); }
          catch (e) { console.error('❌ Error mapeando fabricación:', fabricacion.NumWO, e); }
        }
      });
    return workOrders;
  }, [
    fabricacionesData.length,
    fabricacionesData[0]?.NumWO,
    fabricacionesData[fabricacionesData.length - 1]?.NumWO,
    paletsMap
  ]);

  const hasLoadedAuxData = useRef(false);
  useEffect(() => {
    if (fabricacionesData.length > 0 && !hasLoadedAuxData.current) {
      hasLoadedAuxData.current = true;
      loadPalets();
    }
  }, [fabricacionesData.length]);

  useEffect(() => {
    if (allWorkOrders.length > 0) {
      setComponentesMap(MOCK_COMPONENT_DATA.generarComponentesMock(allWorkOrders));
    }
  }, [allWorkOrders.length]);

  useEffect(() => {
    if (defaultLineFilter && allWorkOrders.length > 0) {
      const hasDefaultLine = allWorkOrders.some(wo => wo.linea === defaultLineFilter);
      if (!hasDefaultLine) {
        const availableLines = [...new Set(allWorkOrders.map(wo => wo.linea))].filter(Boolean);
        if (availableLines.length > 0) setDefaultLineFilter(availableLines[0]);
      }
    }
  }, [allWorkOrders.length, defaultLineFilter]);

  const loading = fabricacionesLoading || paletsLoading;
  const error = fabricacionesError
    ? (fabricacionesError instanceof Error ? fabricacionesError.message : 'Error cargando fabricaciones')
    : paletsError;

  const invalidateRef = useRef(invalidate);
  invalidateRef.current = invalidate;

  const updateWODate = useCallback(async (woId: string, newDate: string): Promise<boolean> => {
    return monitor.measureAsync('update-wo-date', async () => {
      try {
        const success = await updateWorkOrderDate(woId, newDate);
        if (success) {
          await refetchFabricaciones();
          invalidateRef.current('palets');
          setCacheStats(getStatsRef.current());
          return true;
        }
        return false;
      } catch { return false; }
    });
  }, [monitor, refetchFabricaciones]);

  const updateWOSequence = useCallback(async (updates: { wo: string; secuencia: number }[]): Promise<boolean> => {
    return monitor.measureAsync('update-wo-sequence-batch', async () => {
      try {
        const success = await updateWorkOrderSequence(updates);
        if (success) {
          await refetchFabricaciones();
          invalidateRef.current('palets');
          setCacheStats(getStatsRef.current());
          return true;
        }
        return false;
      } catch { return false; }
    });
  }, [monitor, refetchFabricaciones]);

  const refresh = useCallback(async () => {
    await Promise.all([refetchFabricaciones(), loadPalets()]);
  }, [refetchFabricaciones, loadPalets]);

  const refreshCache = useCallback(() => { setCacheStats(getStatsRef.current()); }, []);

  const clearCache = useCallback(() => {
    invalidateWorkOrderCache();
    invalidateRef.current('palets');
    setCacheStats(getStatsRef.current());
  }, []);

  const availableWOs = useMemo(() =>
    monitor.measureSync('calculate-available-wos', () => allWorkOrders.map(wo => wo.id)),
    [allWorkOrders.length, monitor]
  );

  const availableComponents = useMemo(() => {
    const all = new Set<string>();
    Object.values(componentesMap).forEach(list => list.forEach(id => all.add(id)));
    return Array.from(all).sort();
  }, [componentesMap]);

  const componentAvailability = useMemo(() =>
    MOCK_COMPONENT_DATA.generarDisponibilidadMock(availableComponents),
    [availableComponents.length]
  );

  return {
    workOrders: allWorkOrders,
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
    filteredWorkOrders: allWorkOrders,
    allWorkOrders,
    availableComponents,
    componentAvailability,
  };
};