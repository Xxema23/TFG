import { useState, useEffect, useRef, useCallback } from "react";
import { useGanttData } from "./UseGanttData";
import { useCapacityHandlers } from "./UseCapacityHandlers";
import { useWorkOrderHandlers } from "./UseWorkOrderHandlers";
import { DropInfo, GanttData } from "./Types";
import { CapacityData } from "../../../interfaces/Capacity";
import { IFabricacionConHoras } from "../../../interfaces/IFabricacionConHoras";
import DropMonitor from "../DropMonitor";
import { useCapacity } from '../../../contexts/CapacityContext';
import { useFabricacionesData, useFabricacionesActions } from '../../../contexts/FabricacionesContext';


export const DEFAULT_INITIAL_CAPACITY = 1000000;

const normalizeDate = (date: string): string => {
  return date.replace(' ', 'T').split('T')[0];
};

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
    lastUpdated
  } = useFabricacionesData();

  const {
    onGanttOrdersChanged,
  } = useFabricacionesActions();

  const { 
    dailyCapacities: capacitiesFromContext,
    workingDays: workingDaysFromContext,
    registerRecalculateCallback
  } = useCapacity();

  const { data, setData } = useGanttData('shared');
  const workingDays = workingDaysFromContext;
  const { 
    loadCapacitiesFromService, 
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
  const capacitiesFromContextRef = useRef<typeof capacitiesFromContext>([]);
  const workingDaysFromContextRef = useRef<typeof workingDaysFromContext>([]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    workingDaysRef.current = workingDays;
  }, [workingDays]);

  useEffect(() => {
    capacitiesFromContextRef.current = capacitiesFromContext;
  }, [capacitiesFromContext]);

  useEffect(() => {
    workingDaysFromContextRef.current = workingDaysFromContext;
  }, [workingDaysFromContext]);

  const {
    selectedWOs,
    setSelectedWOs,
    draggedWOs,
    setDraggedWOs,
    pendingChanges,
    hasUnsavedChanges,
    isSaving,
    getWorkOrderCurrentState,
    applyCapacityChanges,
  } = useWorkOrderHandlers(data, setData, workingDays, convertWeeklyToDaily, dataRef);

  useEffect(() => {
    if (isRecalculatingRef.current || isHandlingCapacityChangeRef.current) {
      return;
    }

    const dataSource = filteredWorkOrders && filteredWorkOrders.length > 0 
      ? filteredWorkOrders 
      : fabricacionesFromContext;

    if (dataSource.length === 0 || workingDays.length === 0) {
      return;
    }

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
      if (prevData && prevData.workOrders && prevData.workOrders.length > 0) {
        return {
          ...prevData,
          workOrders: adjustedWorkOrders,
        };
      }

      return {
        workOrders: adjustedWorkOrders,
        capacity: [],
        nonWorkingDays: []
      };
    });
  }, [
    fabricacionesFromContext,
    fabricacionesFromContext.length,
    workingDays,
    workingDays.length,
    setData,
    lastUpdated,
    filteredWorkOrders
  ]);

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
      // ── Determinar día y línea destino ────────────────────────────────────
      let targetDay: string;
      let targetLine: string = info.line;

      if (info.insertBeforeWO === undefined) {
        if (!info.day) {
          console.error('❌ Drop sin target y sin día');
          return;
        }
        targetDay = info.day;
      } else {
        const targetWO = dataRef.current?.workOrders.find(wo => wo.NumWO === info.insertBeforeWO);
        if (!targetWO) {
          console.error('❌ Target no encontrado');
          return;
        }
        targetDay = normalizeDate(targetWO.Fch_Objetivo);
      }

      const draggedWOs = info.draggedItems
        .map(numWO => dataRef.current?.workOrders.find(wo => wo.NumWO === numWO))
        .filter(Boolean);

      if (draggedWOs.length === 0) {
        console.error('❌ No se encontraron WOs arrastradas');
        return;
      }

      const draggedUpdated = draggedWOs.map(wo => ({
        ...wo!,
        Fch_Objetivo: targetDay,
        Linea: targetLine
      }));

      const existingInTarget = dataRef.current!.workOrders
        .filter(wo => 
          normalizeDate(wo.Fch_Objetivo) === targetDay &&
          wo.Linea === targetLine &&
          !info.draggedItems.includes(wo.NumWO)
        )
        .sort((a, b) => a.Secuencia - b.Secuencia);

      const targetIdx = info.insertBeforeWO === undefined
        ? existingInTarget.length
        : existingInTarget.findIndex(wo => wo.NumWO === info.insertBeforeWO);

      if (targetIdx === -1) {
        console.error('❌ Target no encontrado en WOs del día');
        return;
      }

      const reordered = [
        ...existingInTarget.slice(0, targetIdx),
        ...draggedUpdated,
        ...existingInTarget.slice(targetIdx)
      ];

      const resequenced = reordered.map((wo, i) => ({ ...wo, Secuencia: i + 1 }));

      const originalLocations = new Set<string>();
      draggedWOs.forEach(wo => {
        const originalDay = normalizeDate(wo!.Fch_Objetivo);
        const originalLine = wo!.Linea;
        if (originalDay !== targetDay || originalLine !== targetLine) {
          originalLocations.add(`${originalDay}|${originalLine}`);
        }
      });

      let allWOs = dataRef.current!.workOrders.filter(wo => {
        if (info.draggedItems.includes(wo.NumWO)) return false;
        if (normalizeDate(wo.Fch_Objetivo) === targetDay && wo.Linea === targetLine) return false;
        return true;
      });

      allWOs.push(...resequenced);

      originalLocations.forEach(locationKey => {
        const [day, line] = locationKey.split('|');
        const wosInOriginal = allWOs
          .filter(wo => normalizeDate(wo.Fch_Objetivo) === day && wo.Linea === line)
          .sort((a, b) => a.Secuencia - b.Secuencia);
        
        const reseq = wosInOriginal.map((wo, i) => ({ ...wo, Secuencia: i + 1 }));
        allWOs = allWOs.map(wo => reseq.find(r => r.NumWO === wo.NumWO) || wo);
      });

      let finalWOs = allWOs;

      if (dataRef.current?.capacity && dataRef.current.capacity.length > 0 && workingDaysRef.current.length > 0) {
        const dropDate = normalizeDate(targetDay);
        const draggedSet = new Set(info.draggedItems);
        
        const affectedDays = new Set<string>();
        affectedDays.add(dropDate);
        originalLocations.forEach(loc => {
          const [day] = loc.split('|');
          affectedDays.add(normalizeDate(day));
        });
        
        const minAffectedDay = Array.from(affectedDays).sort()[0];
        
        const wosBeforeAffected = allWOs.filter(wo => {
          if (wo.Linea !== targetLine) return true;
          return normalizeDate(wo.Fch_Objetivo) < minAffectedDay;
        });
        
        const wosToRedistribute = allWOs
          .filter(wo => {
            if (wo.Linea !== targetLine) return false;
            return normalizeDate(wo.Fch_Objetivo) >= minAffectedDay;
          })
          .sort((a, b) => {
            const dateCompare =
              new Date(normalizeDate(a.Fch_Objetivo)).getTime() -
              new Date(normalizeDate(b.Fch_Objetivo)).getTime();
            if (dateCompare !== 0) return dateCompare;
              return a.Secuencia - b.Secuencia;
          });
        
        const capacityByDay = new Map<string, number>();
        const dayUsage = new Map<string, number>();
        
        workingDaysRef.current.forEach(day => {
          const dayCapacity = dataRef.current!.capacity.find(
            c => c.date === day && c.line === targetLine
          );
          const fallback = dataRef.current!.capacity.find(
            c => c.line === targetLine
          )?.capacity || 8;
          capacityByDay.set(day, dayCapacity?.capacity || fallback);
          dayUsage.set(day, 0);
        });
        
        wosBeforeAffected.forEach(wo => {
          if (wo.Linea !== targetLine) return;
          const woDate = normalizeDate(wo.Fch_Objetivo);
          if (workingDaysRef.current.includes(woDate)) {
            const woHours = parseFloat(wo.horas_totales_de_la_wo) || 0;
            const currentUsage = dayUsage.get(woDate) || 0;
            dayUsage.set(woDate, currentUsage + woHours);
          }
        });
        
        const redistributed: typeof wosToRedistribute = [];
        
        wosToRedistribute.forEach((wo, idx) => {
          const woHours = parseFloat(wo.horas_totales_de_la_wo) || 0;
          let remainingHours = woHours;
          let assignedToDay: string | null = null;
          
          // Arrastradas arrancan siempre desde dropDate.
          // Existentes arrancan desde su fecha actual (ya están en el día correcto
          // después de la inserción visual; solo se empujan si no caben).
          const originalWODate = normalizeDate(wo.Fch_Objetivo);
          const startDay = draggedSet.has(wo.NumWO) ? dropDate : originalWODate;
          
          let dayIndex = workingDaysRef.current.findIndex(d => d === startDay);
          if (dayIndex === -1) dayIndex = 0;
          
          while (dayIndex < workingDaysRef.current.length && remainingHours > 0) {
            const currentDay = workingDaysRef.current[dayIndex];
            const dayCapacity = capacityByDay.get(currentDay) || 8;
            const dayUsed = dayUsage.get(currentDay) || 0;
            const availableCapacity = dayCapacity - dayUsed;
            
            if (availableCapacity > 0.01) {
              if (!assignedToDay) assignedToDay = currentDay;
              const hoursToUse = Math.min(remainingHours, availableCapacity);
              dayUsage.set(currentDay, dayUsed + hoursToUse);
              remainingHours -= hoursToUse;
              if (remainingHours <= 0.01) break;
            }
            dayIndex++;
          }
          
          if (assignedToDay) {
            redistributed.push({
              ...wo,
              Fch_Objetivo: assignedToDay,
              Secuencia: idx + 1
            });
          } else {
            redistributed.push({ ...wo, Secuencia: idx + 1 });
          }
        });
        
        const redistributedByDay = new Map<string, typeof redistributed>();
        redistributed.forEach(wo => {
          const day = normalizeDate(wo.Fch_Objetivo);
          if (!redistributedByDay.has(day)) redistributedByDay.set(day, []);
          redistributedByDay.get(day)!.push(wo);
        });
        
        const redistributedWithCorrectSeq: typeof redistributed = [];

        redistributedByDay.forEach(wosInDay => {
          wosInDay.forEach((wo, dayIndex) => {
            redistributedWithCorrectSeq.push({ ...wo, Secuencia: dayIndex + 1 });
          });
        });
        
        const wosFromOtherLines = allWOs.filter(wo => wo.Linea !== targetLine);
        
        finalWOs = [
          ...wosFromOtherLines,
          ...wosBeforeAffected.filter(wo => wo.Linea === targetLine),
          ...redistributedWithCorrectSeq
        ];
      }

      finalWOs.sort((a, b) => {
        const dateCompare = new Date(a.Fch_Objetivo).getTime() - new Date(b.Fch_Objetivo).getTime();
        if (dateCompare !== 0) return dateCompare;
        const lineCompare = a.Linea.localeCompare(b.Linea);
        if (lineCompare !== 0) return lineCompare;
        return a.Secuencia - b.Secuencia;
      });

      const allContextWOs = fabricacionesFromContext;
      const modifiedNumWOs = new Set(finalWOs.map(wo => wo.NumWO));
      const unchangedWOs = allContextWOs.filter(wo => !modifiedNumWOs.has(wo.NumWO));
      const completeUpdate = [...unchangedWOs, ...finalWOs];

      onGanttOrdersChanged(completeUpdate);
    },
    [onGanttOrdersChanged, fabricacionesFromContext]
  );

  useEffect(() => {
    registerRecalculateCallback(async (capacities, deletions) => {
      hasLoadedCapacityRef.current = false;
      isHandlingCapacityChangeRef.current = true;

      await new Promise(resolve => setTimeout(resolve, 500));

      const dailyCapacities = capacitiesFromContextRef.current;
      const extendedWorkingDays = workingDaysFromContextRef.current;

      if (!dailyCapacities.length) {
        console.error('❌ No hay capacidades disponibles para recalcular');
        isHandlingCapacityChangeRef.current = false;
        hasLoadedCapacityRef.current = true;
        setIsCapacityReady(true);
        return;
      }

      if (dataRef.current) {
        dataRef.current = {
          ...dataRef.current,
          capacity: [...dailyCapacities]
        };
      }

      setData(prev => {
        if (!prev) return prev;
        return { ...prev, capacity: [...dailyCapacities] };
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      if (dataRef.current?.workOrders?.length && dataRef.current.capacity?.length > 0) {
        const recalculatedWOs = recalculateAffectedWorkOrders(
          dataRef.current.workOrders,
          dataRef.current.capacity,
          extendedWorkingDays,
          capacities
        );

        if (recalculatedWOs.length === dataRef.current.workOrders.length) {
          onGanttOrdersChanged(recalculatedWOs, true);
        } else {
          console.error('❌ Error en recálculo: número de WOs no coincide');
        }
      }

      hasLoadedCapacityRef.current = true;
      setIsCapacityReady(true);

      setTimeout(() => {
        isHandlingCapacityChangeRef.current = false;
      }, 300);
    });
  }, [registerRecalculateCallback]);

  useEffect(() => {
    DropMonitor.registerDropHandler(stableHandleWorkOrderDrop);
    return () => {
      DropMonitor.unregisterDropHandler();
    };
  }, [stableHandleWorkOrderDrop]);

  useEffect(() => {
    if (
      capacitiesFromContext.length > 0 && 
      data?.workOrders && 
      !isHandlingCapacityChangeRef.current &&
      !hasLoadedCapacityRef.current
    ) {
      hasLoadedCapacityRef.current = true;
      
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          capacity: capacitiesFromContext
        };
      });
      
      setIsCapacityReady(true);
    }
  }, [capacitiesFromContext.length, data?.workOrders?.length, setData]);

  return {
    data,
    workingDays,
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