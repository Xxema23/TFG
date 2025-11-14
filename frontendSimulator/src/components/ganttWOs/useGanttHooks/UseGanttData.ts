// 📁 src/components/ganttWOs/useGanttHooks/UseGanttData.ts (OPTIMIZADO)
import { useState, useEffect, useCallback, useMemo } from 'react';
import { GanttData } from './Types';
import { getNonWorkingDays } from '../../../services/VacacionesServices';
import { generateInitialWorkingDays } from './UseDateHandlers';

export const useGanttData = () => {
  const [data, setData] = useState<GanttData | null>(null);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ OPTIMIZACIÓN: Función de fallback memoizada
  const generateFallbackWorkingDays = useMemo((): string[] => {
    const days: string[] = [];
    const today = new Date();
    
    // Generar 90 días a partir de hoy (solo días laborables)
    for (let i = 0; i < 90; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      
      const dayOfWeek = currentDate.getDay();
      // Solo días laborables (lunes a viernes)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = currentDate.toISOString().split("T")[0];
        days.push(dateStr);
      }
    }
    
    return days;
  }, []);

  // ✅ OPTIMIZACIÓN: Cargar datos solo una vez
  const fetchInitialData = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Cargar días no laborables desde la API
      const nonWorkingFromApi = await getNonWorkingDays();
      
      // Generar días laborables
      const initialWorkingDays = generateInitialWorkingDays(nonWorkingFromApi);
      
      // Establecer días laborables
      setWorkingDays(initialWorkingDays);

      // Inicializar estructura básica de datos
      const initialData = {
        workOrders: [],
        capacity: [],
        nonWorkingDays: nonWorkingFromApi || [],
      };

      setData(initialData);

    } catch (error) {
      // Fallback: generar días laborables básicos si falla la API
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

  // ✅ OPTIMIZACIÓN: Ejecutar carga inicial solo una vez
  useEffect(() => {
    fetchInitialData();
  }, []);

  return { 
    data, 
    setData, 
    workingDays, 
    setWorkingDays,
    isLoading,
    // Función para recargar días laborables si es necesario
    reloadWorkingDays: fetchInitialData
  };
};
