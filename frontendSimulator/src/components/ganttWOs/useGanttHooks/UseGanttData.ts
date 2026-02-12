import { useState, useEffect, useCallback, useMemo } from 'react';
import { GanttData } from './Types';
import { getNonWorkingDays } from '../../../services/VacacionesServices';
import { generateInitialWorkingDays } from './UseDateHandlers';

// ✅ MAP GLOBAL - PERSISTE ENTRE RENDERS Y ENTRE INSTANCIAS
const initializationState = new Map<string, boolean>();
const workingDaysCache = new Map<string, string[]>();
const dataCache = new Map<string, GanttData>();  // ⬅️ NUEVO: Cache para data

export const useGanttData = (lineId: string = 'default') => {
  // ✅ RESTAURAR desde cache si existe
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

  // ✅ INICIALIZACIÓN ÚNICA POR LÍNEA
  useEffect(() => {
    if (initializationState.get(lineId)) {
      console.log(`⏭️ [useGanttData-${lineId}] Ya inicializado, skip`);
      return;
    }
    
    initializationState.set(lineId, true);
    console.log(`🚀 [useGanttData-${lineId}] Inicializando datos...`);
    
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const nonWorkingFromApi = await getNonWorkingDays();
        const initialWorkingDays = generateInitialWorkingDays(nonWorkingFromApi);
        
        console.log(`✅ [useGanttData-${lineId}] Working days generados:`, initialWorkingDays.length);
        
        workingDaysCache.set(lineId, initialWorkingDays);
        setWorkingDays(initialWorkingDays);

        const initialData = {
          workOrders: [],
          capacity: [],
          nonWorkingDays: nonWorkingFromApi || [],
        };

        dataCache.set(lineId, initialData);  // ⬅️ GUARDAR en cache
        setData(initialData);
        console.log(`✅ [useGanttData-${lineId}] Data inicial configurada`);
      } catch (error) {
        console.error(`❌ [useGanttData-${lineId}] Error cargando días no laborables:`, error);
        console.log(`⚠️ [useGanttData-${lineId}] Usando fallback working days`);
        
        const fallbackDays = generateFallbackWorkingDays;
        workingDaysCache.set(lineId, fallbackDays);
        setWorkingDays(fallbackDays);
        
        const fallbackData = {
          workOrders: [],
          capacity: [],
          nonWorkingDays: [],
        };
        
        dataCache.set(lineId, fallbackData);  // ⬅️ GUARDAR en cache
        setData(fallbackData);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
  }, [lineId, generateFallbackWorkingDays]);

  // ✅ Sincronizar workingDays con cache
  useEffect(() => {
    if (workingDays.length > 0) {
      workingDaysCache.set(lineId, workingDays);
    }
  }, [workingDays, lineId]);

  // ✅ NUEVO: Sincronizar data con cache
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