import { useState, useEffect, useRef, useCallback } from "react";
import { useFabricacionesContext } from "../../../contexts/FabricacionesContext";
import { useGanttData } from "./UseGanttData";
import { useCapacityHandlers } from "./UseCapacityHandlers";
import { useWorkOrderHandlers } from "./UseWorkOrderHandlers";
import { DropInfo, GanttData } from "./Types";
import { CapacityData } from "../../../interfaces/Capacity";
import { IFabricacionConHoras } from "../../../interfaces/IFabricacionConHoras";
import DropMonitor from "../DropMonitor";

const DEBUG_MODE = false;

export const DEFAULT_INITIAL_CAPACITY = 1000000;

export const getWeekNumber = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.ceil((target.getTime() - firstThursday.getTime()) / 604800000);
};

export const recalculateAffectedWorkOrders = (
  workOrders: IFabricacionConHoras[],
  capacity: any[],
  workingDays: string[],
  affectedCapacities: CapacityData[]
): IFabricacionConHoras[] => {
  if (!workOrders.length || !capacity.length || !workingDays.length || !affectedCapacities.length) {
    if (DEBUG_MODE) console.warn('⚠️ [recalculateAffectedWorkOrders] Datos insuficientes');
    return workOrders;
  }

  const affectedLinesWeeks = new Set<string>();
  affectedCapacities.forEach(cap => {
    affectedLinesWeeks.add(`${cap.line}-${cap.week}-${cap.year}`);
  });

  const affectedWOs: IFabricacionConHoras[] = [];
  const unaffectedWOs: IFabricacionConHoras[] = [];

  workOrders.forEach(wo => {
    const woDate = new Date(wo.Fch_Objetivo);
    const woYear = woDate.getFullYear();
    const woWeek = getWeekNumber(woDate);
    const key = `${wo.Linea}-${woWeek}-${woYear}`;
    
    if (affectedLinesWeeks.has(key)) {
      affectedWOs.push(wo);
    } else {
      unaffectedWOs.push(wo);
    }
  });

  if (affectedWOs.length === 0) {
    return workOrders;
  }

  const wosByLine = new Map<string, IFabricacionConHoras[]>();
  affectedWOs.forEach(wo => {
    if (!wosByLine.has(wo.Linea)) {
      wosByLine.set(wo.Linea, []);
    }
    wosByLine.get(wo.Linea)!.push(wo);
  });

  const recalculatedWOs: IFabricacionConHoras[] = [];

  wosByLine.forEach((lineWOs, line) => {
    const capacityByDay = new Map<string, number>();
    workingDays.forEach((day) => {
      const customCapacity = capacity.find((cap) => 
        cap.date === day && (cap.line === line || cap.line === "*")
      )?.capacity;
      capacityByDay.set(day, customCapacity || DEFAULT_INITIAL_CAPACITY);
    });

    const sortedWOs = [...lineWOs].sort((a, b) => {
      const dateA = new Date(a.Fch_Objetivo).getTime();
      const dateB = new Date(b.Fch_Objetivo).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.Secuencia - b.Secuencia;
    });

    const dayUsage = new Map<string, number>();
    workingDays.forEach(day => dayUsage.set(day, 0));

    const wosWithNewDates: Array<{ wo: IFabricacionConHoras; newDate: string }> = [];

    sortedWOs.forEach((workOrder) => {
      const originalDate = workOrder.Fch_Objetivo.split('T')[0];
      const woHours = Math.max(parseFloat(workOrder.horas_totales_de_la_wo || "0"), 0.5);
      
      let startDayIndex = workingDays.findIndex(d => d === originalDate);
      if (startDayIndex === -1) {
        startDayIndex = workingDays.findIndex(d => new Date(d) >= new Date(originalDate));
        if (startDayIndex === -1) startDayIndex = 0;
      }

      let actualStartDay = originalDate;
      let foundCapacity = false;

      for (let i = startDayIndex; i < workingDays.length; i++) {
        const currentDay = workingDays[i];
        const dailyCapacity = capacityByDay.get(currentDay) || DEFAULT_INITIAL_CAPACITY;
        const usedCapacity = dayUsage.get(currentDay) || 0;
        const availableCapacity = dailyCapacity - usedCapacity;

        if (availableCapacity > 0) {
          actualStartDay = currentDay;
          foundCapacity = true;
          break;
        }
      }

      if (!foundCapacity) {
        actualStartDay = originalDate;
      }

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

      wosWithNewDates.push({
        wo: workOrder,
        newDate: actualStartDay
      });
    });

    const wosByDay = new Map<string, IFabricacionConHoras[]>();
    
    wosWithNewDates.forEach(({ wo, newDate }) => {
      if (!wosByDay.has(newDate)) {
        wosByDay.set(newDate, []);
      }
      wosByDay.get(newDate)!.push({
        ...wo,
        Fch_Objetivo: newDate
      });
    });

    wosByDay.forEach((wos, day) => {
      const orderedWOs = wos.sort((a, b) => a.Secuencia - b.Secuencia);
      const resequenced = orderedWOs.map((wo, index) => ({
        ...wo,
        Secuencia: index + 1
      }));
      wosByDay.set(day, resequenced);
    });

    const lineRecalculated: IFabricacionConHoras[] = [];
    wosByDay.forEach(wos => {
      lineRecalculated.push(...wos);
    });
    
    if (lineRecalculated.length !== lineWOs.length) {
      console.error(`❌ PÉRDIDA DE WOs EN LÍNEA ${line}!`, {
        entrada: lineWOs.length,
        salida: lineRecalculated.length
      });
      
      recalculatedWOs.push(...lineWOs);
      return;
    }
    
    recalculatedWOs.push(...lineRecalculated);
  });

  const allWorkOrders = [...unaffectedWOs, ...recalculatedWOs];

  if (allWorkOrders.length !== workOrders.length) {
    console.error('❌ CRÍTICO: SE PERDIERON WOs EN EL RECÁLCULO!', {
      entrada: workOrders.length,
      salida: allWorkOrders.length
    });
    return workOrders;
  }

  return allWorkOrders;
};

export const useGanttHooks = (filteredWorkOrders?: IFabricacionConHoras[]) => {
  const { 
    fabricaciones: fabricacionesFromContext,
    onGanttOrdersChanged,
    onGanttOrderSaved,
    setHasPendingChanges,
    hasPendingChanges: contextHasPendingChanges,
    lastUpdated,
    refetch
  } = useFabricacionesContext();

  const { data, setData, workingDays, setWorkingDays } = useGanttData();
  const { 
    isCapacityModalOpen, 
    setIsCapacityModalOpen, 
    loadCapacitiesFromService, 
    handleSaveCapacity: originalHandleSaveCapacity,
    convertWeeklyToDaily
  } = useCapacityHandlers(workingDays, setData, data);
  
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isCapacityReady, setIsCapacityReady] = useState(false);
  
  const dataRef = useRef<GanttData | null>(null);
  const workingDaysRef = useRef<string[]>([]);
  const isRecalculatingRef = useRef(false);
  const lastSyncTimestampRef = useRef<number>(0);
  const isHandlingCapacityChangeRef = useRef(false);
  const hasLoadedCapacityRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    workingDaysRef.current = workingDays;
  }, [workingDays]);

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
  } = useWorkOrderHandlers(data, setData, workingDays, convertWeeklyToDaily, dataRef);

  useEffect(() => {
    if (isRecalculatingRef.current || isHandlingCapacityChangeRef.current) {
      return;
    }

    const dataSource = filteredWorkOrders && filteredWorkOrders.length > 0 
      ? filteredWorkOrders 
      : fabricacionesFromContext;

    if (dataSource.length > 0 && workingDays.length > 0) {
      const now = Date.now();
      if (now - lastSyncTimestampRef.current < 100) {
        return;
      }
      
      lastSyncTimestampRef.current = now;
      
      const adjustedWorkOrders = dataSource.map((wo) => {
        const formattedDate = new Date(wo.Fch_Objetivo).toISOString().split("T")[0];
        if (!workingDays.includes(formattedDate)) {
          const newStartDay = workingDays.find(day => new Date(day) >= new Date(formattedDate)) || workingDays[0];
          return { ...wo, Fch_Objetivo: newStartDay };
        }
        return wo;
      });

      setData(prevData => {
        if (!prevData) {
          return {
            workOrders: adjustedWorkOrders,
            capacity: [],
            nonWorkingDays: []
          };
        }

        return {
          ...prevData,
          workOrders: adjustedWorkOrders,
          capacity: prevData.capacity
        };
      });
    }
  }, [fabricacionesFromContext, workingDays, setData, lastUpdated, filteredWorkOrders]);

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

  const redistributeWithCapacity = useCallback(
    (
      workOrders: IFabricacionConHoras[],
      targetLine: string,
      startingDay: string
    ): IFabricacionConHoras[] => {
      if (!dataRef.current?.capacity || dataRef.current.capacity.length === 0) {
        if (DEBUG_MODE) console.warn('⚠️ No hay capacity configurada');
        return workOrders;
      }

      const lineWOs = workOrders.filter(wo => wo.Linea === targetLine);
      const otherWOs = workOrders.filter(wo => wo.Linea !== targetLine);

      if (lineWOs.length === 0) {
        return workOrders;
      }

      const wosBeforeDrop: IFabricacionConHoras[] = [];
      const wosFromDrop: IFabricacionConHoras[] = [];
      
      lineWOs.forEach(wo => {
        const woDay = wo.Fch_Objetivo.split('T')[0];
        if (new Date(woDay) < new Date(startingDay)) {
          wosBeforeDrop.push(wo);
        } else {
          wosFromDrop.push(wo);
        }
      });

      const sortedLineWOs = [...wosFromDrop].sort((a, b) => {
        const dateA = new Date(a.Fch_Objetivo).getTime();
        const dateB = new Date(b.Fch_Objetivo).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.Secuencia - b.Secuencia;
      });

      const capacityByDay = new Map<string, number>();
      workingDaysRef.current.forEach(day => {
        const dayCapacity = dataRef.current!.capacity.find(
          c => c.date === day && (c.line === targetLine || c.line === "*")
        );
        capacityByDay.set(day, dayCapacity?.capacity || DEFAULT_INITIAL_CAPACITY);
      });

      const dayUsage = new Map<string, number>();
      workingDaysRef.current.forEach(day => dayUsage.set(day, 0));
      
      wosBeforeDrop.forEach(wo => {
        const woDay = wo.Fch_Objetivo.split('T')[0];
        const woHours = Math.max(parseFloat(wo.horas_totales_de_la_wo || "0"), 0.5);
        const currentUsage = dayUsage.get(woDay) || 0;
        dayUsage.set(woDay, currentUsage + woHours);
      });

      const redistributed: IFabricacionConHoras[] = [];

      let currentDayIndex = workingDaysRef.current.findIndex(d => d === startingDay);
      if (currentDayIndex === -1) {
        currentDayIndex = 0;
      }

      for (const wo of sortedLineWOs) {
        const woHours = Math.max(parseFloat(wo.horas_totales_de_la_wo || "0"), 0.5);
        let remainingHours = woHours;
        let assignedDay: string | null = null;

        let searchIndex = currentDayIndex;
        while (searchIndex < workingDaysRef.current.length && remainingHours > 0) {
          const day = workingDaysRef.current[searchIndex];
          const dayCapacity = capacityByDay.get(day) || DEFAULT_INITIAL_CAPACITY;
          const dayUsed = dayUsage.get(day) || 0;
          const availableCapacity = dayCapacity - dayUsed;

          if (availableCapacity > 0.01) {
            if (!assignedDay) {
              assignedDay = day;
            }

            const hoursToUse = Math.min(remainingHours, availableCapacity);
            dayUsage.set(day, dayUsed + hoursToUse);
            remainingHours -= hoursToUse;
          }

          searchIndex++;
        }

        if (!assignedDay) {
          assignedDay = workingDaysRef.current[workingDaysRef.current.length - 1] || startingDay;
          if (DEBUG_MODE) console.warn(`⚠️ WO ${wo.NumWO} forzada a ${assignedDay}`);
        }

        redistributed.push({
          ...wo,
          Fch_Objetivo: assignedDay
        });

        const currentDay = workingDaysRef.current[currentDayIndex];
        const currentDayCapacity = capacityByDay.get(currentDay) || DEFAULT_INITIAL_CAPACITY;
        const currentDayUsed = dayUsage.get(currentDay) || 0;
        
        if (currentDayUsed >= currentDayCapacity - 0.01) {
          currentDayIndex++;
        }
      }

      const wosByDay = new Map<string, IFabricacionConHoras[]>();
      redistributed.forEach(wo => {
        const day = wo.Fch_Objetivo.split('T')[0];
        if (!wosByDay.has(day)) {
          wosByDay.set(day, []);
        }
        wosByDay.get(day)!.push(wo);
      });

      const finalWOs: IFabricacionConHoras[] = [];
      wosByDay.forEach((wos) => {
        const resequenced = wos.map((wo, index) => ({
          ...wo,
          Secuencia: index + 1
        }));
        finalWOs.push(...resequenced);
      });

      return [...otherWOs, ...wosBeforeDrop, ...finalWOs];
    },
    []
  );

  const stableHandleWorkOrderDrop = useCallback(
    (info: DropInfo) => {
      let correctedDay = info.day;
      
      if (info.insertBeforeWO && dataRef.current) {
        const referenceWO = dataRef.current.workOrders.find(
          wo => wo.NumWO === info.insertBeforeWO
        );
        
        if (referenceWO) {
          correctedDay = referenceWO.Fch_Objetivo.split('T')[0];
        }
      }
      
      originalHandleWorkOrderDrop(correctedDay, info.line, info.insertBeforeWO, info.draggedItems);
      
      setTimeout(() => {
        if (dataRef.current && dataRef.current.workOrders.length > 0) {
          const redistributedWOs = redistributeWithCapacity(
            dataRef.current.workOrders,
            info.line,
            correctedDay
          );
          
          onGanttOrdersChanged(redistributedWOs);
        } else {
          console.error('❌ dataRef.current vacío');
        }
      }, 100);
    },
    [originalHandleWorkOrderDrop, onGanttOrdersChanged, redistributeWithCapacity]
  );

  const handleSaveCapacity = useCallback(
    async (
      capacities: CapacityData[], 
      deletions: { line: string; week: number; year: number }[] = []
    ): Promise<void> => {
      try {
        isHandlingCapacityChangeRef.current = true;
        hasLoadedCapacityRef.current = false;
        
        const result = await originalHandleSaveCapacity(capacities, deletions);
        
        if (!result.success) {
          isHandlingCapacityChangeRef.current = false;
          return;
        }
        
        try {
          await refetch();
          
          const { 
            getBaseCapacities, 
            getCapacities, 
            buildDailyCapacities 
          } = await import('../../../services/capacityService');
          
          const currentYear = new Date().getFullYear();
          const years = [currentYear - 1, currentYear, currentYear + 1];
          
          const baseCapacities = await getBaseCapacities(1);
          
          const allWeeklyCapacities = [];
          for (const year of years) {
            const yearCaps = await getCapacities(1, year);
            allWeeklyCapacities.push(...yearCaps);
          }
          
          const extendedWorkingDays: string[] = [];
          const today = new Date();
          const startDate = new Date(today);
          startDate.setDate(today.getDate() - 7);
          const endDate = new Date(today);
          endDate.setDate(today.getDate() + 120);

          let currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              const dateStr = currentDate.toISOString().split("T")[0];
              extendedWorkingDays.push(dateStr);
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          const dailyCapacities = buildDailyCapacities(
            baseCapacities,
            allWeeklyCapacities,
            extendedWorkingDays
          );
          
          if (dataRef.current) {
            dataRef.current = {
              ...dataRef.current,
              capacity: [...dailyCapacities]
            };
          }
          
          setData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              capacity: [...dailyCapacities]
            };
          });
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          if (dataRef.current && dataRef.current.workOrders && dataRef.current.capacity && dataRef.current.capacity.length > 0) {
            const recalculatedWOs = recalculateAffectedWorkOrders(
              dataRef.current.workOrders,
              dataRef.current.capacity,
              extendedWorkingDays,
              capacities
            );
            
            if (recalculatedWOs.length === dataRef.current.workOrders.length) {
              onGanttOrdersChanged(recalculatedWOs);
            } else {
              console.error('❌ Error en recálculo: número de WOs no coincide');
            }
          } else {
            console.error('❌ dataRef.current sin datos para recalcular');
          }
          
          setTimeout(() => {
            isHandlingCapacityChangeRef.current = false;
          }, 500);
          
        } catch (refetchError) {
          console.error('❌ Error al recargar datos:', refetchError);
          isHandlingCapacityChangeRef.current = false;
          alert('⚠️ Capacity guardada, pero hubo un error al recargar. Por favor, refresca la página.');
        }
        
      } catch (error) {
        console.error('❌ Error guardando capacidad:', error);
        isHandlingCapacityChangeRef.current = false;
        throw error;
      }
    },
    [originalHandleSaveCapacity, refetch, onGanttOrdersChanged, setData]
  );

  useEffect(() => {
    DropMonitor.registerDropHandler(stableHandleWorkOrderDrop);
    return () => {
      DropMonitor.unregisterDropHandler();
    };
  }, [stableHandleWorkOrderDrop]);

  useEffect(() => {
    if (
      workingDays.length > 0 && 
      data?.workOrders && 
      !isHandlingCapacityChangeRef.current &&
      !hasLoadedCapacityRef.current
    ) {
      hasLoadedCapacityRef.current = true;
      
      loadCapacitiesFromService(1).then(() => {
        setIsCapacityReady(true);
      });
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
    applyCapacityChanges,
    isCapacityReady
  };
};