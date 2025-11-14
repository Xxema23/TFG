import { useState, useCallback } from "react";
import { Capacity, GanttData } from "./Types";
import { CapacityData } from "../../../interfaces/Capacity";
import { saveCapacities, getCapacities, deleteCapacity } from "../../../services/CapacityService";

const DEFAULT_INITIAL_CAPACITY = 1000000;

const getWeekNumber = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.ceil((target.getTime() - firstThursday.getTime()) / 604800000);
};

export const useCapacityHandlers = (
  workingDays: string[],
  setData: (data: GanttData | null | ((prevData: GanttData | null) => GanttData | null)) => void,
  data: GanttData | null
) => {
  const [isCapacityModalOpen, setIsCapacityModalOpen] = useState(false);

  const convertWeeklyToDaily = useCallback(
    (weeklyCapacities: CapacityData[], workingDaysArray: string[]): Capacity[] => {
      const dailyCapacities: Capacity[] = [];
      const capacityMap = new Map<string, number>();

      weeklyCapacities.forEach(capacity => {
        const key = `${capacity.line}-${capacity.week}-${capacity.year}`;
        capacityMap.set(key, capacity.value);
      });

      const allLines = Array.from(new Set([
        ...weeklyCapacities.map(c => c.line),
        ...(data?.workOrders.map(wo => wo.Linea) || [])
      ]));

      workingDaysArray.forEach(day => {
        const date = new Date(day);
        const year = date.getFullYear();
        const week = getWeekNumber(date);

        allLines.forEach(line => {
          const key = `${line}-${week}-${year}`;
          const weeklyCapacity = capacityMap.get(key);
          
          const dailyCapacity = weeklyCapacity !== undefined 
            ? weeklyCapacity 
            : DEFAULT_INITIAL_CAPACITY;

          dailyCapacities.push({
            line,
            date: day,
            capacity: dailyCapacity
          });
        });
      });

      return dailyCapacities;
    },
    [data]
  );

  const loadCapacitiesFromService = useCallback(async (scenarioId: number = 1): Promise<void> => {
    try {
      const currentYear = new Date().getFullYear();
      const capacities = await getCapacities(scenarioId, currentYear);
      
      if (capacities.length > 0) {
        const dailyCapacities = convertWeeklyToDaily(capacities, workingDays);
        
        setData(prevData => {
          if (!prevData) return null;
          return {
            ...prevData,
            capacity: dailyCapacities
          };
        });
      }
    } catch (error) {
      console.error("Error al cargar capacidades:", error);
    }
  }, [convertWeeklyToDaily, workingDays, setData]);

  const handleSaveCapacity = useCallback(
    async (capacities: CapacityData[], deletions: { line: string; week: number; year: number }[] = []): Promise<{
      success: boolean;
      capacityChanges: CapacityData[];
    }> => {
      try {
        let saveResult = { success: true };
        let deleteResults: any[] = [];

        if (capacities.length > 0) {
          saveResult = await saveCapacities(1, capacities);
        }

        if (deletions.length > 0) {
          deleteResults = await Promise.all(
            deletions.map(deletion => 
              deleteCapacity(1, deletion.line, deletion.week, deletion.year)
            )
          );
        }

        const deleteErrors = deleteResults.filter(result => !result.success);
        
        if (saveResult.success && deleteErrors.length === 0) {
          const allCapacities = [...capacities];
          const dailyCapacities = convertWeeklyToDaily(allCapacities, workingDays);
          
          setData(prevData => {
            if (!prevData) return null;
            
            const capacitiesToRemove = new Set<string>();
            deletions.forEach(deletion => {
              workingDays.forEach(day => {
                const date = new Date(day);
                const year = date.getFullYear();
                const week = getWeekNumber(date);
                if (deletion.week === week && deletion.year === year) {
                  capacitiesToRemove.add(`${deletion.line}-${day}`);
                }
              });
            });

            const existingCapacities = prevData.capacity.filter(cap => {
              const shouldRemove = capacitiesToRemove.has(`${cap.line}-${cap.date}`);
              const isBeingUpdated = capacities.some(newCap => {
                const date = new Date(cap.date);
                const year = date.getFullYear();
                const week = getWeekNumber(date);
                return newCap.line === cap.line && newCap.week === week && newCap.year === year;
              });
              return !shouldRemove && !isBeingUpdated;
            });
            
            const restoredCapacities: Capacity[] = Array.from(capacitiesToRemove).map(key => {
              const [line, date] = key.split('-');
              return {
                line,
                date,
                capacity: DEFAULT_INITIAL_CAPACITY
              };
            });
            
            return {
              ...prevData,
              capacity: [...existingCapacities, ...dailyCapacities, ...restoredCapacities]
            };
          });
          
          setIsCapacityModalOpen(false);
          
          const totalOperations = capacities.length + deletions.length;
          console.log(`✅ Se procesaron ${totalOperations} cambio(s) de capacidad correctamente.`);
          
          return {
            success: true,
            capacityChanges: allCapacities
          };
        } else {
          console.error("Error en las operaciones:", { saveResult, deleteErrors });
          return {
            success: false,
            capacityChanges: []
          };
        }
      } catch (error) {
        console.error("Error al procesar capacidades:", error);
        return {
          success: false,
          capacityChanges: []
        };
      }
    },
    [convertWeeklyToDaily, workingDays, setData]
  );

  return {
    isCapacityModalOpen,
    setIsCapacityModalOpen,
    loadCapacitiesFromService,
    handleSaveCapacity,
    convertWeeklyToDaily
  };
};