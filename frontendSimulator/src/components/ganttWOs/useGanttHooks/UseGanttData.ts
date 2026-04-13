import { useState, useEffect, useMemo } from 'react';
import { GanttData } from './Types';
import { getNonWorkingDays } from '../../../services/VacacionesServices';
import { generateInitialWorkingDays } from './UseDateHandlers';

const initializationState = new Map<string, boolean>();
const workingDaysCache = new Map<string, string[]>();
const dataCache = new Map<string, GanttData>();

export const useGanttData = (lineId: string = 'default') => {
  const [data, setData] = useState<GanttData | null>(() => {
    return dataCache.get(lineId) || null;
  });
  
  const [workingDays, setWorkingDays] = useState<string[]>(() => {
    return workingDaysCache.get(lineId) || [];
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const generateFallbackWorkingDays = useMemo((): string[] => {
    const days: string[] = [];
    const today = new Date();
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = currentDate.toISOString().split("T")[0];
        days.push(dateStr);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  }, []);

  useEffect(() => {
    // Resetear data al cache de la nueva clave (null si es nueva)
    setData(dataCache.get(lineId) || null);
    setWorkingDays(workingDaysCache.get(lineId) || []);

    if (initializationState.get(lineId)) {
      return;
    }

    initializationState.set(lineId, true);

    // Reusar días no laborables ya cargados si existen para cualquier clave
    const existingWorkingDays = Array.from(workingDaysCache.values()).find(d => d.length > 0);
    if (existingWorkingDays) {
      workingDaysCache.set(lineId, existingWorkingDays);
      setWorkingDays(existingWorkingDays);

      const initialData = {
        workOrders: [],
        capacity: [],
        nonWorkingDays: [],
      };
      dataCache.set(lineId, initialData);
      setData(initialData);
      return;
    }

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const nonWorkingFromApi = await getNonWorkingDays();
        const initialWorkingDays = generateInitialWorkingDays(nonWorkingFromApi);

        workingDaysCache.set(lineId, initialWorkingDays);
        setWorkingDays(initialWorkingDays);

        const initialData = {
          workOrders: [],
          capacity: [],
          nonWorkingDays: nonWorkingFromApi || [],
        };

        dataCache.set(lineId, initialData);
        setData(initialData);
      } catch (error) {
        console.error(`❌ [useGanttData] Error cargando días no laborables:`, error);

        const fallbackDays = generateFallbackWorkingDays;
        workingDaysCache.set(lineId, fallbackDays);
        setWorkingDays(fallbackDays);

        const fallbackData = {
          workOrders: [],
          capacity: [],
          nonWorkingDays: [],
        };

        dataCache.set(lineId, fallbackData);
        setData(fallbackData);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [lineId, generateFallbackWorkingDays]);

  useEffect(() => {
    if (workingDays.length > 0) {
      workingDaysCache.set(lineId, workingDays);
    }
  }, [workingDays, lineId]);

  useEffect(() => {
    if (data) {
      dataCache.set(lineId, data);
    }
  }, [data, lineId]);

  return {
    data,
    setData,
    workingDays,
    setWorkingDays,
    isLoading,
  };
};