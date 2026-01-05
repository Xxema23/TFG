import { useState, useCallback } from "react";
import { Capacity, GanttData } from "./Types";
import { CapacityData } from "../../../interfaces/Capacity";
import { 
  saveCapacities, 
  getCapacities, 
  deleteCapacities, // ⬅️ Cambiado de deleteCapacity a deleteCapacities
  getBaseCapacities,
  buildDailyCapacities
} from "../../../services/capacityService"; // ⬅️ Cambiado de CapacityService a capacityService

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

  // ============================================
  // CONVERTIR CAPACIDADES SEMANALES A DIARIAS (LEGACY)
  // ============================================
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

  // ============================================
  // CARGAR CAPACIDADES CON LÓGICA HÍBRIDA
  // ============================================
  const loadCapacitiesFromService = useCallback(async (scenarioId: number = 1): Promise<void> => {
    try {
      console.log('🔄 [loadCapacitiesFromService] Cargando con lógica HÍBRIDA...');
      
      const currentYear = new Date().getFullYear();
      const years = [currentYear - 1, currentYear, currentYear + 1];
      
      // 1. Cargar capacidades BASE
      const baseCapacities = await getBaseCapacities(scenarioId);
      console.log(`✅ Capacidades BASE: ${baseCapacities.length}`);
      
      // 2. Cargar capacidades SEMANALES de múltiples años
      const allWeeklyCapacities = [];
      for (const year of years) {
        const yearCaps = await getCapacities(scenarioId, year);
        console.log(`✅ Capacidades año ${year}: ${yearCaps.length}`);
        allWeeklyCapacities.push(...yearCaps);
      }
      
      // 3. Si hay capacidades BASE, usar lógica híbrida
      if (baseCapacities.length > 0) {
        const dailyCapacities = buildDailyCapacities(
          baseCapacities,
          allWeeklyCapacities,
          workingDays
        );
        
        console.log(`✅ Capacidades diarias (híbrido): ${dailyCapacities.length}`);
        
        setData(prevData => {
          if (!prevData) return null;
          return {
            ...prevData,
            capacity: dailyCapacities
          };
        });
      } 
      // 4. Si NO hay capacidades BASE, usar lógica legacy (solo semanales)
      else if (allWeeklyCapacities.length > 0) {
        console.log('⚠️ No hay capacidades BASE, usando solo semanales (legacy)');
        const dailyCapacities = convertWeeklyToDaily(allWeeklyCapacities, workingDays);
        
        setData(prevData => {
          if (!prevData) return null;
          return {
            ...prevData,
            capacity: dailyCapacities
          };
        });
      }
    } catch (error) {
      console.error("❌ Error al cargar capacidades:", error);
    }
  }, [convertWeeklyToDaily, workingDays, setData]);

  // ============================================
  // GUARDAR CAPACIDADES (SOLO SEMANALES)
  // ============================================
  const handleSaveCapacity = useCallback(
    async (
      capacities: CapacityData[], 
      deletions: { line: string; week: number; year: number }[] = []
    ): Promise<{
      success: boolean;
      capacityChanges: CapacityData[];
    }> => {
      try {
        let saveResult = { success: true };
        let deleteResult = { success: true };

        // Guardar capacidades SEMANALES
        if (capacities.length > 0) {
          saveResult = await saveCapacities(1, capacities);
        }

        // Eliminar capacidades SEMANALES (batch)
        if (deletions.length > 0) {
          deleteResult = await deleteCapacities(1, deletions);
        }

        if (saveResult.success && deleteResult.success) {
          // Recargar capacidades con lógica híbrida
          await loadCapacitiesFromService(1);
          
          setIsCapacityModalOpen(false);
          
          const totalOperations = capacities.length + deletions.length;
          console.log(`✅ Se procesaron ${totalOperations} cambio(s) de capacidad correctamente.`);
          
          return {
            success: true,
            capacityChanges: capacities
          };
        } else {
          console.error("❌ Error en las operaciones:", { saveResult, deleteResult });
          return {
            success: false,
            capacityChanges: []
          };
        }
      } catch (error) {
        console.error("❌ Error al procesar capacidades:", error);
        return {
          success: false,
          capacityChanges: []
        };
      }
    },
    [loadCapacitiesFromService]
  );

  return {
    isCapacityModalOpen,
    setIsCapacityModalOpen,
    loadCapacitiesFromService,
    handleSaveCapacity,
    convertWeeklyToDaily
  };
};