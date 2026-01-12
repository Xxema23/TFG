import { useState, useCallback, useRef, useEffect } from "react";
import { IFabricacionConHoras } from "../../../interfaces/IFabricacionConHoras";
import { GanttData, DailyCapacity, CapacityChangeInfo } from "./Types";
import { updateFabricacionConHoras } from "../../../services/FabricacionConHoras";

// ✅ FUNCIÓN PARA NORMALIZAR FECHAS - SOPORTA AMBOS FORMATOS
const normalizeDate = (date: string): string => {
  // Quitar la parte de la hora si existe (formato: "2026-01-13 00:00:00")
  // Y también funciona con ISO (formato: "2026-01-13T00:00:00")
  return date.split(' ')[0].split('T')[0];
};

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
        .filter((wo) => normalizeDate(wo.Fch_Objetivo) === normalizeDate(targetDay) && wo.Linea === targetLine)
        .sort((a, b) => a.Secuencia - b.Secuencia);

      const resequencedWOs = wosInDay.map((wo, index) => ({
        ...wo,
        Secuencia: index + 1,
      }));

      const otherWOs = workOrders.filter(
        (wo) => !(normalizeDate(wo.Fch_Objetivo) === normalizeDate(targetDay) && wo.Linea === targetLine)
      );

      return [...otherWOs, ...resequencedWOs];
    },
    []
  );

  const handleWorkOrderDrop = useCallback(
    (targetDay: string, targetLine: string, insertBeforeWOId?: string, draggedItems?: string[]) => {
      const currentSelectedWOs = draggedItems || selectedWOs;
      
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
        draggedItems: currentSelectedWOs,
        dataWorkOrders: currentData.workOrders.length
      });

      setData((prevData) => {
        if (!prevData || !prevData.workOrders || prevData.workOrders.length === 0) {
          console.error('❌ [handleWorkOrderDrop] prevData inválido');
          return prevData;
        }

        let workOrdersSnapshot = [...prevData.workOrders];

        // ========================================
        // 1️⃣ PREPARAR WOs ARRASTRADAS
        // ========================================
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

        console.log('📦 WOs arrastradas:', draggedWOsData.map(w => `${w.NumWO} (${w.Fch_Objetivo_Prev.split('T')[0]} → ${targetDay.split('T')[0]})`));

        // ========================================
        // 2️⃣ REMOVER WOs ARRASTRADAS DEL SNAPSHOT
        // ========================================
        workOrdersSnapshot = workOrdersSnapshot.filter(wo => !currentSelectedWOs.includes(wo.NumWO));

        // ========================================
        // 3️⃣ REORDENAR EN DÍA OBJETIVO (SIN CAPACITY)
        // ========================================
        const existingWOsInTarget = workOrdersSnapshot
          .filter(wo => normalizeDate(wo.Fch_Objetivo) === normalizeDate(targetDay) && wo.Linea === targetLine)
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

        // ✅ CAMBIO 1: Asignar secuencia temporal para el sort estable posterior
        let resequencedWOs = finalOrderedWOs.map((wo, index) => ({
          ...wo,
          Secuencia: index + 1,
          _tempSequence: index + 1  // ⬅️ Secuencia temporal para sort estable
        }));

        console.log('🔢 WOs resequenciadas (SIN aplicar capacity - drag manual):', resequencedWOs.map(w => `${w.NumWO}:seq${w.Secuencia}`));

        // ========================================
        // 4️⃣ ✅ RESEQUENCIAR TODAS LAS WOs AFECTADAS
        // ========================================
        // Eliminar las WOs del día objetivo del snapshot
        workOrdersSnapshot = workOrdersSnapshot.filter(wo =>
          !(normalizeDate(wo.Fch_Objetivo) === normalizeDate(targetDay) && wo.Linea === targetLine)
        );

        // Agregar las WOs redistribuidas
        workOrdersSnapshot.push(...resequencedWOs);

        // ✅ CRÍTICO: RESEQUENCIAR **TODAS** LAS WOs EN LOS DÍAS AFECTADOS
        const affectedDays = new Set<string>();
        
        // Días donde ahora hay WOs redistribuidas
        resequencedWOs.forEach(wo => {
          affectedDays.add(normalizeDate(wo.Fch_Objetivo));
        });
        
        // Días originales de donde se movieron las WOs
        draggedWOsData.forEach(wo => {
          const originalDay = normalizeDate(wo.Fch_Objetivo_Prev);
          if (originalDay !== normalizeDate(targetDay) || wo.Linea_Prev !== targetLine) {
            affectedDays.add(originalDay);
          }
        });

        console.log('🔄 Días afectados a resequenciar:', Array.from(affectedDays));

        // ✅ CAMBIO 2: Sort ESTABLE con tiebreaker
        affectedDays.forEach(day => {
          const wosInDay = workOrdersSnapshot
            .filter(wo => normalizeDate(wo.Fch_Objetivo) === day && wo.Linea === targetLine)
            .sort((a, b) => {
              // Primero ordenar por Secuencia
              if (a.Secuencia !== b.Secuencia) {
                return a.Secuencia - b.Secuencia;
              }
              
              // Si tienen la misma Secuencia, usar _tempSequence como tiebreaker
              const aTemp = (a as any)._tempSequence || 0;
              const bTemp = (b as any)._tempSequence || 0;
              if (aTemp !== bTemp) {
                return aTemp - bTemp;
              }
              
              // Si aún son iguales, usar NumWO alfabéticamente
              return a.NumWO.localeCompare(b.NumWO);
            });
          
          console.log(`  📋 WOs en día ${day} ANTES de resequenciar:`, wosInDay.map(w => `${w.NumWO}:seq${w.Secuencia}`).join(', '));
          
          const resequenced = wosInDay.map((wo, idx) => {
            const { _tempSequence, ...cleanWO } = wo as any;  // Eliminar _tempSequence
            return {
              ...cleanWO,
              Secuencia: idx + 1
            };
          });
          
          console.log(`  📋 WOs en día ${day} DESPUÉS de resequenciar:`, resequenced.map(w => `${w.NumWO}:seq${w.Secuencia}`).join(', '));
          
          // Actualizar en el snapshot
          workOrdersSnapshot = workOrdersSnapshot.map(wo => {
            const updated = resequenced.find(r => r.NumWO === wo.NumWO);
            return updated || wo;
          });
          
          console.log(`  🔢 ${day}: ${resequenced.length} WOs resequenciadas`);
        });

        // ========================================
        // 6️⃣ PROGRAMAR GUARDADO
        // ========================================
        const changesToSchedule = new Map<string, WorkOrderChange>();

        // Detectar cambios en WOs movidas
        draggedWOsData.forEach(original => {
          const final = workOrdersSnapshot.find(wo => wo.NumWO === original.NumWO);
          if (final &&
              (original.Fch_Objetivo_Prev !== final.Fch_Objetivo ||
               original.Secuencia_Prev !== final.Secuencia ||
               original.Linea_Prev !== final.Linea)) {

            changesToSchedule.set(final.NumWO, {
              NumWO: final.NumWO,
              originalFch_Objetivo: original.Fch_Objetivo_Prev,
              originalSecuencia: original.Secuencia_Prev,
              originalLinea: original.Linea_Prev,
              newFch_Objetivo: final.Fch_Objetivo,
              newSecuencia: final.Secuencia,
              newLinea: final.Linea,
            });
          }
        });

        // ✅ DETECTAR CAMBIOS EN WOs DESPLAZADAS (las que estaban en los días afectados)
        affectedDays.forEach(day => {
          workOrdersSnapshot
            .filter(wo => normalizeDate(wo.Fch_Objetivo) === day && wo.Linea === targetLine)
            .forEach(wo => {
              // Buscar la WO original en prevData
              const originalWO = prevData.workOrders.find(orig => orig.NumWO === wo.NumWO);
              if (originalWO && 
                  (originalWO.Fch_Objetivo !== wo.Fch_Objetivo ||
                   originalWO.Secuencia !== wo.Secuencia ||
                   originalWO.Linea !== wo.Linea)) {
                
                changesToSchedule.set(wo.NumWO, {
                  NumWO: wo.NumWO,
                  originalFch_Objetivo: originalWO.Fch_Objetivo,
                  originalSecuencia: originalWO.Secuencia,
                  originalLinea: originalWO.Linea,
                  newFch_Objetivo: wo.Fch_Objetivo,
                  newSecuencia: wo.Secuencia,
                  newLinea: wo.Linea,
                });
              }
            });
        });

        console.log('💾 Cambios detectados:', changesToSchedule.size, 'WOs');

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
    [selectedWOs, reorderSequencesInDay, dataRef, scheduleAutoSave, workingDays, setData]
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