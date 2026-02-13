import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo } from 'react';
import { IFabricacionConHoras } from '../interfaces/IFabricacionConHoras';
import { getFabricacionesConHoras, updateFabricacionConHoras } from '../services/FabricacionConHoras';
import { CapacityProvider } from './CapacityContext';

const DEBUG_MODE = false;

interface PendingChange {
  NumWO: string;
  changes: Partial<IFabricacionConHoras>;
  timestamp: Date;
}

// ✅ NUEVO: Separar datos de acciones
interface FabricacionesDataType {
  fabricaciones: IFabricacionConHoras[];
  isLoading: boolean;
  error: Error | null;
  hasPendingChanges: boolean;
  lastUpdated: Date | null;
  pendingChanges: Map<string, PendingChange>;
}

interface FabricacionesActionsType {
  refetch: () => Promise<void>;
  updateFabricaciones: (newFabricaciones: IFabricacionConHoras[]) => void;
  updateSingleFabricacion: (woId: string, updatedData: Partial<IFabricacionConHoras>) => void;
  onGanttOrdersChanged: (reorderedOrders: IFabricacionConHoras[], fromCapacity?: boolean) => void;
  onGanttOrderSaved: () => Promise<void>;
  setHasPendingChanges: (has: boolean) => void;
  savePendingChanges: () => Promise<{ success: boolean; saved: number; failed: number; errors: Array<{ NumWO: string; error: string }> }>;
  discardPendingChanges: () => void;
}

// ✅ NUEVO: Dos Contexts separados
const FabricacionesDataContext = createContext<FabricacionesDataType | null>(null);
const FabricacionesActionsContext = createContext<FabricacionesActionsType | null>(null);

interface FabricacionesProviderProps {
  children: ReactNode;
}

export const FabricacionesProvider: React.FC<FabricacionesProviderProps> = ({ children }) => {
  const [fabricaciones, setFabricaciones] = useState<IFabricacionConHoras[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [originalFabricaciones, setOriginalFabricaciones] = useState<IFabricacionConHoras[]>([]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFabricacionesConHoras();
      const validFabricaciones = data.filter(fab => fab.Fch_Objetivo);
      
      setFabricaciones(validFabricaciones);
      setOriginalFabricaciones(validFabricaciones);
      setPendingChanges(new Map());
      setHasPendingChanges(false);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
      console.error('❌ Error al recargar fabricaciones:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateFabricaciones = useCallback((newFabricaciones: IFabricacionConHoras[]) => {
    setFabricaciones(newFabricaciones);
    setLastUpdated(new Date());
  }, []);

  const updateSingleFabricacion = useCallback((woId: string, updatedData: Partial<IFabricacionConHoras>) => {
    setFabricaciones(prev => prev.map(fab => 
      fab.NumWO === woId ? { ...fab, ...updatedData } : fab
    ));
    setLastUpdated(new Date());
  }, []);

  const detectChanges = useCallback((
    original: IFabricacionConHoras, 
    current: IFabricacionConHoras
  ): Partial<IFabricacionConHoras> | null => {
    const changes: Partial<IFabricacionConHoras> = {};
    let hasChanges = false;

    const originalDate = original.Fch_Objetivo?.split('T')[0] || original.Fch_Objetivo;
    const currentDate = current.Fch_Objetivo?.split('T')[0] || current.Fch_Objetivo;
    
    if (originalDate !== currentDate) {
      changes.Fch_Objetivo = current.Fch_Objetivo;
      hasChanges = true;
    }

    if (original.Secuencia !== current.Secuencia) {
      changes.Secuencia = current.Secuencia;
      hasChanges = true;
    }

    if (original.Linea !== current.Linea) {
      changes.Linea = current.Linea;
      hasChanges = true;
    }

    return hasChanges ? changes : null;
  }, []);

  const sortFabrications = useCallback((fabs: IFabricacionConHoras[]): IFabricacionConHoras[] => {
    return [...fabs].sort((a, b) => {
      const dateA = new Date(a.Fch_Objetivo || '9999-12-31').getTime();
      const dateB = new Date(b.Fch_Objetivo || '9999-12-31').getTime();
      if (dateA !== dateB) return dateA - dateB;
      
      const lineCompare = (a.Linea || '').localeCompare(b.Linea || '');
      if (lineCompare !== 0) return lineCompare;
      
      const seqA = a.Secuencia ?? 999999;
      const seqB = b.Secuencia ?? 999999;
      return seqA - seqB;
    });
  }, []);

  const onGanttOrdersChanged = useCallback((reorderedOrders: IFabricacionConHoras[], fromCapacity = false) => {
    console.log('📦 [CONTEXT] onGanttOrdersChanged recibió:', reorderedOrders.length, 'WOs');
    console.log('📦 [CONTEXT] WO ...678 recibida:', 
      reorderedOrders.find(wo => wo.NumWO.endsWith('678'))
    );

    setFabricaciones(prevFabs => {
      const updatedWOsMap = new Map<string, IFabricacionConHoras>();
      reorderedOrders.forEach(wo => updatedWOsMap.set(wo.NumWO, wo));
      
      const mergedFabs = prevFabs.map(fab => {
        const updated = updatedWOsMap.get(fab.NumWO);
        return updated || fab;
      });
      
      reorderedOrders.forEach(wo => {
        if (!prevFabs.find(f => f.NumWO === wo.NumWO)) {
          mergedFabs.push(wo);
        }
      });
      
      const sortedFabs = sortFabrications(mergedFabs);
      return sortedFabs;
    });
    
    setLastUpdated(new Date());

    if (fromCapacity) {
      setOriginalFabricaciones(prev => {
        const updatedWOsMap = new Map<string, IFabricacionConHoras>();
        reorderedOrders.forEach(wo => updatedWOsMap.set(wo.NumWO, wo));
        
        const merged = prev.map(fab => updatedWOsMap.get(fab.NumWO) || fab);
        return sortFabrications(merged);
      });
      return;
    }

    const newPendingChanges = new Map<string, PendingChange>();
    
    reorderedOrders.forEach(currentWO => {
      const originalWO = originalFabricaciones.find(o => o.NumWO === currentWO.NumWO);
      
      if (!originalWO) {
        if (DEBUG_MODE) console.warn('⚠️ WO no encontrada en original:', currentWO.NumWO);
        return;
      }

      const changes = detectChanges(originalWO, currentWO);
      
      if (changes) {
        newPendingChanges.set(currentWO.NumWO, {
          NumWO: currentWO.NumWO,
          changes,
          timestamp: new Date()
        });
      }
    });

    setPendingChanges(newPendingChanges);
    setHasPendingChanges(newPendingChanges.size > 0);
  }, [originalFabricaciones, detectChanges, sortFabrications]);

  const savePendingChanges = useCallback(async () => {
    if (pendingChanges.size === 0) {
      return { success: true, saved: 0, failed: 0, errors: [] };
    }

    let saved = 0;
    let failed = 0;
    const errors: Array<{ NumWO: string; error: string }> = [];

    const savePromises = Array.from(pendingChanges.values()).map(async (pendingChange) => {
      try {
        await updateFabricacionConHoras(pendingChange.NumWO, pendingChange.changes);
        saved++;
      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        errors.push({ NumWO: pendingChange.NumWO, error: errorMsg });
        console.error(`❌ Error guardando ${pendingChange.NumWO}:`, errorMsg);
      }
    });

    await Promise.all(savePromises);

    if (failed === 0) {
      setPendingChanges(new Map());
      setHasPendingChanges(false);
      setOriginalFabricaciones([...fabricaciones]);
    }

    return { success: failed === 0, saved, failed, errors };
  }, [pendingChanges, fabricaciones]);

  const discardPendingChanges = useCallback(() => {
    setFabricaciones([...originalFabricaciones]);
    setPendingChanges(new Map());
    setHasPendingChanges(false);
    setLastUpdated(new Date());
  }, [originalFabricaciones]);

  const onGanttOrderSaved = useCallback(async () => {
    await savePendingChanges();
    await refetch();
  }, [savePendingChanges, refetch]);

  useEffect(() => {
    if (fabricaciones.length === 0 && !isLoading && !error) {
      refetch();
    }
  }, []);

  // ✅ NUEVO: Memoizar DATA (solo cambia cuando cambian los datos)
  const dataValue = useMemo<FabricacionesDataType>(() => ({
    fabricaciones,
    isLoading,
    error,
    hasPendingChanges,
    lastUpdated,
    pendingChanges
  }), [fabricaciones, isLoading, error, hasPendingChanges, lastUpdated, pendingChanges]);

  // ✅ NUEVO: Memoizar ACTIONS (nunca cambia porque todas son useCallback)
  const actionsValue = useMemo<FabricacionesActionsType>(() => ({
    refetch,
    updateFabricaciones,
    updateSingleFabricacion,
    onGanttOrdersChanged,
    onGanttOrderSaved,
    setHasPendingChanges,
    savePendingChanges,
    discardPendingChanges
  }), [
    refetch,
    updateFabricaciones,
    updateSingleFabricacion,
    onGanttOrdersChanged,
    onGanttOrderSaved,
    savePendingChanges,
    discardPendingChanges
  ]);

  return (
    <CapacityProvider>
      <FabricacionesActionsContext.Provider value={actionsValue}>
        <FabricacionesDataContext.Provider value={dataValue}>
          {children}
        </FabricacionesDataContext.Provider>
      </FabricacionesActionsContext.Provider>
    </CapacityProvider>
  );
};

// ✅ NUEVO: Hook para obtener solo DATA
export const useFabricacionesData = () => {
  const context = useContext(FabricacionesDataContext);
  if (!context) {
    throw new Error('useFabricacionesData debe usarse dentro de FabricacionesProvider');
  }
  return context;
};

// ✅ NUEVO: Hook para obtener solo ACTIONS
export const useFabricacionesActions = () => {
  const context = useContext(FabricacionesActionsContext);
  if (!context) {
    throw new Error('useFabricacionesActions debe usarse dentro de FabricacionesProvider');
  }
  return context;
};

// ✅ MANTENER: Hook legacy para compatibilidad (combina ambos)
export const useFabricacionesContext = () => {
  const data = useFabricacionesData();
  const actions = useFabricacionesActions();
  
  return {
    ...data,
    ...actions
  };
};