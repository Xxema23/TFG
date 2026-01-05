import { useState, useEffect, useCallback, useMemo } from 'react';
import { GanttData } from './Types';
import { getNonWorkingDays } from '../../../services/VacacionesServices';
import { generateInitialWorkingDays } from './UseDateHandlers';

export const useGanttData = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ⬇️⬇️⬇️ ARREGLADO: 7 atrás + 30 adelante ⬇️⬇️⬇️
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

  const fetchInitialData = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const nonWorkingFromApi = await getNonWorkingDays();
      const initialWorkingDays = generateInitialWorkingDays(nonWorkingFromApi);
      setWorkingDays(initialWorkingDays);

      const initialData = {
        workOrders: [],
        capacity: [],
        nonWorkingDays: nonWorkingFromApi || [],
      };

      setData(initialData);
    } catch (error) {
      setWorkingDays(generateFallbackWorkingDays);
      setData({
        workOrders: [],
        capacity: [],
        nonWorkingDays: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [generateFallbackWorkingDays, isLoading]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  return { 
    data, 
    setData, 
    workingDays, 
    setWorkingDays,
    isLoading,
    reloadWorkingDays: fetchInitialData
  };
};