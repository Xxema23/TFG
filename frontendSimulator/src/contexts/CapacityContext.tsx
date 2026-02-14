import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { DailyCapacity, BaseCapacity, CapacityData } from '../interfaces/Capacity';
import { 
  getBaseCapacities, 
  getCapacities, 
  buildDailyCapacities 
} from '../services/capacityService';

interface CapacityContextType {
  dailyCapacities: DailyCapacity[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  workingDays: string[];
}

const CapacityContext = createContext<CapacityContextType | null>(null);

export const CapacityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dailyCapacities, setDailyCapacities] = useState<DailyCapacity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  
  const capacitiesRef = useRef<DailyCapacity[]>([]);
  const isLoadingRef = useRef(false);

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
          const dateStr = currentDate.toISOString().split("T")[0];
          allWorkingDays.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return allWorkingDays;
    };

    setWorkingDays(calculateWorkingDays());
  }, []);

  const loadCapacities = async () => {
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
        const yearCaps = await getCapacities(1, year);
        allWeeklyCapacities.push(...yearCaps);
      }

      const daily = buildDailyCapacities(
        baseCapacities,
        allWeeklyCapacities,
        workingDays
      );

      setDailyCapacities(daily);
      capacitiesRef.current = daily;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error cargando capacidades');
      setError(error);
      console.error('❌ [CapacityContext] Error cargando capacidades:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    if (workingDays.length > 0 && dailyCapacities.length === 0) {
      loadCapacities();
    }
  }, [workingDays.length]);

  const refresh = async () => {
    await loadCapacities();
  };

  const value: CapacityContextType = {
    dailyCapacities,
    isLoading,
    error,
    refresh,
    workingDays
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