import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { DetailTablesPanelProps } from './types';
import { openExpandedWindow } from './components/DetailModal';
import EquipmentTable from './components/EquipmentTable';
import ResizableDivider from './components/ResizableDivider';
import ComponentsTable from './components/ComponentsTable';
import { useFabricacionesConHoras } from "../../../hooks/UseFrabricacionesConHoras";
import { useResizablePanels } from './hooks/useResizablePanels';
import UseRowSelection from './hooks/useRowSelection';
import UseTableSync from './hooks/useTableSync';
import { useFabricacionesContext } from '../../../contexts/FabricacionesContext';
import { useComponentesDisponibilidad } from '../../../hooks/useComponentesDisponibilidad';
import { transformComponentesData, calcularConsumoSecuencial } from '../../../services/componentesService';
import { useCapacity } from '../../../contexts/CapacityContext';
import { useFabricacionesData, useFabricacionesActions } from '../../../contexts/FabricacionesContext';


const ENABLE_DEBUG_LOGS = false;

const DetailTablesPanel: React.FC<DetailTablesPanelProps & { lastUpdated?: Date }> = ({
  workOrders = [],
  availableWOs = [],
  selectedWorkOrderIds = [],
  availableComponents = [],
  componentAvailability = {},
  onReorderWO,
  workOrderColors,
  filteredFabrications = [],
  useFilteredData = false,
  defaultLineFilter = "S21",
  lastUpdated
}) => {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [lastModifiedDay, setLastModifiedDay] = useState<string | null>(null);
  const { dailyCapacities: capacity, workingDays } = useCapacity();

  const {
  fabricaciones: fabricacionesFromContext,
    hasPendingChanges
  } = useFabricacionesData();

  const {
    updateSingleFabricacion,
    onGanttOrdersChanged
  } = useFabricacionesActions();

  const {
    data: fabricacionesConHoras = [],
    isLoading: isFabricacionesLoading,
    error: fabricacionesError,
    refetch: refetchFabricaciones,
  } = useFabricacionesConHoras();

  const memoizedWorkingDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const allWorkingDays: string[] = [];
    
    let startDate = new Date(today);
    
    if (fabricacionesFromContext.length > 0) {
      const oldestDate = new Date(
        Math.min(...fabricacionesFromContext.map(f => {
          const woDate = new Date(f.Fch_Objetivo);
          woDate.setHours(0, 0, 0, 0);
          return woDate.getTime();
        }))
      );
      
      startDate = oldestDate < today ? oldestDate : today;
    }
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        allWorkingDays.push(`${year}-${month}-${day}`);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return allWorkingDays;
  }, [
    // ✅ OPTIMIZADO: Solo longitud, primer y último elemento
    fabricacionesFromContext.length,
    fabricacionesFromContext[0]?.Fch_Objetivo,
    fabricacionesFromContext[fabricacionesFromContext.length - 1]?.Fch_Objetivo
  ]);
  const dataToUse = useMemo(() => {
    if (useFilteredData && filteredFabrications.length > 0) {
      return filteredFabrications;
    }

    if (useFilteredData && filteredFabrications.length === 0 && fabricacionesFromContext.length > 0) {
      const contextFiltered = fabricacionesFromContext.filter(fab => {
        if (defaultLineFilter && defaultLineFilter.trim()) {
          return fab.Linea === defaultLineFilter;
        }
        return true;
      });
      
      return contextFiltered;
    }

    if (!useFilteredData && fabricacionesFromContext.length > 0) {
      return fabricacionesFromContext;
    }

    if (filteredFabrications.length > 0) {
      return filteredFabrications;
    }

    return fabricacionesConHoras;
  }, [fabricacionesFromContext, filteredFabrications, useFilteredData, fabricacionesConHoras, lastUpdated, defaultLineFilter]);

  const numWOsParaComponentes = useMemo(() => {
    return dataToUse.map(fab => fab.NumWO);
  }, [
    dataToUse.length,
    dataToUse[0]?.NumWO,
    dataToUse[dataToUse.length - 1]?.NumWO
  ]);

  const {
    componentes,
    isLoading: isComponentesLoading,
    error: componentesError,
    refetch: refetchComponentes
  } = useComponentesDisponibilidad({
    numWOs: numWOsParaComponentes,
    enabled: numWOsParaComponentes.length > 0,
    limit: 10
  });

  useEffect(() => {
    if (hasPendingChanges && dataToUse.length > 0) {
      const sortedByDate = [...dataToUse].sort((a, b) => 
        new Date(b.Fch_Objetivo).getTime() - new Date(a.Fch_Objetivo).getTime()
      );
      setLastModifiedDay(sortedByDate[0]?.Fch_Objetivo || null);
    }
  }, [hasPendingChanges, dataToUse]);

  const enrichedWorkOrders = useMemo(() => {
    if (!dataToUse.length) {
      return [];
    }

    const uniqueWOsMap = new Map<string, typeof dataToUse[0]>();
    
    dataToUse.forEach(fab => {
      uniqueWOsMap.set(fab.NumWO, fab);
    });
    
    const uniqueDataToUse = Array.from(uniqueWOsMap.values());

    const enriched = uniqueDataToUse.map((fab, index) => ({
      id: `wo_${index}`,
      numWO: fab.NumWO || '',
      equipo: fab.Equipo || '',
      secuencia: fab.Secuencia || 0,
      linea: fab.Linea || '',
      numDoc: fab.Numero_de_pedido || '',
      tipDoc: fab.Tipo_de_pedido || '',
      estadoWO: fab.Estado_WO === 1 ? 'Activo' :
                fab.Estado_WO === 2 ? 'En Proceso' :
                fab.Estado_WO === 3 ? 'Completado' :
                fab.Estado_WO === 0 ? 'Pendiente' :
                `Estado ${fab.Estado_WO || 'N/A'}`,
      fchObjetivo: fab.Fch_Objetivo || '',
      fchAcuse: fab.Fch_Acuse || '',
      fchAlbarAn: fab.Fch_Albaran || '',
      importe: fab.Importe || 0,
      cshTotal: parseFloat(fab.horas_totales_de_la_wo) || 0,
      paletInfo: { num_de_palet: null },
      originalIndex: index,
      _originalData: fab
    }));
    
    return enriched;
  }, [
    // ✅ OPTIMIZADO: Solo longitud y elementos clave
    dataToUse.length,
    dataToUse[0]?.NumWO,
    dataToUse[0]?.Secuencia,
    dataToUse[dataToUse.length - 1]?.NumWO,
    dataToUse[dataToUse.length - 1]?.Secuencia
  ]);

  const workOrdersSignature = useMemo(() => {
    if (enrichedWorkOrders.length === 0) return '';
    
    const first = enrichedWorkOrders[0];
    const last = enrichedWorkOrders[enrichedWorkOrders.length - 1];
    
    return `${enrichedWorkOrders.length}|${first?.numWO}-${first?.secuencia}|${last?.numWO}-${last?.secuencia}`;
  }, [
    enrichedWorkOrders.length,
    enrichedWorkOrders[0]?.numWO,
    enrichedWorkOrders[0]?.secuencia,
    enrichedWorkOrders[enrichedWorkOrders.length - 1]?.numWO,
    enrichedWorkOrders[enrichedWorkOrders.length - 1]?.secuencia
  ]);

  const componentesSignature = useMemo(() => {
    if (componentes.length === 0) return '';
    
    const hash = `${componentes.length}-${componentes[0]?.wo || ''}-${componentes[componentes.length - 1]?.wo || ''}`;
    
    return hash;
  }, [
    componentes.length,
    componentes[0]?.wo,
    componentes[componentes.length - 1]?.wo
  ]);

  const { componentesColumnas, componentesData } = useMemo(() => {
    if (!componentesSignature || enrichedWorkOrders.length === 0) {
      return {
        componentesColumnas: [],
        componentesData: {}
      };
    }

    const componentesConConsumo = calcularConsumoSecuencial(
      componentes,
      enrichedWorkOrders.map(wo => ({
        numWO: wo.numWO,
        linea: wo.linea
      }))
    );

    const { availableComponents, componentAvailability } = transformComponentesData(
      componentesConConsumo,
      enrichedWorkOrders.map(wo => wo.numWO) 
    );

    return {
      componentesColumnas: availableComponents,
      componentesData: componentAvailability
    };
  }, [componentesSignature, workOrdersSignature, componentes, enrichedWorkOrders]);

  const filteredWOIds = useMemo(() => {
    const ids = enrichedWorkOrders.map(wo => wo.id);
    return ids;
  }, [
    enrichedWorkOrders.length,
    enrichedWorkOrders[0]?.id,
    enrichedWorkOrders[enrichedWorkOrders.length - 1]?.id
  ]);

  const visibleWorkOrders = useMemo(() => {
    const visible = enrichedWorkOrders.filter(wo => filteredWOIds.includes(wo.id));
    return visible;
  }, [
    enrichedWorkOrders.length,
    filteredWOIds.length
  ]);

  const { containerRef, leftWidth, handleMouseDown } = useResizablePanels();

  const {
    selectedRows,
    handleRowSelection,
    setSelectedRows
  } = UseRowSelection({
    getOrderedWOIds: () => filteredWOIds,
    selectedWorkOrderIds,
    availableWOs
  });

  const {
    leftTableContainerRef,
    rightTableContainerRef,
    leftRowsRef,
    rightRowsRef
  } = UseTableSync({
    workOrders: enrichedWorkOrders,
    selectedWorkOrderIds,
    availableWOs,
    localOrderedWOIds: [],
    getOrderedWOIds: () => filteredWOIds
  });

  const handleReorderInTable = useCallback((draggedNumWOs: string[], targetNumWO: string) => {
    const targetFab = fabricacionesFromContext.find(f => f.NumWO === targetNumWO);
    if (!targetFab) {
      console.error('❌ Target no encontrado');
      return;
    }

    const targetDay = targetFab.Fch_Objetivo;
    const targetLine = targetFab.Linea;
    const draggedFabsOriginal = draggedNumWOs
      .map(numWO => fabricacionesFromContext.find(f => f.NumWO === numWO))
      .filter(Boolean);

    if (draggedFabsOriginal.length === 0) {
      console.error('❌ No se encontraron WOs arrastradas');
      return;
    }

    const draggedFabsUpdated = draggedFabsOriginal.map(fab => ({
      ...fab!,
      Fch_Objetivo: targetDay,
      Linea: targetLine
    }));

    const existingWosInTarget = fabricacionesFromContext
      .filter(f => 
        f.Fch_Objetivo === targetDay && 
        f.Linea === targetLine &&
        !draggedNumWOs.includes(f.NumWO)
      )
      .sort((a, b) => a.Secuencia - b.Secuencia);

    const targetIdx = existingWosInTarget.findIndex(f => f.NumWO === targetNumWO);
    if (targetIdx === -1) {
      console.error('❌ Target no encontrado en WOs del día');
      return;
    }

    const reordered = [
      ...existingWosInTarget.slice(0, targetIdx),
      ...draggedFabsUpdated,
      ...existingWosInTarget.slice(targetIdx)
    ];

    const resequencedTarget = reordered.map((f, i) => ({ ...f, Secuencia: i + 1 }));

    const originalLocations = new Set<string>();
    draggedFabsOriginal.forEach(fab => {
      const originalDay = fab!.Fch_Objetivo;
      const originalLine = fab!.Linea;
      if (originalDay !== targetDay || originalLine !== targetLine) {
        originalLocations.add(`${originalDay}|${originalLine}`);
      }
    });

    let allFabs = fabricacionesFromContext.filter(f => {
      if (draggedNumWOs.includes(f.NumWO)) return false;
      if (f.Fch_Objetivo === targetDay && f.Linea === targetLine) return false;
      return true;
    });

    allFabs.push(...resequencedTarget);

    originalLocations.forEach(locationKey => {
      const [day, line] = locationKey.split("|");
      
      const wosInOriginal = allFabs
        .filter(f => f.Fch_Objetivo === day && f.Linea === line)
        .sort((a, b) => a.Secuencia - b.Secuencia);
      
      const resequencedOriginal = wosInOriginal.map((f, i) => ({ ...f, Secuencia: i + 1 }));
      
      allFabs = allFabs.map(f => {
        const updated = resequencedOriginal.find(r => r.NumWO === f.NumWO);
        return updated || f;
      });
    });

    let finalFabs = allFabs;

    if (capacity.length > 0 && workingDays.length > 0) {      
      const normalizeDate = (date: string) => date.replace(' ', 'T').split('T')[0];
      const dropDate = normalizeDate(targetDay);
      const draggedSet = new Set(draggedNumWOs);
      
      const affectedDays = new Set<string>();
      affectedDays.add(dropDate);
      originalLocations.forEach(loc => {
        const [day] = loc.split('|');
        affectedDays.add(normalizeDate(day));
      });
      
      const minAffectedDay = Array.from(affectedDays).sort()[0];
      
      const wosBeforeAffected = allFabs.filter(wo => {
        if (wo.Linea !== targetLine) return true;
        const woDate = normalizeDate(wo.Fch_Objetivo);
        return woDate < minAffectedDay;
      });
      
      const wosToRedistribute = allFabs
        .filter(wo => {
          if (wo.Linea !== targetLine) return false;
          const woDate = normalizeDate(wo.Fch_Objetivo);
          return woDate >= minAffectedDay;
        })
        .sort((a, b) => {
          const dateCompare = new Date(normalizeDate(a.Fch_Objetivo)).getTime() - 
                             new Date(normalizeDate(b.Fch_Objetivo)).getTime();
          if (dateCompare !== 0) return dateCompare;
          return a.Secuencia - b.Secuencia;
        });
      
      const capacityByDay = new Map<string, number>();
      const dayUsage = new Map<string, number>();
      
      workingDays.forEach(day => {
        const dayCapacity = capacity.find(c => c.date === day && c.line === targetLine);
        const fallbackCapacity = capacity.find(c => c.line === targetLine)?.capacity || 8;
        capacityByDay.set(day, dayCapacity?.capacity || fallbackCapacity);
        dayUsage.set(day, 0);
      });
      
      wosBeforeAffected.forEach(wo => {
        if (wo.Linea !== targetLine) return;
        const woDate = normalizeDate(wo.Fch_Objetivo);
        if (workingDays.includes(woDate)) {
          const woHours = parseFloat(wo.horas_totales_de_la_wo) || 0;
          const currentUsage = dayUsage.get(woDate) || 0;
          dayUsage.set(woDate, currentUsage + woHours);
        }
      });
            
      const redistributed: typeof wosToRedistribute = [];
      let pushedCount = 0;
      
      wosToRedistribute.forEach((wo, idx) => {
        const woHours = parseFloat(wo.horas_totales_de_la_wo) || 0;
        let remainingHours = woHours;
        let assignedToDay: string | null = null;
        
        const originalWODate = normalizeDate(wo.Fch_Objetivo);
        const startDay = draggedSet.has(wo.NumWO) ? dropDate : originalWODate;
        
        let dayIndex = workingDays.findIndex(d => d === startDay);
        
        while (dayIndex < workingDays.length && remainingHours > 0) {
          const currentDay = workingDays[dayIndex];
          const dayCapacity = capacityByDay.get(currentDay) || 8;
          const dayUsed = dayUsage.get(currentDay) || 0;
          const availableCapacity = dayCapacity - dayUsed;
          
          if (availableCapacity > 0.01) {
            if (!assignedToDay) {
              assignedToDay = currentDay;
            }
            
            const hoursToUse = Math.min(remainingHours, availableCapacity);
            dayUsage.set(currentDay, dayUsed + hoursToUse);
            remainingHours -= hoursToUse;
            
            if (remainingHours <= 0.01) break;
          }
          
          dayIndex++;
        }
        
        if (assignedToDay) {
          if (assignedToDay !== originalWODate) pushedCount++;
          
          redistributed.push({
            ...wo,
            Fch_Objetivo: assignedToDay,
            Secuencia: idx + 1
          });
        } else {
          redistributed.push({ ...wo, Secuencia: idx + 1 });
          console.warn(`⚠️ WO ${wo.NumWO} no cabía`);
        }
      });
            
      const redistributedByDay = new Map<string, typeof redistributed>();
      redistributed.forEach(wo => {
        const day = normalizeDate(wo.Fch_Objetivo);
        if (!redistributedByDay.has(day)) {
          redistributedByDay.set(day, []);
        }
        redistributedByDay.get(day)!.push(wo);
      });
      
      const redistributedWithCorrectSeq: typeof redistributed = [];
      redistributedByDay.forEach((wosInDay) => {
        wosInDay.forEach((wo, dayIndex) => {
          redistributedWithCorrectSeq.push({
            ...wo,
            Secuencia: dayIndex + 1
          });
        });
      });
      
      const wosFromOtherLines = allFabs.filter(wo => wo.Linea !== targetLine);
      const redistributedNumWOs = new Set(redistributedWithCorrectSeq.map(w => w.NumWO));
      
      finalFabs = [
        ...wosFromOtherLines,
        ...wosBeforeAffected.filter(wo => wo.Linea === targetLine),
        ...redistributedWithCorrectSeq
      ];
      
    } else {
      console.log('Capacity NO disponible');
    }

    finalFabs.sort((a, b) => {
      const dateCompare = new Date(a.Fch_Objetivo).getTime() - new Date(b.Fch_Objetivo).getTime();
      if (dateCompare !== 0) return dateCompare;
      
      const lineCompare = a.Linea.localeCompare(b.Linea);
      if (lineCompare !== 0) return lineCompare;
      
      return a.Secuencia - b.Secuencia;
    });

    const contextoActualizado = fabricacionesFromContext.map(fabContext => {
      const fabModificada = finalFabs.find(f => f.NumWO === fabContext.NumWO);
      return fabModificada || fabContext;
    });

    onGanttOrdersChanged(contextoActualizado);
    refetchComponentes();

  }, [fabricacionesFromContext, onGanttOrdersChanged, capacity, workingDays, refetchComponentes]);

  const handleRowHover = (woId: string | null) => {
    setHoveredRowId(woId);
  };

  const handleExpandClick = () => {
    openExpandedWindow({
      filteredWOIds,
      workOrders: enrichedWorkOrders,
      availableComponents: componentesColumnas,
      componentAvailability: componentesData
    });
  };

  const handleRefreshData = () => {
    refetchFabricaciones();
    refetchComponentes();
  };

  if (!useFilteredData && isFabricacionesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Cargando fabricaciones con horas...</div>
      </div>
    );
  }

  if (!useFilteredData && fabricacionesError) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-red-500">Error al cargar fabricaciones: {fabricacionesError.message}</div>
        <button
          onClick={handleRefreshData}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full overflow-hidden relative" id="tables-container">
      {hasPendingChanges && (
        <div className="absolute top-0 left-0 right-0 bg-yellow-100 border-b border-yellow-400 text-yellow-800 px-4 py-2 text-sm z-20">
          ⚠️ Hay cambios pendientes
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 bg-blue-100 border-b border-blue-400 text-blue-800 px-4 py-2 text-sm z-20" style={{ marginTop: hasPendingChanges ? '40px' : '0' }}>
        {useFilteredData ? (
          <>🔍 Mostrando RESULTADOS FILTRADOS ({dataToUse.length} WOs)</>
        ) : (
          <>📋 Mostrando TODAS las líneas ({dataToUse.length} WOs)</>
        )}
        {lastModifiedDay && ` - Último cambio: ${lastModifiedDay}`}
      </div>

      <button
        className="absolute top-2 right-2 z-20 text-red-600 hover:text-red-800 transition-colors"
        onClick={handleExpandClick}
        title="Expandir en nueva ventana"
        style={{ marginTop: hasPendingChanges ? '80px' : '40px' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </button>

      <button
        className="absolute top-2 right-10 z-20 text-blue-600 hover:text-blue-800 transition-colors"
        onClick={handleRefreshData}
        title="Recargar datos"
        style={{ marginTop: hasPendingChanges ? '80px' : '40px' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      <div
        className="flex flex-col h-full overflow-hidden"
        style={{
          width: leftWidth,
          marginTop: hasPendingChanges ? '80px' : '40px'}}
      >
        <h3 className="font-medium p-2 bg-gray-100 flex-shrink-0 border-b">
          {useFilteredData ? 'Detalle Equipos - FILTRADO' : 'Detalle Equipos - TODAS LAS LÍNEAS'}
          <span className="text-xs text-gray-600 ml-2">
            - {filteredWOIds.length} WOs
          </span>
          {hasPendingChanges && (
            <span className="text-xs text-yellow-600 ml-2">
              ⚠️ Sin guardar
            </span>
          )}
        </h3>

        <div
          ref={leftTableContainerRef}
          className="flex-1 overflow-y-auto overflow-x-auto"
        >
          <EquipmentTable
            filteredWOIds={filteredWOIds}
            workOrders={visibleWorkOrders}
            refetchFabricaciones={refetchFabricaciones}
            hoveredRowId={hoveredRowId}
            selectedRows={selectedRows}
            onRowSelection={handleRowSelection}
            onRowHover={handleRowHover}
            onReorderInTable={handleReorderInTable}
          />
        </div>
      </div>

      <ResizableDivider onMouseDown={handleMouseDown} />
    <div
    className="flex flex-col h-full overflow-hidden"
    style={{
      width: `calc(100% - ${leftWidth} - 2px)`,
      marginTop: hasPendingChanges ? '80px' : '40px'
    }}
  >
    {componentesColumnas.length > 200 && (
      <div className="bg-yellow-50 border-b border-yellow-300 px-3 py-2 text-xs text-yellow-800 flex items-center gap-2">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <span className="font-medium">
          ⚠️ {componentesColumnas.length} columnas - Usa scroll horizontal o selecciona WOs específicas
        </span>
      </div>
    )}

    <h3 className="font-medium p-2 bg-gray-100 flex-shrink-0 border-b">
      Detalle Componentes
      <span className="text-xs text-gray-600 ml-2">
        - {componentesColumnas.length} artículos
      </span>
      {isComponentesLoading && (
        <span className="text-xs text-blue-600 ml-2">
          🔄 Cargando...
        </span>
      )}
      {componentesError && (
        <span className="text-xs text-red-600 ml-2">
          ❌ Error
        </span>
      )}
    </h3>

    <div
      ref={rightTableContainerRef}
      className="flex-1 overflow-y-auto overflow-x-auto"
    >
      <ComponentsTable
        workOrders={visibleWorkOrders}
        availableComponents={componentesColumnas}
        componentAvailability={componentesData}
        hoveredRowId={hoveredRowId}
        selectedRows={selectedRows}
        isDragging={false}
        draggedOverWO={null}
        rightRowsRef={rightRowsRef}
        onRowSelection={handleRowSelection}
        onRowHover={handleRowHover}
        onDragStart={() => {}}
        onDragOver={() => {}}
        onDragEnter={() => {}}
        onDragLeave={() => {}}
        onDrop={() => {}}
        onDragEnd={() => {}}
        isLoading={isComponentesLoading}
      />
    </div>
  </div>

  {selectedRows.size > 0 && (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
      {selectedRows.size} WO{selectedRows.size > 1 ? 's' : ''} seleccionada{selectedRows.size > 1 ? 's' : ''}
    </div>
  )}
</div>
);
};
export default DetailTablesPanel;