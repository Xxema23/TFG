import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { DailyCapacity, BaseCapacity, CapacityData } from '../interfaces/Capacity';
import { 
  getBaseCapacities, 
  getCapacities, 
  buildDailyCapacities,
  saveCapacities,
  deleteCapacities
} from '../services/capacityService';

// Tipo del callback de recálculo que registra UseGanttHooks
type RecalculateCallback = (
  capacities: CapacityData[],
  deletions: { line: string; week: number; year: number }[],
  freshDailyCapacities?: DailyCapacity[]
) => Promise<void>;

interface CapacityContextType {
  dailyCapacities: DailyCapacity[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  workingDays: string[];
  // ── Nuevo: modal y handler unificado ──────────────────────────────────────
  isCapacityModalOpen: boolean;
  openCapacityModal: () => void;
  closeCapacityModal: () => void;
  handleSaveCapacity: (
    capacities: CapacityData[],
    deletions?: { line: string; week: number; year: number }[]
  ) => Promise<void>;
  /** UseGanttHooks llama esto al montarse para registrar su lógica de recálculo */
  registerRecalculateCallback: (cb: RecalculateCallback) => void;
}

const CapacityContext = createContext<CapacityContextType | null>(null);

export const CapacityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dailyCapacities, setDailyCapacities] = useState<DailyCapacity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [isCapacityModalOpen, setIsCapacityModalOpen] = useState(false);

  const capacitiesRef = useRef<DailyCapacity[]>([]);
  const isLoadingRef = useRef(false);
  const yearCapacitiesCache = useRef<Map<number, CapacityData[]>>(new Map());
  // Callback registrado por UseGanttHooks para recalcular WOs tras guardar
  const recalculateCallbackRef = useRef<RecalculateCallback | null>(null);

  // ── Días laborables ────────────────────────────────────────────────────────
  useEffect(() => {
    const calculateWorkingDays = () => {
      const today = new Date();
      const allWorkingDays: string[] = [];
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 7);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 120);

      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          allWorkingDays.push(currentDate.toISOString().split('T')[0]);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return allWorkingDays;
    };
    setWorkingDays(calculateWorkingDays());
  }, []);

  // ── Carga de capacidades ───────────────────────────────────────────────────
  const loadCapacities = useCallback(async () => {
    if (isLoadingRef.current) return;
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      const baseCapacities = await getBaseCapacities(1);
      const currentYear = new Date().getFullYear();
      const years = [currentYear - 1, currentYear, currentYear + 1];
      const allWeeklyCapacities: CapacityData[] = [];

      for (const year of years) {
        if (yearCapacitiesCache.current.has(year)) {
          allWeeklyCapacities.push(...yearCapacitiesCache.current.get(year)!);
        } else {
          const yearCaps = await getCapacities(1, year);
          yearCapacitiesCache.current.set(year, yearCaps);
          allWeeklyCapacities.push(...yearCaps);
        }
      }

      const daily = buildDailyCapacities(baseCapacities, allWeeklyCapacities, workingDays);
      setDailyCapacities(daily);
      capacitiesRef.current = daily;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Error cargando capacidades');
      setError(e);
      console.error('❌ [CapacityContext] Error cargando capacidades:', e);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [workingDays]);

  useEffect(() => {
    if (workingDays.length > 0 && dailyCapacities.length === 0) {
      loadCapacities();
    }
  }, [workingDays.length]);

  const refresh = useCallback(async () => {
    yearCapacitiesCache.current.clear();
    await loadCapacities();
  }, [loadCapacities]);

  // ── Modal ──────────────────────────────────────────────────────────────────
  const openCapacityModal = useCallback(() => setIsCapacityModalOpen(true), []);
  const closeCapacityModal = useCallback(() => setIsCapacityModalOpen(false), []);

  // ── Registro del callback de recálculo (lo llama UseGanttHooks) ───────────
  const registerRecalculateCallback = useCallback((cb: RecalculateCallback) => {
    recalculateCallbackRef.current = cb;
  }, []);

  // ── Handler unificado (el que usaban el engranaje del Gantt y el modal) ───
  const handleSaveCapacity = useCallback(async (
    capacities: CapacityData[],
    deletions: { line: string; week: number; year: number }[] = []
  ): Promise<void> => {
    try {
      // 1. Guardar en BD
      if (capacities.length > 0) {
        const result = await saveCapacities(1, capacities);
        if (!result.success) {
          console.error('❌ Error guardando capacidades');
          return;
        }
      }
      if (deletions.length > 0) {
        const result = await deleteCapacities(1, deletions);
        if (!result.success) {
          console.error('❌ Error eliminando capacidades');
          return;
        }
      }

      // 2. Recargar capacidades en el contexto
      yearCapacitiesCache.current.clear();
      await loadCapacities();

      // 3. Cerrar modal
      setIsCapacityModalOpen(false);

      // 4. Delegar recálculo de WOs a UseGanttHooks (si está registrado)
      if (recalculateCallbackRef.current) {
        await recalculateCallbackRef.current(capacities, deletions, capacitiesRef.current);
      }
    } catch (error) {
      console.error('❌ [CapacityContext] Error en handleSaveCapacity:', error);
      throw error;
    }
  }, [loadCapacities]);

  const value: CapacityContextType = {
    dailyCapacities,
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
  if (!context) {
    throw new Error('useCapacity debe usarse dentro de CapacityProvider');
  }
  return context;
};