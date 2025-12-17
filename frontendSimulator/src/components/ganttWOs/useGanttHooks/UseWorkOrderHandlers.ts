import { useState, useCallback, useRef, useEffect } from "react";
import { IFabricacionConHoras } from "../../../interfaces/IFabricacionConHoras";
import { GanttData, DailyCapacity, CapacityChangeInfo } from "./Types";
import { updateFabricacionConHoras } from "../../../services/FabricacionConHoras";

interface WorkOrderChange {
  NumWO: string;
  originalFch_Objetivo: string;
  originalSecuencia: number;
  originalLinea: string;
  newFch_Objetivo: string;
  newSecuencia: number;
  newLinea: string;
}

export const useWorkOrderHandlers = (
  data: GanttData | null,
  setData: React.Dispatch<React.SetStateAction<GanttData | null>>,
  workingDays: string[],
  convertWeeklyToDaily: (
    capacities: any[],
    workingDays: string[]
  ) => DailyCapacity[],
  // ✅ NUEVO PARÁMETRO
  dataRef: React.MutableRefObject<GanttData | null>
) => {
  const [selectedWOs, setSelectedWOs] = useState<string[]>([]);
  const [draggedWOs, setDraggedWOs] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Map<string, WorkOrderChange>>(new Map());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef<Map<string, WorkOrderChange>>(new Map());

  useEffect(() => {
    pendingChangesRef.current = pendingChanges;
  }, [pendingChanges]);

  const scheduleAutoSave = useCallback((changes: Map<string, WorkOrderChange>) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    changes.forEach((change, woId) => {
      pendingChangesRef.current.set(woId, change);
    });

    setPendingChanges(new Map(pendingChangesRef.current));

    autoSaveTimeoutRef.current = setTimeout(async () => {
      await executeBatchSave();
    }, 1500);
  }, []);

  const executeBatchSave = useCallback(async () => {
    const changesToSave = new Map(pendingChangesRef.current);
    
    if (changesToSave.size === 0) {
      return;
    }

    setIsSaving(true);

    const validChanges: WorkOrderChange[] = [];
    const invalidChanges: string[] = [];

    changesToSave.forEach((change, woId) => {
      if (
        change.newFch_Objetivo !== change.originalFch_Objetivo ||
        change.newSecuencia !== change.originalSecuencia ||
        change.newLinea !== change.originalLinea
      ) {
        validChanges.push(change);
      } else {
        invalidChanges.push(woId);
      }
    });

    if (validChanges.length === 0) {
      pendingChangesRef.current.clear();
      setPendingChanges(new Map());
      setHasUnsavedChanges(false);
      setIsSaving(false);
      return;
    }

    const batchSize = 10;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < validChanges.length; i += batchSize) {
      const batch = validChanges.slice(i, i + batchSize);

      const batchPromises = batch.map(async (change) => {
        try {
          const updateData: Partial<IFabricacionConHoras> = {
            Fch_Objetivo: change.newFch_Objetivo,
            Secuencia: change.newSecuencia,
            Linea: change.newLinea,
          };

          await updateFabricacionConHoras(change.NumWO, updateData);

          pendingChangesRef.current.delete(change.NumWO);
          return { success: true, woId: change.NumWO };
        } catch (error) {
          return { success: false, woId: change.NumWO, error };
        }
      });

      const results = await Promise.all(batchPromises);
      
      results.forEach(result => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      });

      if (i + batchSize < validChanges.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setPendingChanges(new Map(pendingChangesRef.current));
    setHasUnsavedChanges(pendingChangesRef.current.size > 0);
    setIsSaving(false);
  }, []);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const reorderSequencesInDay = useCallback(
    (workOrders: IFabricacionConHoras[], targetDay: string, targetLine: string): IFabricacionConHoras[] => {
      const wosInDay = workOrders
        .filter((wo) => wo.Fch_Objetivo === targetDay && wo.Linea === targetLine)
        .sort((a, b) => a.Secuencia - b.Secuencia);

      const resequencedWOs = wosInDay.map((wo, index) => ({
        ...wo,
        Secuencia: index + 1,
      }));

      const otherWOs = workOrders.filter(
        (wo) => !(wo.Fch_Objetivo === targetDay && wo.Linea === targetLine)
      );

      return [...otherWOs, ...resequencedWOs];
    },
    []
  );

  const handleWorkOrderDrop = useCallback(
    (targetDay: string, targetLine: string, insertBeforeWOId?: string, draggedItems?: string[]) => {
      const currentSelectedWOs = draggedItems || selectedWOs;
      
      // ✅ CORREGIDO: Usar dataRef.current en vez de data
      const currentData = dataRef.current;
      
      if (!currentData || !currentData.workOrders || currentData.workOrders.length === 0) {
        console.error('❌ [handleWorkOrderDrop] dataRef.current no está disponible:', {
          hasData: !!currentData,
          hasWorkOrders: !!(currentData && currentData.workOrders),
          workOrdersLength: currentData?.workOrders?.length || 0
        });
        return;
      }
      
      if (currentSelectedWOs.length === 0) {
        console.warn('⚠️ [handleWorkOrderDrop] No hay WOs seleccionadas para mover');
        return;
      }

      console.log('🎯 [handleWorkOrderDrop] RECIBIDO:', {
        targetDay,
        targetLine,
        insertBeforeWOId,
        draggedItems,
        dataWorkOrders: currentData.workOrders.length
      });

      setData((prevData) => {
        if (!prevData || !prevData.workOrders || prevData.workOrders.length === 0) {
          console.error('❌ [handleWorkOrderDrop] prevData inválido');
          return prevData; // ✅ Cambiado de null a prevData
        }

        let workOrdersSnapshot = [...prevData.workOrders];

        const draggedWOsData = currentSelectedWOs.map(id => {
          const wo = workOrdersSnapshot.find(w => w.NumWO === id);
          if (!wo) {
            console.warn(`⚠️ WO ${id} no encontrada en workOrdersSnapshot`);
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
          console.error('❌ No se encontraron WOs para mover');
          return prevData;
        }

        console.log('📦 WOs arrastradas:', draggedWOsData.map(w => w.NumWO));

        workOrdersSnapshot = workOrdersSnapshot.filter(wo => !currentSelectedWOs.includes(wo.NumWO));

        const existingWOsInTarget = workOrdersSnapshot
          .filter(wo => wo.Fch_Objetivo === targetDay && wo.Linea === targetLine)
          .sort((a, b) => a.Secuencia - b.Secuencia);

        let insertAtIndex = existingWOsInTarget.length;

        if (insertBeforeWOId) {
          const referenceWOIndex = existingWOsInTarget.findIndex(wo => wo.NumWO === insertBeforeWOId);
          if (referenceWOIndex !== -1) {
            insertAtIndex = referenceWOIndex;
            console.log(`📍 Insertando en índice ${insertAtIndex} (antes de ${insertBeforeWOId})`);
          } else {
            console.warn(`⚠️ WO de referencia ${insertBeforeWOId} no encontrada, insertando al final`);
          }
        }

        const finalOrderedWOs = [
          ...existingWOsInTarget.slice(0, insertAtIndex),
          ...draggedWOsData,
          ...existingWOsInTarget.slice(insertAtIndex)
        ];

        const resequencedWOs = finalOrderedWOs.map((wo, index) => ({
          ...wo,
          Secuencia: index + 1
        }));

        console.log('🔢 WOs resequenciadas:', resequencedWOs.map(w => `${w.NumWO}:seq${w.Secuencia}`));

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

        const changesToSchedule = new Map<string, WorkOrderChange>();

        if (Array.isArray(resequencedWOs) && resequencedWOs.length > 0) {
          resequencedWOs.forEach((finalWO) => {
            const original = draggedWOsData.find(d => d.NumWO === finalWO.NumWO);
            if (original &&
                (original.Fch_Objetivo_Prev !== finalWO.Fch_Objetivo ||
                 original.Secuencia_Prev !== finalWO.Secuencia ||
                 original.Linea_Prev !== finalWO.Linea)) {

              changesToSchedule.set(finalWO.NumWO, {
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
        }

        if (changesToSchedule.size > 0) {
          scheduleAutoSave(changesToSchedule);
          setHasUnsavedChanges(true);
        }

        setSelectedWOs([]);

        console.log('✅ Drop completado, total WOs:', workOrdersSnapshot.length);

        return {
          ...prevData,
          workOrders: workOrdersSnapshot,
        };
      });
    },
    [selectedWOs, reorderSequencesInDay, dataRef, scheduleAutoSave] // ✅ Añadido dataRef
  );

  const getWorkOrderCurrentState = useCallback(
    (woId: string): IFabricacionConHoras | undefined => {
      return data?.workOrders.find((wo) => wo.NumWO === woId);
    },
    [data]
  );

  const applyCapacityChanges = useCallback(
    (capacityChanges: CapacityChangeInfo[]) => {
      if (!capacityChanges || !Array.isArray(capacityChanges) || capacityChanges.length === 0) {
        return;
      }

      if (!data) {
        return;
      }

      setData((prevData) => {
        if (!prevData) return null;

        let updatedWorkOrders = [...prevData.workOrders];
        const affectedDates = new Set<string>();

        capacityChanges.forEach((change) => {
          if (change && change.affectedDates && Array.isArray(change.affectedDates)) {
            change.affectedDates.forEach((date) => affectedDates.add(date));
          }
        });

        affectedDates.forEach((date) => {
          capacityChanges
            .filter((change) => 
              change && 
              change.affectedDates && 
              Array.isArray(change.affectedDates) && 
              change.affectedDates.includes(date)
            )
            .forEach((change) => {
              if (change.line) {
                updatedWorkOrders = reorderSequencesInDay(
                  updatedWorkOrders,
                  date,
                  change.line
                );
              }
            });
        });

        return {
          ...prevData,
          workOrders: updatedWorkOrders,
        };
      });
    },
    [data, reorderSequencesInDay, setData]
  );

  const saveChanges = useCallback(async (): Promise<void> => {
    if (pendingChanges.size === 0) {
      return;
    }

    await executeBatchSave();
  }, [pendingChanges, executeBatchSave]);

  const discardChanges = useCallback(async (): Promise<void> => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    pendingChangesRef.current.clear();
    setPendingChanges(new Map());
    setHasUnsavedChanges(false);
  }, []);

  return {
    selectedWOs,
    setSelectedWOs,
    draggedWOs,
    setDraggedWOs,
    pendingChanges,
    hasUnsavedChanges,
    isSaving,
    saveChanges,
    discardChanges,
    handleWorkOrderDrop,
    getWorkOrderCurrentState,
    applyCapacityChanges,
    reorderSequencesInDay,
  };
};