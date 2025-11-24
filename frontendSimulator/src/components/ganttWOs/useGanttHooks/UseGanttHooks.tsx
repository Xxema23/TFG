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

const getWeekNumber = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.ceil((target.getTime() - firstThursday.getTime()) / 604800000);
};

const recalculateAffectedWorkOrders = (
  workOrders: IFabricacionConHoras[],
  capacity: any[],
  workingDays: string[],
  affectedCapacities: CapacityData[]
): IFabricacionConHoras[] => {
  if (!workOrders.length || !capacity.length || !workingDays.length || !affectedCapacities.length) {
    return workOrders;
  }

  console.log('🎯 [Recalcular AFECTADAS] Capacidades modificadas:', affectedCapacities.length);
  
  const affectedLinesWeeks = new Set<string>();
  affectedCapacities.forEach(cap => {
    affectedLinesWeeks.add(`${cap.line}-${cap.week}-${cap.year}`);
    console.log(`   📌 Línea ${cap.line}, Semana ${cap.week}, Año ${cap.year}`);
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

  console.log(`   ✅ WOs afectadas: ${affectedWOs.length}, No afectadas: ${unaffectedWOs.length}`);

  if (affectedWOs.length === 0) {
    console.log('   ℹ️ No hay WOs en las semanas/líneas modificadas');
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

    // ✅ CRÍTICO: Ordenar por fecha ORIGINAL primero, luego por secuencia
    const sortedWOs = [...lineWOs].sort((a, b) => {
      const dateA = new Date(a.Fch_Objetivo).getTime();
      const dateB = new Date(b.Fch_Objetivo).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.Secuencia - b.Secuencia;
    });

    const dayUsage = new Map<string, number>();
    workingDays.forEach(day => dayUsage.set(day, 0));

    // ✅ Array para almacenar WOs con su nuevo día calculado
    const wosWithNewDates: Array<{ wo: IFabricacionConHoras; newDate: string }> = [];

    sortedWOs.forEach((workOrder) => {
      const originalDate = workOrder.Fch_Objetivo;
      const woHours = Math.max(parseFloat(workOrder.horas_totales_de_la_wo || "0"), 0.5);
      
      let startDayIndex = workingDays.findIndex(d => d === originalDate);
      if (startDayIndex === -1) {
        startDayIndex = workingDays.findIndex(d => new Date(d) >= new Date(originalDate));
        if (startDayIndex === -1) startDayIndex = 0;
      }

      let actualStartDay = originalDate;
      let foundCapacity = false;

      // Buscar el primer día con capacidad disponible desde su fecha original
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

      // Registrar consumo de horas
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

      if (actualStartDay !== originalDate) {
        console.log(`   📅 WO ${workOrder.NumWO}: ${originalDate} → ${actualStartDay}`);
      }

      wosWithNewDates.push({
        wo: workOrder,
        newDate: actualStartDay
      });
    });

    // ✅ NUEVO: Agrupar por día y asignar secuencias correctamente
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

    // ✅ Para cada día, ordenar WOs:
    // 1. Primero las que YA estaban en ese día (por secuencia original)
    // 2. Luego las que se movieron a ese día (por fecha original, para que las más antiguas vayan primero)
    wosByDay.forEach((wos, day) => {
      const alreadyInDay = wos.filter(wo => {
        const originalInSorted = sortedWOs.find(s => s.NumWO === wo.NumWO);
        return originalInSorted?.Fch_Objetivo === day;
      }).sort((a, b) => a.Secuencia - b.Secuencia);

      const movedToDay = wos.filter(wo => {
        const originalInSorted = sortedWOs.find(s => s.NumWO === wo.NumWO);
        return originalInSorted?.Fch_Objetivo !== day;
      }).sort((a, b) => {
        // Ordenar los movidos por su fecha ORIGINAL (más antigua primero)
        const originalA = sortedWOs.find(s => s.NumWO === a.NumWO);
        const originalB = sortedWOs.find(s => s.NumWO === b.NumWO);
        if (!originalA || !originalB) return 0;
        return new Date(originalA.Fch_Objetivo).getTime() - new Date(originalB.Fch_Objetivo).getTime();
      });

      // ✅ CRÍTICO: Los movidos van PRIMERO (son los que no cupieron antes)
      const orderedWOs = [...movedToDay, ...alreadyInDay];
      
      const resequenced = orderedWOs.map((wo, index) => ({
        ...wo,
        Secuencia: index + 1
      }));

      wosByDay.set(day, resequenced);
    });

    // Convertir de vuelta a array plano
    wosByDay.forEach(wos => {
      recalculatedWOs.push(...wos);
    });
  });

  const allWorkOrders = [...unaffectedWOs, ...recalculatedWOs];

  console.log('✅ [Recalcular AFECTADAS] Completado');

  return allWorkOrders;
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
  const lastSyncTimestampRef = useRef<number>(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    workingDaysRef.current = workingDays;
  }, [workingDays]);

  useEffect(() => {
    if (isRecalculatingRef.current) {
      console.log('⏸️ [useGanttHooks] Recalculando, skip sync');
      return;
    }

    if (fabricacionesFromContext.length > 0 && workingDays.length > 0) {
      const now = Date.now();
      if (now - lastSyncTimestampRef.current < 100) {
        console.log('⏸️ [useGanttHooks] Sync muy reciente, skip');
        return;
      }
      
      lastSyncTimestampRef.current = now;
      
      console.log('🔄 [useGanttHooks] Sincronizando desde contexto...', fabricacionesFromContext.length);
      
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

        return {
          ...prevData,
          workOrders: adjustedWorkOrders
        };
      });
    }
  }, [fabricacionesFromContext, workingDays, setData, lastUpdated]);

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
      console.log('🎯 [useGanttHooks] Drag & Drop en Gantt');
      console.log('   📊 Estado ANTES del drop:', {
        workOrders: dataRef.current?.workOrders.length || 0,
        capacity: dataRef.current?.capacity.length || 0,
        workingDays: workingDaysRef.current.length
      });
      
      originalHandleWorkOrderDrop(info.day, info.line, info.insertBeforeWO, info.draggedItems);
      
      setTimeout(() => {
        console.log('   📊 Estado DESPUÉS del drop:', {
          workOrders: dataRef.current?.workOrders.length || 0,
          capacity: dataRef.current?.capacity.length || 0,
          workingDays: workingDaysRef.current.length
        });
        
        if (dataRef.current && dataRef.current.workOrders.length > 0) {
          console.log('📢 [useGanttHooks] Recalculando después de drop en Gantt');
          
          isRecalculatingRef.current = true;
          
          const affectedCapacities: CapacityData[] = [];
          const draggedWOsData = info.draggedItems.map(numWO => 
            dataRef.current!.workOrders.find(wo => wo.NumWO === numWO)
          ).filter(Boolean);
          
          const targetDate = new Date(info.day);
          const targetWeek = getWeekNumber(targetDate);
          const targetYear = targetDate.getFullYear();
          
          affectedCapacities.push({
            line: info.line,
            week: targetWeek,
            year: targetYear,
            value: 0
          });
          
          draggedWOsData.forEach(wo => {
            if (wo) {
              const originDate = new Date(wo.Fch_Objetivo);
              const originWeek = getWeekNumber(originDate);
              const originYear = originDate.getFullYear();
              
              if (wo.Linea !== info.line || originWeek !== targetWeek || originYear !== targetYear) {
                const alreadyAdded = affectedCapacities.some(
                  cap => cap.line === wo.Linea && cap.week === originWeek && cap.year === originYear
                );
                
                if (!alreadyAdded) {
                  affectedCapacities.push({
                    line: wo.Linea,
                    week: originWeek,
                    year: originYear,
                    value: 0
                  });
                }
              }
            }
          });
          
          console.log('🎯 Recalculando capacidad para días afectados:', affectedCapacities);
          
          const recalculatedWOs = recalculateAffectedWorkOrders(
            dataRef.current.workOrders,
            dataRef.current.capacity,
            workingDaysRef.current,
            affectedCapacities
          );
          
          console.log('✅ Recalculadas:', recalculatedWOs.length, 'WOs');
          
          if (recalculatedWOs.length > 0) {
            onGanttOrdersChanged(recalculatedWOs);
          } else {
            console.error('❌ recalculateAffectedWorkOrders devolvió 0 WOs');
          }
          
          setTimeout(() => {
            isRecalculatingRef.current = false;
          }, 100);
        } else {
          console.error('❌ dataRef.current está vacío o no tiene workOrders');
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
        console.log('💾 [useGanttHooks] Guardando capacidad:', capacities);
        
        const result = await originalHandleSaveCapacity(capacities, deletions);
        
        if (!result.success) {
          return;
        }
        
        if (result.capacityChanges && result.capacityChanges.length > 0) {
          setTimeout(() => {
            applyCapacityChanges(result.capacityChanges);
            
            setTimeout(() => {
              if (dataRef.current) {
                console.log('📢 [useGanttHooks] Recalculando SOLO WOs afectadas por capacidad');
                console.log('   Datos actuales:', {
                  workOrders: dataRef.current.workOrders.length,
                  capacity: dataRef.current.capacity.length,
                  workingDays: workingDaysRef.current.length
                });
                
                isRecalculatingRef.current = true;
                
                const recalculatedWOs = recalculateAffectedWorkOrders(
                  dataRef.current.workOrders,
                  dataRef.current.capacity,
                  workingDaysRef.current,
                  result.capacityChanges
                );

                // ✅ CRÍTICO: Solo actualizar si hay WOs recalculadas
                if (recalculatedWOs.length > 0) {
                  console.log(`✅ Actualizando con ${recalculatedWOs.length} WOs recalculadas`);
                  onGanttOrdersChanged(recalculatedWOs, true);
                } else {
                  console.error('❌ recalculateAffectedWorkOrders devolvió 0 WOs, NO actualizando contexto');
                  console.error('   Esto es un BUG - debería devolver al menos las WOs no afectadas');
                }
                
                setTimeout(() => {
                  isRecalculatingRef.current = false;
                }, 100);
              }
            }, 200);
          }, 100);
        }
        
      } catch (error) {
        console.error('❌ [useGanttHooks] Error guardando capacidad:', error);
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