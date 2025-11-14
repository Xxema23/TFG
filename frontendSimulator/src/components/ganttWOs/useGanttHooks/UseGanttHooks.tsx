import { useState, useEffect, useRef, useCallback } from "react";
import { useFabricacionesContext } from "../../../contexts/FabricacionesContext";
import { useGanttData } from "./UseGanttData";
import { useCapacityHandlers } from "./UseCapacityHandlers";
import { useWorkOrderHandlers } from "./UseWorkOrderHandlers";
import { DropInfo, GanttData } from "./Types";
import { CapacityData } from "../../../interfaces/Capacity";
import { IFabricacionConHoras } from "../../../interfaces/IFabricacionConHoras";
import DropMonitor from "../DropMonitor";

const DEFAULT_INITIAL_CAPACITY = 1000000;

// ✅ FUNCIÓN CORREGIDA: Recalcular fechas basándose en capacidad
const recalculateWorkOrderDates = (
  workOrders: IFabricacionConHoras[],
  capacity: any[],
  workingDays: string[]
): IFabricacionConHoras[] => {
  if (!workOrders.length || !capacity.length || !workingDays.length) {
    return workOrders;
  }

  console.log('🔄 [Recalcular Fechas] Inicio con', workOrders.length, 'WOs');

  // Agrupar por línea
  const wosByLine = new Map<string, IFabricacionConHoras[]>();
  workOrders.forEach(wo => {
    if (!wosByLine.has(wo.Linea)) {
      wosByLine.set(wo.Linea, []);
    }
    wosByLine.get(wo.Linea)!.push(wo);
  });

  const updatedWorkOrders: IFabricacionConHoras[] = [];

  wosByLine.forEach((lineWOs, line) => {
    // Crear mapa de capacidad por día
    const capacityByDay = new Map<string, number>();
    workingDays.forEach((day) => {
      const customCapacity = capacity.find((cap) => cap.date === day && (cap.line === line || cap.line === "*"))?.capacity;
      capacityByDay.set(day, customCapacity || DEFAULT_INITIAL_CAPACITY);
    });

    // Ordenar WOs por fecha y secuencia
    const sortedWOs = [...lineWOs].sort((a, b) => {
      const dateA = new Date(a.Fch_Objetivo).getTime();
      const dateB = new Date(b.Fch_Objetivo).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.Secuencia - b.Secuencia;
    });

    // Rastrear uso de capacidad por día
    const dayUsage = new Map<string, number>();
    workingDays.forEach(day => dayUsage.set(day, 0));

    sortedWOs.forEach((workOrder) => {
      const originalDate = workOrder.Fch_Objetivo;
      const woHours = Math.max(parseFloat(workOrder.horas_totales_de_la_wo || "0"), 0.5);
      
      // Buscar el día donde puede EMPEZAR esta WO
      let startDayIndex = workingDays.findIndex(d => d === originalDate);
      if (startDayIndex === -1) {
        startDayIndex = workingDays.findIndex(d => new Date(d) >= new Date(originalDate));
        if (startDayIndex === -1) startDayIndex = 0;
      }

      // ✅ CRÍTICO: Buscar el primer día con AL MENOS ALGO de capacidad
      let actualStartDay = originalDate;
      let foundCapacity = false;

      for (let i = startDayIndex; i < workingDays.length; i++) {
        const currentDay = workingDays[i];
        const dailyCapacity = capacityByDay.get(currentDay) || DEFAULT_INITIAL_CAPACITY;
        const usedCapacity = dayUsage.get(currentDay) || 0;
        const availableCapacity = dailyCapacity - usedCapacity;

        // Si hay AL MENOS algo de capacidad, la WO empieza aquí
        if (availableCapacity > 0) {
          actualStartDay = currentDay;
          foundCapacity = true;
          break;
        }
      }

      // Si no encontramos capacidad en ningún día, dejamos la fecha original
      if (!foundCapacity) {
        actualStartDay = originalDate;
      }

      // ✅ Ahora registrar el uso de capacidad de esta WO (puede ocupar múltiples días)
      let remainingHours = woHours;
      let currentDayIndex = workingDays.findIndex(d => d === actualStartDay);

      while (currentDayIndex < workingDays.length && remainingHours > 0) {
        const currentDay = workingDays[currentDayIndex];
        const dailyCapacity = capacityByDay.get(currentDay) || DEFAULT_INITIAL_CAPACITY;
        const usedCapacity = dayUsage.get(currentDay) || 0;
        const availableCapacity = dailyCapacity - usedCapacity;

        if (availableCapacity > 0) {
          const hoursForThisDay = Math.min(remainingHours, availableCapacity);
          dayUsage.set(currentDay, usedCapacity + hoursForThisDay);
          remainingHours -= hoursForThisDay;
        }

        currentDayIndex++;
      }

      const updatedWO = {
        ...workOrder,
        Fch_Objetivo: actualStartDay
      };

      if (actualStartDay !== originalDate) {
        console.log(`   📅 WO ${workOrder.NumWO}: ${originalDate} → ${actualStartDay} (no cabía en día original)`);
      }

      updatedWorkOrders.push(updatedWO);
    });
  });

  // Reordenar secuencias por día/línea
  const wosByDayLine = new Map<string, IFabricacionConHoras[]>();
  updatedWorkOrders.forEach(wo => {
    const key = `${wo.Fch_Objetivo}|${wo.Linea}`;
    if (!wosByDayLine.has(key)) {
      wosByDayLine.set(key, []);
    }
    wosByDayLine.get(key)!.push(wo);
  });

  const finalWorkOrders: IFabricacionConHoras[] = [];
  wosByDayLine.forEach((wos, key) => {
    const sorted = wos.sort((a, b) => a.Secuencia - b.Secuencia);
    const resequenced = sorted.map((wo, index) => ({
      ...wo,
      Secuencia: index + 1
    }));
    finalWorkOrders.push(...resequenced);
  });

  console.log('✅ [Recalcular Fechas] Completado');

  return finalWorkOrders;
};

export const useGanttHooks = () => {
  const { 
    fabricaciones: fabricacionesFromContext,
    onGanttOrdersChanged,
    onGanttOrderSaved,
    setHasPendingChanges,
    hasPendingChanges: contextHasPendingChanges,
    lastUpdated
  } = useFabricacionesContext();

  const { data, setData, workingDays, setWorkingDays } = useGanttData();
  const { 
    isCapacityModalOpen, 
    setIsCapacityModalOpen, 
    loadCapacitiesFromService, 
    handleSaveCapacity: originalHandleSaveCapacity,
    convertWeeklyToDaily
  } = useCapacityHandlers(workingDays, setData, data);
  
  const {
    selectedWOs,
    setSelectedWOs,
    draggedWOs,
    setDraggedWOs,
    pendingChanges,
    hasUnsavedChanges,
    isSaving,
    saveChanges: originalSaveChanges,
    discardChanges: originalDiscardChanges,
    handleWorkOrderDrop: originalHandleWorkOrderDrop,
    getWorkOrderCurrentState,
    applyCapacityChanges,
    reorderSequencesInDay
  } = useWorkOrderHandlers(data, setData, workingDays, convertWeeklyToDaily);

  const [zoomLevel, setZoomLevel] = useState(1);
  const dataRef = useRef<GanttData | null>(null);
  const workingDaysRef = useRef<string[]>([]);
  const isRecalculatingRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    workingDaysRef.current = workingDays;
  }, [workingDays]);

  // ✅ Sincronizar cambios del contexto (desde Detalle Equipos) y aplicar recálculo de capacidad
  useEffect(() => {
    if (fabricacionesFromContext.length > 0 && workingDays.length > 0 && !isRecalculatingRef.current) {
      console.log('🔄 [useGanttHooks] Sincronizando desde contexto...');
      
      const adjustedWorkOrders = fabricacionesFromContext.map((wo) => {
        const formattedDate = new Date(wo.Fch_Objetivo).toISOString().split("T")[0];
        if (!workingDays.includes(formattedDate)) {
          const newStartDay = workingDays.find(day => new Date(day) >= new Date(formattedDate)) || workingDays[0];
          return { ...wo, Fch_Objetivo: newStartDay };
        }
        return wo;
      });

      setData(prevData => {
        if (!prevData) {
          const uniqueLines = Array.from(new Set(adjustedWorkOrders.map(wo => wo.Linea)));
          const initialCapacity = [];
          for (const line of uniqueLines) {
            for (const date of workingDays) {
              initialCapacity.push({
                line,
                date,
                capacity: DEFAULT_INITIAL_CAPACITY,
              });
            }
          }
          
          return {
            workOrders: adjustedWorkOrders,
            capacity: initialCapacity,
            nonWorkingDays: []
          };
        }

        // ✅ CRÍTICO: SIEMPRE aplicar recálculo de capacidad
        console.log('⚡ Aplicando recálculo de capacidad...');
        isRecalculatingRef.current = true;
        
        const recalculatedWOs = recalculateWorkOrderDates(
          adjustedWorkOrders,
          prevData.capacity,
          workingDays
        );

        // Actualizar el contexto con las fechas recalculadas SOLO si hay cambios
        setTimeout(() => {
          // Verificar si hubo cambios reales
          const hasChanges = recalculatedWOs.some((wo, idx) => {
            const original = adjustedWorkOrders.find(a => a.NumWO === wo.NumWO);
            if (!original) return false;
            return wo.Fch_Objetivo !== original.Fch_Objetivo || wo.Secuencia !== original.Secuencia;
          });

          if (hasChanges) {
            console.log('📝 Hubo cambios en el recálculo, actualizando contexto');
            onGanttOrdersChanged(recalculatedWOs);
          } else {
            console.log('✅ No hubo cambios en el recálculo');
          }
          
          isRecalculatingRef.current = false;
        }, 100);

        return {
          ...prevData,
          workOrders: recalculatedWOs
        };
      });
    }
  }, [fabricacionesFromContext, workingDays, setData, onGanttOrdersChanged, lastUpdated]);

  const saveChanges = useCallback(async (): Promise<void> => {
    return Promise.resolve();
  }, []);

  const discardChanges = useCallback(async (): Promise<void> => {
    return Promise.resolve();
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(prev * 1.2, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(prev / 1.2, 0.5));
  }, []);

  const stableHandleWorkOrderDrop = useCallback(
    (info: DropInfo) => {
      originalHandleWorkOrderDrop(info.day, info.line, info.insertBeforeWO, info.draggedItems);
      
      setTimeout(() => {
        if (dataRef.current) {
          // ✅ Aplicar recálculo de capacidad después del drop en Gantt
          isRecalculatingRef.current = true;
          
          const recalculatedWOs = recalculateWorkOrderDates(
            dataRef.current.workOrders,
            dataRef.current.capacity,
            workingDaysRef.current
          );

          onGanttOrdersChanged(recalculatedWOs);
          
          setTimeout(() => {
            isRecalculatingRef.current = false;
          }, 100);
        }
      }, 200);
    },
    [originalHandleWorkOrderDrop, onGanttOrdersChanged]
  );

  const handleSaveCapacity = useCallback(
    async (
      capacities: CapacityData[], 
      deletions: { line: string; week: number; year: number }[] = []
    ): Promise<void> => {
      try {
        const result = await originalHandleSaveCapacity(capacities, deletions);
        
        if (!result.success) {
          return;
        }
        
        if (result.capacityChanges && result.capacityChanges.length > 0) {
          setTimeout(() => {
            applyCapacityChanges(result.capacityChanges);
            
            setTimeout(() => {
              if (dataRef.current) {
                isRecalculatingRef.current = true;
                
                const recalculatedWOs = recalculateWorkOrderDates(
                  dataRef.current.workOrders,
                  dataRef.current.capacity,
                  workingDaysRef.current
                );

                onGanttOrdersChanged(recalculatedWOs);
                
                setTimeout(() => {
                  isRecalculatingRef.current = false;
                }, 100);
              }
            }, 200);
          }, 100);
        }
        
      } catch (error) {
        throw error;
      }
    },
    [originalHandleSaveCapacity, applyCapacityChanges, onGanttOrdersChanged]
  );

  useEffect(() => {
    DropMonitor.registerDropHandler(stableHandleWorkOrderDrop);
    return () => {
      DropMonitor.unregisterDropHandler();
    };
  }, [stableHandleWorkOrderDrop]);

  useEffect(() => {
    if (workingDays.length > 0 && data?.workOrders) {
      loadCapacitiesFromService(1);
    }
  }, [workingDays.length, data?.workOrders?.length, loadCapacitiesFromService]);

  return {
    data,
    workingDays,
    isCapacityModalOpen,
    setIsCapacityModalOpen,
    handleSaveCapacity,
    zoomLevel,
    handleZoomIn,
    handleZoomOut,
    selectedWOs,
    setSelectedWOs,
    draggedWOs,
    setDraggedWOs,
    pendingChanges: new Map(),
    hasUnsavedChanges: false,
    saveChanges,
    discardChanges,
    isSaving,
    getWorkOrderCurrentState,
    loadCapacitiesFromService,
    applyCapacityChanges
  };
};