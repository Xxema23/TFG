import { useState, useEffect, useRef, useCallback } from "react";

import { getNonWorkingDays } from "../../services/VacacionesServices";
import { getFabricacionesConHoras, updateFabricacionConHoras } from "../../services/FabricacionConHoras";
import { IFabricacionConHoras } from "../../interfaces/IFabricacionConHoras";
import { Capacity } from "./Types";
import { saveCapacities, getCapacities, deleteCapacity } from "../../services/CapacityService";
import { CapacityData } from "../../interfaces/Capacity";
import DropMonitor from "./DropMonitor";

export interface GanttData {
  workOrders: IFabricacionConHoras[];
  nonWorkingDays: string[];
  capacity: Capacity[];
}

interface UseGanttHooksOptions {
  externalWorkOrders?: IFabricacionConHoras[];
  filterMode?: boolean;
  onDataLoad?: (data: IFabricacionConHoras[]) => void;
}

interface WorkOrderChange {
  NumWO: string;
  originalFch_Objetivo: string;
  originalSecuencia: number;
  newFch_Objetivo: string;
  newSecuencia: number;
  originalLinea?: string;
  newLinea?: string;
}

const DEFAULT_INITIAL_CAPACITY = 1000000;

const formatDateForAPI = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day} 00:00:00`;
  } catch (error) {
    return dateString;
  }
};

const formatDataForAPI = (data: Partial<IFabricacionConHoras>): Record<string, any> => {
  const apiData: Record<string, any> = {};
  
  if (data.Fch_Objetivo) {
    apiData.fch_objetivo = formatDateForAPI(data.Fch_Objetivo);
  }
  
  if (data.Secuencia !== undefined && data.Secuencia !== null) {
    const secuencia = Math.max(1, Number(data.Secuencia) || 1);
    apiData.secuencia_fab = secuencia;
  }
  
  if (data.Linea) {
    apiData.linea = data.Linea;
  }
  
  return Object.keys(apiData).reduce((acc, key) => {
    const value = apiData[key];
    if (value !== undefined && value !== null && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
};

const logDetailedError = (error: any, woId: string, updateData: any, originalData: any): void => {
  console.group(`Error al actualizar WO ${woId}`);
  console.error('Datos originales:', originalData);
  console.error('Datos enviados a API:', updateData);
  
  if (error.response) {
    console.error('Estado HTTP:', error.response.status);
    console.error('Mensaje:', error.response.statusText);
    console.error('Datos del error:', error.response.data);
    
    if (error.response.data?.message) {
      console.error('Mensaje del servidor:', error.response.data.message);
    }
    
    if (error.response.data?.exception) {
      console.error('Excepción:', error.response.data.exception);
    }
  } else if (error.request) {
    console.error('Error de red/timeout:', error.message);
  } else {
    console.error('Error:', error.message || error);
  }
  console.groupEnd();
};

const getWeekNumber = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  return 1 + Math.ceil((target.getTime() - firstThursday.getTime()) / 604800000);
};

interface DropInfo {
  day: string;
  line: string;
  draggedItems: string[];
  insertBeforeWO?: string;
}

export const useGanttHooks = (options: UseGanttHooksOptions = {}) => {
  const { externalWorkOrders, filterMode = false, onDataLoad } = options;
  const [data, setData] = useState<GanttData | null>(null);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [isCapacityModalOpen, setIsCapacityModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedWOs, setSelectedWOs] = useState<string[]>([]);
  const [draggedWOs, setDraggedWOs] = useState<IFabricacionConHoras[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, WorkOrderChange>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const dataRef = useRef<GanttData | null>(null);
  const workingDaysRef = useRef<string[]>([]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    workingDaysRef.current = workingDays;
  }, [workingDays]);

  useEffect(() => {
    if (filterMode && externalWorkOrders) {
      setData(prevData => {
        if (!prevData) return null;
        return {
          ...prevData,
          workOrders: externalWorkOrders
        };
      });

      if (onDataLoad) {
        onDataLoad(externalWorkOrders);
      }
    }
  }, [externalWorkOrders, filterMode, onDataLoad]);

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
  }, [convertWeeklyToDaily, workingDays]);

  const generateInitialWorkingDays = useCallback(
    (nonWorkingDates?: string[]): string[] => {
      const nonWorkingSet = new Set(nonWorkingDates || []);
      const today = new Date();
      const days: string[] = [];

      let previousDate = new Date(today);
      let addedDays = 0;
      while (addedDays < 20) {
        previousDate.setDate(previousDate.getDate() - 1);
        const dayOfWeek = previousDate.getDay();
        const dateStr = previousDate.toISOString().split("T")[0];

        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !nonWorkingSet.has(dateStr)) {
          days.unshift(dateStr);
          addedDays++;
        }
      }

      const endDate = new Date(today);
      endDate.setFullYear(today.getFullYear() + 1);

      let currentDate = new Date(today);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const dateStr = currentDate.toISOString().split("T")[0];

        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !nonWorkingSet.has(dateStr)) {
          days.push(dateStr);
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return days;
    },
    []
  );

  const reorderSequencesInDay = useCallback((
    workOrdersInput: IFabricacionConHoras[],
    targetDate: string,
    targetLine: string,
  ): IFabricacionConHoras[] => {
    const workOrdersToProcess = [...workOrdersInput];

    const wosForThisDayAndLine = workOrdersToProcess
      .filter(wo => wo.Fch_Objetivo === targetDate && wo.Linea === targetLine)
      .sort((a, b) => a.Secuencia - b.Secuencia);

    wosForThisDayAndLine.forEach((woToUpdate, index) => {
      const originalWoindex = workOrdersToProcess.findIndex(w => w.NumWO === woToUpdate.NumWO);
      if (originalWoindex !== -1) {
        if (workOrdersToProcess[originalWoindex].Secuencia !== index + 1) {
          workOrdersToProcess[originalWoindex] = {
            ...workOrdersToProcess[originalWoindex],
            Secuencia: index + 1,
          };
        }
      }
    });

    return workOrdersToProcess;
  }, []);

  const saveChanges = useCallback(async (): Promise<void> => {
    if (pendingChanges.size === 0) {
      return;
    }

    setIsSaving(true);

    try {
      const changesToSave = Array.from(pendingChanges.values());
      
      const retryUpdate = async (change: WorkOrderChange, maxRetries = 2): Promise<{ success: boolean; woId: string; result?: any; error?: any }> => {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const updateData: Partial<IFabricacionConHoras> = {};
            
            if (change.originalFch_Objetivo !== change.newFch_Objetivo) {
              updateData.Fch_Objetivo = change.newFch_Objetivo;
            }
            
            if (change.originalSecuencia !== change.newSecuencia) {
              updateData.Secuencia = Math.max(1, change.newSecuencia);
            }
            
            if (change.originalLinea && change.originalLinea !== change.newLinea) {
              updateData.Linea = change.newLinea;
            }

            if (Object.keys(updateData).length === 0) {
              return { success: true, woId: change.NumWO, result: 'no-changes' };
            }

            const apiData = formatDataForAPI(updateData);
            
            if (Object.keys(apiData).length === 0) {
              throw new Error('No hay datos válidos para actualizar');
            }
            
            const result = await updateFabricacionConHoras(change.NumWO, apiData);
            
            return { success: true, woId: change.NumWO, result };
            
          } catch (error: any) {
            lastError = error;
            
            if (attempt < maxRetries && (
              error.message?.includes('timeout') || 
              error.code === 'ECONNABORTED' ||
              error.response?.status === 408
            )) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              continue;
            }
            
            break;
          }
        }
        
        const originalData = {
          Fch_Objetivo: change.newFch_Objetivo,
          Secuencia: change.newSecuencia,
          ...(change.originalLinea !== change.newLinea && { Linea: change.newLinea })
        };
        
        const formattedData = formatDataForAPI(originalData);
        logDetailedError(lastError, change.NumWO, formattedData, originalData);
        
        return { success: false, woId: change.NumWO, error: lastError };
      };

      const results = await Promise.all(
        changesToSave.map(change => retryUpdate(change))
      );
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (failed.length === 0) {
        setPendingChanges(new Map());
        setHasUnsavedChanges(false);
        
        alert(`¡Éxito! Se guardaron ${successful.length} cambio${successful.length !== 1 ? 's' : ''} correctamente.`);
        
        try {
          const freshData = await getFabricacionesConHoras();
          const validFabricaciones = freshData.filter(fab => fab.Fch_Objetivo);

          const currentWorkingDays = workingDaysRef.current;

          const adjustedWorkOrders = validFabricaciones.map((wo) => {
            const formattedDate = new Date(wo.Fch_Objetivo).toISOString().split("T")[0];
            if (!currentWorkingDays.includes(formattedDate)) {
              const newStartDay = currentWorkingDays.find(day => new Date(day) >= new Date(formattedDate)) || currentWorkingDays[0];
              return { ...wo, Fch_Objetivo: newStartDay };
            }
            return wo;
          });

          setData((prevData) => {
            if (!prevData) return null;
            return {
              ...prevData,
              workOrders: adjustedWorkOrders,
            };
          });
          
        } catch (reloadError) {
          console.error("Error al recargar datos:", reloadError);
          alert("Los datos se guardaron correctamente, pero hubo un problema al recargar. Puedes refrescar la página manualmente si es necesario.");
        }
        
      } else {
        const remainingChanges = new Map(pendingChanges);
        successful.forEach((result) => {
          remainingChanges.delete(result.woId);
        });
        
        setPendingChanges(remainingChanges);
        setHasUnsavedChanges(remainingChanges.size > 0);
        
        const failedWOs = failed.map(f => f.woId).join(', ');
        alert(
          `Se guardaron ${successful.length} cambios exitosamente.\n` +
          `${failed.length} cambios fallaron para las WOs: ${failedWOs}\n\n` +
          `Los errores más comunes son timeouts de base de datos.\n` +
          `Puedes intentar guardar nuevamente o revisar la consola para más detalles.`
        );
      }

    } catch (error) {
      console.error("Error general al guardar cambios:", error);
      alert("Error inesperado al guardar los cambios. Revisa la consola para más detalles.");
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges]);

  const discardChanges = useCallback(async (): Promise<void> => {
    if (pendingChanges.size === 0) return;

    try {
      const fabricacionesData = await getFabricacionesConHoras();
      const validFabricaciones = fabricacionesData.filter(fab => fab.Fch_Objetivo);

      const adjustedWorkOrders = validFabricaciones.map((wo) => {
        const formattedDate = new Date(wo.Fch_Objetivo).toISOString().split("T")[0];
        if (!workingDays.includes(formattedDate)) {
          const newStartDay = workingDays.find(day => new Date(day) >= new Date(formattedDate)) || workingDays[0];
          return { ...wo, Fch_Objetivo: newStartDay };
        }
        return wo;
      });

      setData((prevData) => {
        if (!prevData) return null;
        return {
          ...prevData,
          workOrders: adjustedWorkOrders,
        };
      });

      setPendingChanges(new Map());
      setHasUnsavedChanges(false);
      setSelectedWOs([]);

    } catch (error) {
      console.error("Error al descartar cambios:", error);
    }
  }, [pendingChanges, workingDays]);

  const updateWorkOrderDatesBasedOnCapacity = useCallback((
    workOrdersInput: IFabricacionConHoras[],
    capacityData: Capacity[],
    workingDaysArray: string[]
  ): IFabricacionConHoras[] => {
    
    if (!workOrdersInput.length || !capacityData.length || !workingDaysArray.length) {
      return workOrdersInput;
    }

    const wosByLine = new Map<string, IFabricacionConHoras[]>();
    workOrdersInput.forEach(wo => {
      if (!wosByLine.has(wo.Linea)) {
        wosByLine.set(wo.Linea, []);
      }
      wosByLine.get(wo.Linea)!.push(wo);
    });

    const updatedWorkOrders: IFabricacionConHoras[] = [];

    wosByLine.forEach((lineWOs, line) => {
      const lineCapacity = capacityData.filter(cap => cap.line === line || cap.line === "*");
      const capacityByDay = new Map<string, number>();
      workingDaysArray.forEach((day) => {
        const customCapacity = lineCapacity.find((cap) => cap.date === day)?.capacity;
        capacityByDay.set(day, customCapacity || DEFAULT_INITIAL_CAPACITY);
      });

      const sortedWOs = [...lineWOs].sort((a, b) => {
        const dateA = new Date(a.Fch_Objetivo).getTime();
        const dateB = new Date(b.Fch_Objetivo).getTime();
        return dateA - dateB || a.Secuencia - b.Secuencia;
      });

      const dayUsage = new Map<string, number>();
      workingDaysArray.forEach(day => dayUsage.set(day, 0));

      sortedWOs.forEach((workOrder) => {
        const originalDate = workOrder.Fch_Objetivo;
        const woHours = Math.max(parseFloat(workOrder.horas_totales_de_la_wo || "0"), 0.5);
        let remainingHours = woHours;
        
        let startDayindex = workingDaysArray.findIndex(d => d === originalDate);
        if (startDayindex === -1) {
          startDayindex = workingDaysArray.findIndex(d => new Date(d) >= new Date(originalDate));
          if (startDayindex === -1) startDayindex = 0;
        }

        let currentDayindex = startDayindex;
        let actualStartDay = "";
        let isFirstValidDay = true;

        while (remainingHours > 0 && currentDayindex < workingDaysArray.length) {
          const currentDay = workingDaysArray[currentDayindex];
          const dailyCapacity = capacityByDay.get(currentDay) || DEFAULT_INITIAL_CAPACITY;
          const usedCapacity = dayUsage.get(currentDay) || 0;
          const availableCapacity = dailyCapacity - usedCapacity;

          if (availableCapacity <= 0) {
            currentDayindex++;
            continue;
          }

          if (isFirstValidDay) {
            actualStartDay = currentDay;
            isFirstValidDay = false;
          }

          const hoursForThisDay = Math.min(remainingHours, availableCapacity);
          remainingHours -= hoursForThisDay;
          dayUsage.set(currentDay, usedCapacity + hoursForThisDay);

          if (remainingHours > 0) {
            currentDayindex++;
          }
        }

        const updatedWO = {
          ...workOrder,
          Fch_Objetivo: actualStartDay || workOrder.Fch_Objetivo
        };

        updatedWorkOrders.push(updatedWO);
      });
    });
    
    return updatedWorkOrders;
  }, []);

  const applyCapacityChanges = useCallback((): void => {
    if (!data) return;
    
    setData(prevData => {
      if (!prevData) return null;

      const updatedWorkOrders = updateWorkOrderDatesBasedOnCapacity(
        prevData.workOrders,
        prevData.capacity,
        workingDays
      );

      const newChanges = new Map(pendingChanges);
      
      updatedWorkOrders.forEach(updatedWO => {
        const originalWO = prevData.workOrders.find(wo => wo.NumWO === updatedWO.NumWO);
        if (originalWO && originalWO.Fch_Objetivo !== updatedWO.Fch_Objetivo) {
          const existingChange = newChanges.get(updatedWO.NumWO);
          const originalDate = existingChange?.originalFch_Objetivo || originalWO.Fch_Objetivo;
          
          newChanges.set(updatedWO.NumWO, {
            NumWO: updatedWO.NumWO,
            originalFch_Objetivo: originalDate,
            originalSecuencia: existingChange?.originalSecuencia || originalWO.Secuencia,
            originalLinea: existingChange?.originalLinea || originalWO.Linea,
            newFch_Objetivo: updatedWO.Fch_Objetivo,
            newSecuencia: updatedWO.Secuencia,
            newLinea: updatedWO.Linea,
          });
        }
      });

      if (newChanges.size > pendingChanges.size) {
        setPendingChanges(newChanges);
        setHasUnsavedChanges(true);
      }

      return {
        ...prevData,
        workOrders: updatedWorkOrders
      };
    });
  }, [data, workingDays, pendingChanges, updateWorkOrderDatesBasedOnCapacity]);

  const handleWorkOrderDrop = useCallback(
    (targetDay: string, targetLine: string, insertBeforeWOId?: string, draggedItems?: string[]): void => {

      const currentSelectedWOs = draggedItems || selectedWOs;
      if (!dataRef.current || currentSelectedWOs.length === 0) {
        return;
      }

      setData((prevData) => {
        if (!prevData) return null;

        let workOrdersSnapshot = [...prevData.workOrders];
        const newChanges = new Map(pendingChanges);

        const draggedWOsData = currentSelectedWOs.map(id => {
          const wo = workOrdersSnapshot.find(w => w.NumWO === id);
          if (!wo) {
            console.error(`WO ${id} not found during drag operation.`);
            return null;
          }
          return {
            ...wo,
            Fch_Objetivo_Prev: wo.Fch_Objetivo,
            Secuencia_Prev: wo.Secuencia,
            Linea_Prev: wo.Linea,
            Fch_Objetivo: targetDay,
            Linea: targetLine,
          };
        }).filter(Boolean) as Array<IFabricacionConHoras & {
          Fch_Objetivo_Prev: string;
          Secuencia_Prev: number;
          Linea_Prev: string;
        }>;

        if (draggedWOsData.length === 0) {
          return prevData;
        }

        workOrdersSnapshot = workOrdersSnapshot.filter(wo => !currentSelectedWOs.includes(wo.NumWO));

        const existingWOsInTarget = workOrdersSnapshot
          .filter(wo => wo.Fch_Objetivo === targetDay && wo.Linea === targetLine)
          .sort((a, b) => a.Secuencia - b.Secuencia);

        let insertAtindex = existingWOsInTarget.length;
        
        if (insertBeforeWOId) {
          const referenceWOindex = existingWOsInTarget.findIndex(wo => wo.NumWO === insertBeforeWOId);
          if (referenceWOindex !== -1) {
            insertAtindex = referenceWOindex;
          }
        }

        const finalOrderedWOs = [
          ...existingWOsInTarget.slice(0, insertAtindex),
          ...draggedWOsData,
          ...existingWOsInTarget.slice(insertAtindex)
        ];

        const resequencedWOs = finalOrderedWOs.map((wo, index) => ({
          ...wo,
          Secuencia: index + 1
        }));

        workOrdersSnapshot = workOrdersSnapshot.filter(wo => 
          !(wo.Fch_Objetivo === targetDay && wo.Linea === targetLine)
        );
        workOrdersSnapshot.push(...resequencedWOs);

        const originalLocationsToReorder = new Set<string>();
        draggedWOsData.forEach(draggedWO => {
          if (draggedWO.Fch_Objetivo_Prev !== targetDay || draggedWO.Linea_Prev !== targetLine) {
            originalLocationsToReorder.add(`${draggedWO.Fch_Objetivo_Prev}|${draggedWO.Linea_Prev}`);
          }
        });

        originalLocationsToReorder.forEach(locationKey => {
          const [prevDay, prevLine] = locationKey.split("|");
          workOrdersSnapshot = reorderSequencesInDay(workOrdersSnapshot, prevDay, prevLine);
        });

        resequencedWOs.forEach(finalWO => {
          const original = draggedWOsData.find(d => d.NumWO === finalWO.NumWO);
          if (original) {
            newChanges.set(finalWO.NumWO, {
              NumWO: finalWO.NumWO,
              originalFch_Objetivo: original.Fch_Objetivo_Prev,
              originalSecuencia: original.Secuencia_Prev,
              originalLinea: original.Linea_Prev,
              newFch_Objetivo: finalWO.Fch_Objetivo,
              newSecuencia: finalWO.Secuencia,
              newLinea: finalWO.Linea,
            });
          }
        });

        setPendingChanges(newChanges);
        setHasUnsavedChanges(true);
        setSelectedWOs([]);

        // ✅ NUEVO: Notificar cambios al contexto después de drag en Gantt
        console.log('📢 [Gantt→Drop] Notificando cambios al contexto:', workOrdersSnapshot.length);
        if (typeof window !== 'undefined') {
          setTimeout(() => {
            const event = new CustomEvent('gantt-workorders-updated', {
              detail: { workOrders: workOrdersSnapshot }
            });
            window.dispatchEvent(event);
          }, 0);
        }

        return {
          ...prevData,
          workOrders: workOrdersSnapshot,
        };
      });
    },
    [selectedWOs, pendingChanges, reorderSequencesInDay]
  );

  const handleSaveCapacity = useCallback(
    async (capacities: CapacityData[], deletions: { line: string; week: number; year: number }[] = []): Promise<void> => {
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
          alert(`Se procesaron ${totalOperations} cambio(s) de capacidad correctamente.`);
        } else {
          console.error("Error en las operaciones:", { saveResult, deleteErrors });
          alert(`Error al procesar capacidades. Revisa la consola para más detalles.`);
        }
      } catch (error) {
        console.error("Error al procesar capacidades:", error);
        alert("Error inesperado al procesar las capacidades.");
      }
    },
    [convertWeeklyToDaily, workingDays, setIsCapacityModalOpen]
  );

  const getWorkOrderCurrentState = useCallback((woId: string): IFabricacionConHoras | null => {
    if (!data) return null;
    
    const wo = data.workOrders.find(w => w.NumWO === woId);
    if (!wo) return null;

    const pendingChange = pendingChanges.get(woId);
    if (pendingChange) {
      return {
        ...wo,
        Fch_Objetivo: pendingChange.newFch_Objetivo,
        Secuencia: pendingChange.newSecuencia,
        Linea: pendingChange.newLinea || wo.Linea,
      };
    }

    return wo;
  }, [data, pendingChanges]);

  const handleZoomIn = useCallback((): void => {
    setZoomLevel((prev) => Math.min(prev * 1.2, 3));
  }, []);

  const handleZoomOut = useCallback((): void => {
    setZoomLevel((prev) => Math.max(prev / 1.2, 0.5));
  }, []);

  const stableHandleWorkOrderDrop = useCallback(
    (info: DropInfo): void => {
      handleWorkOrderDrop(info.day, info.line, info.insertBeforeWO, info.draggedItems);
    },
    [handleWorkOrderDrop]
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

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        const nonWorkingFromApi = await getNonWorkingDays();
        const initialWorkingDays = generateInitialWorkingDays(nonWorkingFromApi);
        setWorkingDays(initialWorkingDays);

        const fabricacionesData = await getFabricacionesConHoras();
        const uniqueLines = Array.from(new Set(fabricacionesData.map((fab) => fab.Linea)));

        const validFabricaciones = fabricacionesData.filter(fab => fab.Fch_Objetivo);

        const adjustedWorkOrders = validFabricaciones.map((wo) => {
          const formattedDate = new Date(wo.Fch_Objetivo).toISOString().split("T")[0];
          if (!initialWorkingDays.includes(formattedDate)) {
            const newStartDay = initialWorkingDays.find(day => new Date(day) >= new Date(formattedDate)) || initialWorkingDays[0];
            return { ...wo, Fch_Objetivo: newStartDay };
          }
          return wo;
        });

        const initialCapacity: Capacity[] = [];
        for (const line of uniqueLines) {
          for (const date of initialWorkingDays) {
            initialCapacity.push({
              line,
              date,
              capacity: DEFAULT_INITIAL_CAPACITY,
            });
          }
        }

        setData({
          workOrders: adjustedWorkOrders,
          capacity: initialCapacity,
          nonWorkingDays: nonWorkingFromApi || [],
        });
      } catch (error) {
        console.error("Error al cargar datos iniciales:", error);
      }
    };

    fetchData();
  }, [generateInitialWorkingDays]);

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
    pendingChanges,
    hasUnsavedChanges,
    saveChanges,
    discardChanges,
    isSaving,
    getWorkOrderCurrentState,
    loadCapacitiesFromService,
    applyCapacityChanges,
    updateWorkOrderDatesBasedOnCapacity
  };
};