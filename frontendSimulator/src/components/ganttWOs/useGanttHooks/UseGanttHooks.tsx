import { useState, useEffect, useRef, useCallback } from "react";
import { useFabricacionesContext } from "../../../contexts/FabricacionesContext";
import { useGanttData } from "./UseGanttData";
import { useCapacityHandlers } from "./UseCapacityHandlers";
import { useWorkOrderHandlers } from "./UseWorkOrderHandlers";
import { DropInfo, GanttData } from "./Types";
import { CapacityData } from "../../../interfaces/Capacity";
import { IFabricacionConHoras } from "../../../interfaces/IFabricacionConHoras";
import DropMonitor from "../DropMonitor";

// ✅ EXPORTADAS para uso en DetailTablesPanel
export const DEFAULT_INITIAL_CAPACITY = 1000000;

export const getWeekNumber = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.ceil((target.getTime() - firstThursday.getTime()) / 604800000);
};

// ✅ EXPORTADA para uso en DetailTablesPanel
export const recalculateAffectedWorkOrders = (
  workOrders: IFabricacionConHoras[],
  capacity: any[],
  workingDays: string[],
  affectedCapacities: CapacityData[]
): IFabricacionConHoras[] => {
  console.log('🎯 [Recalcular AFECTADAS] INICIO:', {
    totalWOsEntrada: workOrders.length,
    capacityLength: capacity.length,
    workingDaysLength: workingDays.length,
    affectedCapacitiesLength: affectedCapacities.length,
    primerasWOs: workOrders.slice(0, 3).map(w => ({
      NumWO: w.NumWO,
      Fecha: w.Fch_Objetivo,
      Linea: w.Linea,
      Seq: w.Secuencia
    }))
  });

  if (!workOrders.length || !capacity.length || !workingDays.length || !affectedCapacities.length) {
    console.warn('⚠️ [Recalcular AFECTADAS] Faltan datos, devolviendo workOrders originales:', {
      workOrders: workOrders.length,
      capacity: capacity.length,
      workingDays: workingDays.length,
      affectedCapacities: affectedCapacities.length
    });
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
  console.log(`   📊 VERIFICACIÓN: ${affectedWOs.length} + ${unaffectedWOs.length} = ${affectedWOs.length + unaffectedWOs.length} (debe ser ${workOrders.length})`);

  if (affectedWOs.length === 0) {
    console.log('   ℹ️ No hay WOs en las semanas/líneas modificadas, devolviendo todas sin cambios');
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
    console.log(`   🔧 Procesando línea ${line}: ${lineWOs.length} WOs`);
    
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
    wosByDay.forEach((wos, day) => {
      const alreadyInDay = wos.filter(wo => {
        const originalInSorted = sortedWOs.find(s => s.NumWO === wo.NumWO);
        return originalInSorted?.Fch_Objetivo === day;
      }).sort((a, b) => a.Secuencia - b.Secuencia);

      const movedToDay = wos.filter(wo => {
        const originalInSorted = sortedWOs.find(s => s.NumWO === wo.NumWO);
        return originalInSorted?.Fch_Objetivo !== day;
      }).sort((a, b) => {
        const originalA = sortedWOs.find(s => s.NumWO === a.NumWO);
        const originalB = sortedWOs.find(s => s.NumWO === b.NumWO);
        if (!originalA || !originalB) return 0;
        return new Date(originalA.Fch_Objetivo).getTime() - new Date(originalB.Fch_Objetivo).getTime();
      });

      // ✅ CRÍTICO: Los movidos van PRIMERO
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
    
    console.log(`   ✅ Línea ${line} procesada: ${recalculatedWOs.length} WOs en resultado parcial`);
  });

  const allWorkOrders = [...unaffectedWOs, ...recalculatedWOs];

  console.log('✅ [Recalcular AFECTADAS] Completado:', {
    totalSalida: allWorkOrders.length,
    unaffected: unaffectedWOs.length,
    recalculated: recalculatedWOs.length,
    verificacion: `${unaffectedWOs.length} + ${recalculatedWOs.length} = ${allWorkOrders.length}`,
    primerasWOsSalida: allWorkOrders.slice(0, 3).map(w => ({
      NumWO: w.NumWO,
      Fecha: w.Fch_Objetivo,
      Linea: w.Linea,
      Seq: w.Secuencia
    }))
  });

  // 🆕 VERIFICACIÓN CRÍTICA: Asegurar que NO perdimos WOs
  if (allWorkOrders.length !== workOrders.length) {
    console.error('❌❌❌ CRÍTICO: SE PERDIERON WOs EN EL RECÁLCULO!', {
      entrada: workOrders.length,
      salida: allWorkOrders.length,
      diferencia: workOrders.length - allWorkOrders.length,
      wosOriginales: workOrders.map(w => w.NumWO).sort(),
      wosSalida: allWorkOrders.map(w => w.NumWO).sort()
    });
    
    // Encontrar qué WOs se perdieron
    const originalNumWOs = new Set(workOrders.map(w => w.NumWO));
    const resultNumWOs = new Set(allWorkOrders.map(w => w.NumWO));
    const perdidas = [...originalNumWOs].filter(numWO => !resultNumWOs.has(numWO));
    
    console.error('❌ WOs PERDIDAS:', perdidas);
    
    // 🚨 CRÍTICO: Si perdimos WOs, devolver las originales sin cambios
    console.error('🚨 DEVOLVIENDO WOs ORIGINALES PARA EVITAR PÉRDIDA DE DATOS');
    return workOrders;
  }

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
          
          // 🆕 VERIFICACIÓN ADICIONAL antes de actualizar contexto
          if (recalculatedWOs.length === dataRef.current.workOrders.length) {
            console.log('✅ Verificación OK: Mismo número de WOs, actualizando contexto');
            onGanttOrdersChanged(recalculatedWOs);
          } else {
            console.error('❌ ERROR: Número de WOs no coincide!', {
              antes: dataRef.current.workOrders.length,
              despues: recalculatedWOs.length
            });
            console.error('🚨 NO ACTUALIZANDO CONTEXTO para evitar pérdida de datos');
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

                // 🆕 VERIFICACIÓN antes de actualizar
                if (recalculatedWOs.length === dataRef.current.workOrders.length) {
                  console.log(`✅ Verificación OK: Actualizando con ${recalculatedWOs.length} WOs recalculadas`);
                  onGanttOrdersChanged(recalculatedWOs, true);
                } else {
                  console.error('❌ ERROR: recalculateAffectedWorkOrders cambió el número de WOs', {
                    antes: dataRef.current.workOrders.length,
                    despues: recalculatedWOs.length
                  });
                  console.error('🚨 NO actualizando contexto para evitar pérdida de datos');
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