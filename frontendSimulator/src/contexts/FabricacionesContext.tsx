import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useMemo, useRef } from 'react';
import { IFabricacionConHoras } from '../interfaces/IFabricacionConHoras';
import { getFabricacionesConHoras, updateFabricacionConHoras } from '../services/FabricacionConHoras';
import { CapacityProvider } from './CapacityContext';

interface PendingChange {
  NumWO: string;
  changes: Partial<IFabricacionConHoras>;
  timestamp: Date;
}

interface ScenarioState {
  fabricaciones: IFabricacionConHoras[];
  originalFabricaciones: IFabricacionConHoras[];
  pendingChanges: Map<string, PendingChange>;
  hasPendingChanges: boolean;
  lastUpdated: Date | null;
  initialized: boolean;
}

interface FabricacionesDataType {
  fabricaciones: IFabricacionConHoras[];
  isLoading: boolean;
  error: Error | null;
  hasPendingChanges: boolean;
  lastUpdated: Date | null;
  pendingChanges: Map<string, PendingChange>;
  activeScenarioId: number;
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
  setActiveScenario: (scenarioId: number) => void;
}

const FabricacionesDataContext = createContext<FabricacionesDataType | null>(null);
const FabricacionesActionsContext = createContext<FabricacionesActionsType | null>(null);

const createEmptyScenarioState = (): ScenarioState => ({
  fabricaciones: [],
  originalFabricaciones: [],
  pendingChanges: new Map(),
  hasPendingChanges: false,
  lastUpdated: null,
  initialized: false,
});

export const FabricacionesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeScenarioId, setActiveScenarioId] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Map de estados por escenario
  const scenariosRef = useRef<Map<number, ScenarioState>>(new Map([
    [1, createEmptyScenarioState()],
    [2, createEmptyScenarioState()],
    [3, createEmptyScenarioState()],
  ]));

  // Estado del escenario activo — para forzar re-renders
  const [activeState, setActiveState] = useState<ScenarioState>(createEmptyScenarioState());

  const getScenarioState = useCallback((scenarioId: number): ScenarioState => {
    if (!scenariosRef.current.has(scenarioId)) {
      scenariosRef.current.set(scenarioId, createEmptyScenarioState());
    }
    return scenariosRef.current.get(scenarioId)!;
  }, []);

  const updateScenarioState = useCallback((scenarioId: number, updater: (prev: ScenarioState) => ScenarioState) => {
    const current = getScenarioState(scenarioId);
    const updated = updater(current);
    scenariosRef.current.set(scenarioId, updated);
    // Solo actualizar el estado React si es el escenario activo
    if (scenarioId === activeScenarioId) {
      setActiveState(updated);
    }
  }, [activeScenarioId, getScenarioState]);

  const sortFabrications = useCallback((fabs: IFabricacionConHoras[]): IFabricacionConHoras[] => {
    return [...fabs].sort((a, b) => {
      const dateA = new Date(a.Fch_Objetivo || '9999-12-31').getTime();
      const dateB = new Date(b.Fch_Objetivo || '9999-12-31').getTime();
      if (dateA !== dateB) return dateA - dateB;
      const lineCompare = (a.Linea || '').localeCompare(b.Linea || '');
      if (lineCompare !== 0) return lineCompare;
      return (a.Secuencia ?? 999999) - (b.Secuencia ?? 999999);
    });
  }, []);

  const loadScenario = useCallback(async (scenarioId: number) => {
    const state = getScenarioState(scenarioId);
    if (state.initialized) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await getFabricacionesConHoras();
      const valid = data.filter(fab => fab.Fch_Objetivo);
      const newState: ScenarioState = {
        fabricaciones: valid,
        originalFabricaciones: valid,
        pendingChanges: new Map(),
        hasPendingChanges: false,
        lastUpdated: new Date(),
        initialized: true,
      };
      scenariosRef.current.set(scenarioId, newState);
      return newState;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [getScenarioState]);

  const setActiveScenario = useCallback(async (scenarioId: number) => {
    setActiveScenarioId(scenarioId);
    const state = getScenarioState(scenarioId);
    if (state.initialized) {
      setActiveState(state);
    } else {
      const loaded = await loadScenario(scenarioId);
      if (loaded) setActiveState(loaded);
    }
  }, [getScenarioState, loadScenario]);

  useEffect(() => {
      loadScenario(1).then(loaded => {
        if (loaded) setActiveState(loaded);
      });
    }, []);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getFabricacionesConHoras();
      const valid = data.filter(fab => fab.Fch_Objetivo);
      updateScenarioState(activeScenarioId, () => ({
        fabricaciones: valid,
        originalFabricaciones: valid,
        pendingChanges: new Map(),
        hasPendingChanges: false,
        lastUpdated: new Date(),
        initialized: true,
      }));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  }, [activeScenarioId, updateScenarioState]);

  const updateFabricaciones = useCallback((newFabricaciones: IFabricacionConHoras[]) => {
    updateScenarioState(activeScenarioId, prev => ({
      ...prev,
      fabricaciones: newFabricaciones,
      lastUpdated: new Date(),
    }));
  }, [activeScenarioId, updateScenarioState]);

  const updateSingleFabricacion = useCallback((woId: string, updatedData: Partial<IFabricacionConHoras>) => {
    updateScenarioState(activeScenarioId, prev => ({
      ...prev,
      fabricaciones: prev.fabricaciones.map(fab =>
        fab.NumWO === woId ? { ...fab, ...updatedData } : fab
      ),
      lastUpdated: new Date(),
    }));
  }, [activeScenarioId, updateScenarioState]);

  const detectChanges = useCallback((
    original: IFabricacionConHoras,
    current: IFabricacionConHoras
  ): Partial<IFabricacionConHoras> | null => {
    const changes: Partial<IFabricacionConHoras> = {};
    let hasChanges = false;

    const originalDate = original.Fch_Objetivo?.split('T')[0] || original.Fch_Objetivo;
    const currentDate = current.Fch_Objetivo?.split('T')[0] || current.Fch_Objetivo;

    if (originalDate !== currentDate) { changes.Fch_Objetivo = current.Fch_Objetivo; hasChanges = true; }
    if (original.Secuencia !== current.Secuencia) { changes.Secuencia = current.Secuencia; hasChanges = true; }
    if (original.Linea !== current.Linea) { changes.Linea = current.Linea; hasChanges = true; }

    return hasChanges ? changes : null;
  }, []);

  const onGanttOrdersChanged = useCallback((reorderedOrders: IFabricacionConHoras[], fromCapacity = false) => {
    updateScenarioState(activeScenarioId, prev => {
      const updatedWOsMap = new Map<string, IFabricacionConHoras>();
      reorderedOrders.forEach(wo => updatedWOsMap.set(wo.NumWO, wo));

      const mergedFabs = prev.fabricaciones.map(fab => updatedWOsMap.get(fab.NumWO) || fab);
      reorderedOrders.forEach(wo => {
        if (!prev.fabricaciones.find(f => f.NumWO === wo.NumWO)) mergedFabs.push(wo);
      });
      const sortedFabs = sortFabrications(mergedFabs);

      if (fromCapacity) {
        const mergedOriginal = prev.originalFabricaciones.map(fab => updatedWOsMap.get(fab.NumWO) || fab);
        return {
          ...prev,
          fabricaciones: sortedFabs,
          originalFabricaciones: sortFabrications(mergedOriginal),
          lastUpdated: new Date(),
        };
      }

      const newPendingChanges = new Map<string, PendingChange>();
      reorderedOrders.forEach(currentWO => {
        const originalWO = prev.originalFabricaciones.find(o => o.NumWO === currentWO.NumWO);
        if (!originalWO) return;
        const changes = detectChanges(originalWO, currentWO);
        if (changes) {
          newPendingChanges.set(currentWO.NumWO, {
            NumWO: currentWO.NumWO,
            changes,
            timestamp: new Date()
          });
        }
      });

      return {
        ...prev,
        fabricaciones: sortedFabs,
        pendingChanges: newPendingChanges,
        hasPendingChanges: newPendingChanges.size > 0,
        lastUpdated: new Date(),
      };
    });
  }, [activeScenarioId, updateScenarioState, sortFabrications, detectChanges]);

  const savePendingChanges = useCallback(async () => {
    const state = getScenarioState(activeScenarioId);
    if (state.pendingChanges.size === 0) {
      return { success: true, saved: 0, failed: 0, errors: [] };
    }

    let saved = 0;
    let failed = 0;
    const errors: Array<{ NumWO: string; error: string }> = [];

    await Promise.all(Array.from(state.pendingChanges.values()).map(async (pendingChange) => {
      try {
        await updateFabricacionConHoras(pendingChange.NumWO, pendingChange.changes);
        saved++;
      } catch (err) {
        failed++;
        errors.push({ NumWO: pendingChange.NumWO, error: err instanceof Error ? err.message : 'Error' });
      }
    }));

    if (failed === 0) {
      updateScenarioState(activeScenarioId, prev => ({
        ...prev,
        pendingChanges: new Map(),
        hasPendingChanges: false,
        originalFabricaciones: [...prev.fabricaciones],
      }));
    }

    return { success: failed === 0, saved, failed, errors };
  }, [activeScenarioId, getScenarioState, updateScenarioState]);

  const discardPendingChanges = useCallback(() => {
    updateScenarioState(activeScenarioId, prev => ({
      ...prev,
      fabricaciones: [...prev.originalFabricaciones],
      pendingChanges: new Map(),
      hasPendingChanges: false,
      lastUpdated: new Date(),
    }));
  }, [activeScenarioId, updateScenarioState]);

  const onGanttOrderSaved = useCallback(async () => {
    await savePendingChanges();
    await refetch();
  }, [savePendingChanges, refetch]);

  const setHasPendingChangesAction = useCallback((has: boolean) => {
    updateScenarioState(activeScenarioId, prev => ({
      ...prev,
      hasPendingChanges: has,
    }));
  }, [activeScenarioId, updateScenarioState]);

  const dataValue = useMemo<FabricacionesDataType>(() => ({
    fabricaciones: activeState.fabricaciones,
    isLoading,
    error,
    hasPendingChanges: activeState.hasPendingChanges,
    lastUpdated: activeState.lastUpdated,
    pendingChanges: activeState.pendingChanges,
    activeScenarioId,
  }), [activeState, isLoading, error, activeScenarioId]);

  const actionsValue = useMemo<FabricacionesActionsType>(() => ({
    refetch,
    updateFabricaciones,
    updateSingleFabricacion,
    onGanttOrdersChanged,
    onGanttOrderSaved,
    setHasPendingChanges: setHasPendingChangesAction,
    savePendingChanges,
    discardPendingChanges,
    setActiveScenario,
  }), [
    refetch,
    updateFabricaciones,
    updateSingleFabricacion,
    onGanttOrdersChanged,
    onGanttOrderSaved,
    setHasPendingChangesAction,
    savePendingChanges,
    discardPendingChanges,
    setActiveScenario,
  ]);

  return (
    <CapacityProvider activeScenarioId={activeScenarioId}>
      <FabricacionesActionsContext.Provider value={actionsValue}>
        <FabricacionesDataContext.Provider value={dataValue}>
          {children}
        </FabricacionesDataContext.Provider>
      </FabricacionesActionsContext.Provider>
    </CapacityProvider>
  );
};

export const useFabricacionesData = () => {
  const context = useContext(FabricacionesDataContext);
  if (!context) throw new Error('useFabricacionesData debe usarse dentro de FabricacionesProvider');
  return context;
};

export const useFabricacionesActions = () => {
  const context = useContext(FabricacionesActionsContext);
  if (!context) throw new Error('useFabricacionesActions debe usarse dentro de FabricacionesProvider');
  return context;
};

export const useFabricacionesContext = () => {
  const data = useFabricacionesData();
  const actions = useFabricacionesActions();
  return { ...data, ...actions };
};