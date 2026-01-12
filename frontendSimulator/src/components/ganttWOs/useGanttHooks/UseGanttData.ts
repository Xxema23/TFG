import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GanttData } from './Types';
import { getNonWorkingDays } from '../../../services/VacacionesServices';
import { generateInitialWorkingDays } from './UseDateHandlers';

export const useGanttData = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // ⬇️⬇️⬇️ FIX CRÍTICO: Prevenir múltiples inicializaciones ⬇️⬇️⬇️
  const hasInitialized = useRef(false);

  // ✅ OPTIMIZACIÓN: generateFallbackWorkingDays (sin cambios, ya estaba bien)
  const generateFallbackWorkingDays = useMemo((): string[] => {
    const days: string[] = [];
    const today = new Date();
    
    // 7 días atrás
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 7);
    
    // 30 días adelante
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

  // ⬇️⬇️⬇️ FIX CRÍTICO: Remover isLoading de dependencies ⬇️⬇️⬇️
  const fetchInitialData = useCallback(async () => {
    // ✅ Prevenir múltiples ejecuciones
    if (hasInitialized.current) {
      console.log('⏭️ [useGanttData] Ya inicializado, skip');
      return;
    }
    
    hasInitialized.current = true;
    console.log('🚀 [useGanttData] Inicializando datos...');
    
    setIsLoading(true);
    try {
      const nonWorkingFromApi = await getNonWorkingDays();
      const initialWorkingDays = generateInitialWorkingDays(nonWorkingFromApi);
      
      console.log('✅ [useGanttData] Working days generados:', initialWorkingDays.length);
      setWorkingDays(initialWorkingDays);

      const initialData = {
        workOrders: [],
        capacity: [],
        nonWorkingDays: nonWorkingFromApi || [],
      };

      setData(initialData);
      console.log('✅ [useGanttData] Data inicial configurada');
    } catch (error) {
      console.error('❌ [useGanttData] Error cargando días no laborables:', error);
      console.log('⚠️ [useGanttData] Usando fallback working days');
      
      setWorkingDays(generateFallbackWorkingDays);
      setData({
        workOrders: [],
        capacity: [],
        nonWorkingDays: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [generateFallbackWorkingDays]); // ⬅️ isLoading REMOVIDO

  // ⬇️⬇️⬇️ FIX CRÍTICO: Ahora es seguro tener fetchInitialData en dependencies ⬇️⬇️⬇️
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  return { 
    data, 
    setData, 
    workingDays, 
    setWorkingDays,
    isLoading,
    reloadWorkingDays: fetchInitialData
  };
};