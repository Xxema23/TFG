import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { DailyCapacity, CapacityData } from '../interfaces/Capacity';
import { getNonWorkingDays } from '../services/vacacionesServices';
import {
  getBaseCapacities,
  getCapacities,
  buildDailyCapacities,
  saveCapacities,
  deleteCapacities
} from '../services/capacityService';

type RecalculateCallback = (
  capacities: CapacityData[],
  deletions: { line: string; week: number; year: number }[],
  freshDailyCapacities?: DailyCapacity[],
  scenarioId?: number
) => Promise<void>;

interface ScenarioCapacityState {
  dailyCapacities: DailyCapacity[];
  initialized: boolean;
}

interface CapacityContextType {
  dailyCapacities: DailyCapacity[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  workingDays: string[];
  isCapacityModalOpen: boolean;
  openCapacityModal: () => void;
  closeCapacityModal: () => void;
  handleSaveCapacity: (
    capacities: CapacityData[],
    deletions?: { line: string; week: number; year: number }[]
  ) => Promise<void>;
  registerRecalculateCallback: (cb: RecalculateCallback) => void;
}

const CapacityContext = createContext<CapacityContextType | null>(null);

export const CapacityProvider: React.FC<{
  children: React.ReactNode;
  activeScenarioId: number;
}> = ({ children, activeScenarioId }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [isCapacityModalOpen, setIsCapacityModalOpen] = useState(false);
  const [activeCapacities, setActiveCapacities] = useState<DailyCapacity[]>([]);

  const isLoadingRef = useRef(false);
  const scenarioCapacitiesRef = useRef<Map<number, ScenarioCapacityState>>(new Map([
    [1, { dailyCapacities: [], initialized: false }],
    [2, { dailyCapacities: [], initialized: false }],
    [3, { dailyCapacities: [], initialized: false }],
  ]));
  const yearCapacitiesCacheRef = useRef<Map<string, CapacityData[]>>(new Map());
  const recalculateCallbackRef = useRef<RecalculateCallback | null>(null);
  const workingDaysRef = useRef<string[]>([]);

  useEffect(() => {
    workingDaysRef.current = workingDays;
  }, [workingDays]);

  // ── Días laborables ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchWorkingDays = async () => {
      const nonWorkingDates = await getNonWorkingDays();
      const nonWorkingSet = new Set(nonWorkingDates);

      const today = new Date();
      const allWorkingDays: string[] = [];
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 120);

      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dow = currentDate.getDay();
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        if (dow !== 0 && dow !== 6 && !nonWorkingSet.has(dateStr)) {
          allWorkingDays.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      setWorkingDays(allWorkingDays);
    };

    fetchWorkingDays();
  }, []);

  // ── Carga de capacidades para un escenario ────────────────────────────────
  const loadCapacitiesForScenario = useCallback(async (scenarioId: number): Promise<DailyCapacity[]> => {
    console.log('🔄 [loadCapacities] scenarioId:', scenarioId, 
  'workingDaysRef:', workingDaysRef.current.length,
  'workingDays:', workingDays.length,
  'isLoading:', isLoadingRef.current
);
    if (!scenarioId || typeof scenarioId !== 'number') return [];
    if (isLoadingRef.current) return [];
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      let baseCapacities = await getBaseCapacities(scenarioId);
      if (baseCapacities.length === 0 && scenarioId !== 1) {
        baseCapacities = await getBaseCapacities(1);
      }

      const currentYear = new Date().getFullYear();
      const years = [currentYear - 1, currentYear, currentYear + 1];
      const allWeeklyCapacities: CapacityData[] = [];

      for (const year of years) {
        const cacheKey = `${scenarioId}-${year}`;
        if (yearCapacitiesCacheRef.current.has(cacheKey)) {
          allWeeklyCapacities.push(...yearCapacitiesCacheRef.current.get(cacheKey)!);
        } else {
          const yearCaps = await getCapacities(scenarioId, year);
          yearCapacitiesCacheRef.current.set(cacheKey, yearCaps);
          allWeeklyCapacities.push(...yearCaps);
        }
      }

      const days = workingDaysRef.current.length > 0 ? workingDaysRef.current : workingDays;
      const daily = buildDailyCapacities(baseCapacities, allWeeklyCapacities, days);
      scenarioCapacitiesRef.current.set(scenarioId, {
        dailyCapacities: daily,
        initialized: true,
      });

      return daily;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error cargando capacidades');
      setError(e);
      console.error('❌ [CapacityContext] Error:', e);
      return [];
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [workingDays]);

  // ── Cuando cambia el escenario activo ─────────────────────────────────────
  useEffect(() => {
    if (workingDays.length === 0) return;
    if (!activeScenarioId || typeof activeScenarioId !== 'number') return;

    const state = scenarioCapacitiesRef.current.get(activeScenarioId);
    if (state?.initialized) {
      setActiveCapacities(state.dailyCapacities);
    } else {
      loadCapacitiesForScenario(activeScenarioId).then(daily => {
        setActiveCapacities(daily);
      });
    }
  }, [activeScenarioId, workingDays.length]);

  const refresh = useCallback(async () => {
    // Limpia cache del escenario activo y recarga
    const currentYear = new Date().getFullYear();
    [currentYear - 1, currentYear, currentYear + 1].forEach(year => {
      yearCapacitiesCacheRef.current.delete(`${activeScenarioId}-${year}`);
    });
    scenarioCapacitiesRef.current.set(activeScenarioId, { dailyCapacities: [], initialized: false });
    const daily = await loadCapacitiesForScenario(activeScenarioId);
    setActiveCapacities(daily);
  }, [activeScenarioId, loadCapacitiesForScenario]);

  const openCapacityModal = useCallback(() => setIsCapacityModalOpen(true), []);
  const closeCapacityModal = useCallback(() => setIsCapacityModalOpen(false), []);

  const registerRecalculateCallback = useCallback((cb: RecalculateCallback) => {
    recalculateCallbackRef.current = cb;
  }, []);

  const handleSaveCapacity = useCallback(async (
    capacities: CapacityData[],
    deletions: { line: string; week: number; year: number }[] = []
  ): Promise<void> => {
    try {
      if (capacities.length > 0) {
        const result = await saveCapacities(activeScenarioId, capacities);
        if (!result.success) {
          console.error('❌ Error guardando capacidades');
          return;
        }
      }
      if (deletions.length > 0) {
        const result = await deleteCapacities(activeScenarioId, deletions);
        if (!result.success) {
          console.error('❌ Error eliminando capacidades');
          return;
        }
      }

      // Limpiar cache y recargar para el escenario activo
      const currentYear = new Date().getFullYear();
      [currentYear - 1, currentYear, currentYear + 1].forEach(year => {
        yearCapacitiesCacheRef.current.delete(`${activeScenarioId}-${year}`);
      });
      const daily = await loadCapacitiesForScenario(activeScenarioId);
        setActiveCapacities(daily);
        // Actualizar capacitiesRef explícitamente antes de llamar al callback
        scenarioCapacitiesRef.current.set(activeScenarioId, { dailyCapacities: daily, initialized: true });

        setIsCapacityModalOpen(false);

        if (recalculateCallbackRef.current) {
          await recalculateCallbackRef.current(capacities, deletions, daily, activeScenarioId);
        }
    } catch (error) {
      console.error('❌ [CapacityContext] Error en handleSaveCapacity:', error);
      throw error;
    }
  }, [activeScenarioId, loadCapacitiesForScenario]);

  const value: CapacityContextType = {
    dailyCapacities: activeCapacities,
    isLoading,
    error,
    refresh,
    workingDays,
    isCapacityModalOpen,
    openCapacityModal,
    closeCapacityModal,
    handleSaveCapacity,
    registerRecalculateCallback,
  };

  return (
    <CapacityContext.Provider value={value}>
      {children}
    </CapacityContext.Provider>
  );
};

export const useCapacity = () => {
  const context = useContext(CapacityContext);
  if (!context) throw new Error('useCapacity debe usarse dentro de CapacityProvider');
  return context;
};