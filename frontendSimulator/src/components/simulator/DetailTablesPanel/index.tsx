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
// 🆕 Imports para aplicar capacidad
import { recalculateAffectedWorkOrders, getWeekNumber, DEFAULT_INITIAL_CAPACITY } from '../../ganttWOs/useGanttHooks/UseGanttHooks';
import { CapacityData } from '../../../interfaces/Capacity';
import { getCapacities } from '../../../services/CapacityService';

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
  
  // 🆕 Estado para capacity (para aplicar restricciones en drag & drop)
  const [capacity, setCapacity] = useState<any[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [capacityLoaded, setCapacityLoaded] = useState(false);

  const {
    fabricaciones: fabricacionesFromContext,
    updateSingleFabricacion,
    onGanttOrdersChanged,
    hasPendingChanges
  } = useFabricacionesContext();

  const {
    data: fabricacionesConHoras = [],
    isLoading: isFabricacionesLoading,
    error: fabricacionesError,
    refetch: refetchFabricaciones,
  } = useFabricacionesConHoras();

  const dataToUse = useMemo(() => {
    console.log('🔍 [dataToUse] Evaluando:', {
      contextLength: fabricacionesFromContext.length,
      filteredLength: filteredFabrications.length,
      hookLength: fabricacionesConHoras.length,
      useFilteredData,
      defaultLineFilter,
      lastUpdated: lastUpdated?.toISOString()
    });

    // ✅ PRIORIDAD 1: Si hay filtros activos Y hay datos filtrados
    if (useFilteredData && filteredFabrications.length > 0) {
      console.log('✅ Usando filteredFabrications (filtros activos):', filteredFabrications.length);
      return filteredFabrications;
    }

    // ✅ PRIORIDAD 2: Si hay filtros pero resultado vacío → filtrar contexto manualmente
    if (useFilteredData && filteredFabrications.length === 0 && fabricacionesFromContext.length > 0) {
      console.log('⚠️ Filtradas vacío, aplicando filtro de línea al contexto...');
      
      const contextFiltered = fabricacionesFromContext.filter(fab => {
        if (defaultLineFilter && defaultLineFilter.trim()) {
          return fab.Linea === defaultLineFilter;
        }
        return true;
      });
      
      console.log(`✅ Contexto filtrado por línea ${defaultLineFilter}:`, contextFiltered.length);
      return contextFiltered;
    }

    // ✅ PRIORIDAD 3: Si NO hay filtros → usar contexto completo
    if (!useFilteredData && fabricacionesFromContext.length > 0) {
      console.log('✅ Usando fabricacionesFromContext (sin filtros):', fabricacionesFromContext.length);
      return fabricacionesFromContext;
    }

    // ✅ PRIORIDAD 4: Fallback a filtradas
    if (filteredFabrications.length > 0) {
      console.log('⚠️ Usando filteredFabrications (fallback):', filteredFabrications.length);
      return filteredFabrications;
    }

    // ✅ PRIORIDAD 5: Hook (inicial)
    console.log('✅ Usando datos del hook:', fabricacionesConHoras.length);
    return fabricacionesConHoras;
  }, [fabricacionesFromContext, filteredFabrications, useFilteredData, fabricacionesConHoras, lastUpdated, defaultLineFilter]);

  useEffect(() => {
    if (hasPendingChanges && dataToUse.length > 0) {
      const sortedByDate = [...dataToUse].sort((a, b) => 
        new Date(b.Fch_Objetivo).getTime() - new Date(a.Fch_Objetivo).getTime()
      );
      setLastModifiedDay(sortedByDate[0]?.Fch_Objetivo || null);
    }
  }, [hasPendingChanges, dataToUse]);

  // 🆕 Cargar capacity y workingDays para aplicar restricciones
  useEffect(() => {
    const convertWeeklyToDaily = (
      weeklyCapacities: CapacityData[], 
      workingDaysArray: string[]
    ): any[] => {
      const dailyCapacities: any[] = [];
      const capacityMap = new Map<string, number>();

      // Mapear capacidades semanales
      weeklyCapacities.forEach(capacity => {
        const key = `${capacity.line}-${capacity.week}-${capacity.year}`;
        capacityMap.set(key, capacity.value);
      });

      // Obtener todas las líneas únicas
      const allLines = Array.from(new Set([
        ...weeklyCapacities.map(c => c.line),
        ...fabricacionesFromContext.map(wo => wo.Linea)
      ]));

      // Generar capacidades diarias SOLO para días laborables (lun-vie)
      workingDaysArray.forEach(day => {
        // 🆕 CRÍTICO: Usar fecha local en lugar de UTC para evitar problemas de zona horaria
        const [year, month, dayNum] = day.split('-').map(Number);
        const date = new Date(year, month - 1, dayNum); // Fecha local
        const dayOfWeek = date.getDay();
        
        // 🆕 CRÍTICO: Excluir sábados (6) y domingos (0)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          console.warn(`⚠️ [convertWeeklyToDaily] Día ${day} es fin de semana (dow=${dayOfWeek}), OMITIDO`);
          return; // Skip este día
        }
        
        const week = getWeekNumber(date);

        allLines.forEach(line => {
          const key = `${line}-${week}-${year}`;
          const weeklyCapacity = capacityMap.get(key);
          
          const dailyCapacity = weeklyCapacity !== undefined 
            ? weeklyCapacity 
            : DEFAULT_INITIAL_CAPACITY;

          dailyCapacities.push({
            line,
            date: day, // ✅ Mantener formato original (sin 00:00:00)
            capacity: dailyCapacity
          });
        });
      });

      return dailyCapacities;
    };

    const generateCompleteWorkingDays = (fabricaciones: any[]): string[] => {
      console.log('🚀🚀🚀 [generateCompleteWorkingDays] INICIO - Fabricaciones:', fabricaciones.length);
      
      if (fabricaciones.length === 0) {
        console.log('❌ [generateCompleteWorkingDays] Sin fabricaciones, retornando []');
        return [];
      }

      // ✅ Obtener rango de fechas (min y max)
      const dates = fabricaciones
        .map(fab => new Date(fab.Fch_Objetivo))
        .filter(date => !isNaN(date.getTime()));

      console.log('📅 [generateCompleteWorkingDays] Fechas válidas extraídas:', dates.length);

      if (dates.length === 0) {
        console.log('❌ [generateCompleteWorkingDays] Sin fechas válidas, retornando []');
        return [];
      }

      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      // 🆕 Añadir margen de 4 semanas DESPUÉS para capacity redistribution
      maxDate.setDate(maxDate.getDate() + 28);

      console.log('📊 [generateCompleteWorkingDays] Rango de fechas:', {
        min: minDate.toISOString().split('T')[0],
        max: maxDate.toISOString().split('T')[0]
      });

      // ✅ Generar TODOS los días laborables entre min y max (lun-vie)
      const allWorkingDays: string[] = [];
      const currentDate = new Date(minDate);

      while (currentDate <= maxDate) {
        const dayOfWeek = currentDate.getDay();
        
        // ✅ Incluir solo días laborables (lun=1, mar=2, mié=3, jue=4, vie=5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          // ✅ Formato local: YYYY-MM-DD (evitar problemas de UTC)
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
          const day = String(currentDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          allWorkingDays.push(dateStr);
        }

        // Avanzar al siguiente día
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log('✅✅✅ [generateCompleteWorkingDays] COMPLETADO:', {
        total: allWorkingDays.length,
        desde: allWorkingDays[0],
        hasta: allWorkingDays[allWorkingDays.length - 1],
        primeros20: allWorkingDays.slice(0, 20)
      });

      return allWorkingDays;
    };

    const loadCapacityData = async () => {
      try {
        console.log('🔄 [DetailTablesPanel] Cargando capacity...');
        
        if (fabricacionesFromContext.length > 0) {
          console.log('🎯 [loadCapacityData] Llamando a generateCompleteWorkingDays con', fabricacionesFromContext.length, 'fabricaciones');
          
          // ✅ Generar working days COMPLETO (todos los días laborables)
          const sortedDays = generateCompleteWorkingDays(fabricacionesFromContext);
          
          console.log('🎯 [loadCapacityData] generateCompleteWorkingDays retornó:', sortedDays.length, 'días');
          console.log('🎯 [loadCapacityData] Primeros 20 días:', sortedDays.slice(0, 20));
          
          setWorkingDays(sortedDays);
          
          // Cargar capacidades semanales desde el servicio
          const currentYear = new Date().getFullYear();
          const weeklyCapacities = await getCapacities(1, currentYear);
          
          console.log('📊 [DetailTablesPanel] Capacidades semanales cargadas:', weeklyCapacities.length);
          
          // Convertir capacidades semanales a diarias
          const dailyCapacities = convertWeeklyToDaily(weeklyCapacities, sortedDays);
          
          setCapacity(dailyCapacities);
          console.log('✅ [DetailTablesPanel] Capacity diaria generada:', dailyCapacities.length, 'entradas');
          
          // 🔍 DEBUG: Ver capacities de S21
          const s21Capacities = dailyCapacities.filter(c => c.line === 'S21');
          console.log('🔍 [DEBUG] TODAS las capacities de S21:', s21Capacities.length, 'días');
          s21Capacities.forEach((c, i) => {
            console.log(`   ${i}: ${c.date} → ${c.capacity} horas`);
          });

          const uniqueDatesS21 = [...new Set(s21Capacities.map(c => c.date))].sort();
          console.log('📅 [DEBUG] Días únicos con capacity S21:', uniqueDatesS21);
        }
        
        setCapacityLoaded(true);
      } catch (error) {
        console.error('❌ [DetailTablesPanel] Error cargando capacity:', error);
        setCapacityLoaded(false);
      }
    };

    if (fabricacionesFromContext.length > 0 && !capacityLoaded) {
      loadCapacityData();
    }
  }, [fabricacionesFromContext.length, capacityLoaded]);

  // 🆕 SOLUCIÓN SIMPLE: Permitir recarga manual de capacity
  // Si capacityLoaded es true pero capacity está vacía, resetear para recargar
  useEffect(() => {
    if (capacityLoaded && capacity.length === 0 && fabricacionesFromContext.length > 0) {
      console.log('⚠️ [DetailTablesPanel] Capacity vacía detectada, permitiendo recarga...');
      setCapacityLoaded(false);
    }
  }, [capacityLoaded, capacity.length, fabricacionesFromContext.length]);

  const enrichedWorkOrders = useMemo(() => {
    if (!dataToUse.length) {
      console.log('⚠️ [enrichedWorkOrders] dataToUse vacío');
      return [];
    }

    // ✅ PRIMERO: Ordenar dataToUse por fecha y secuencia
    const sortedData = [...dataToUse].sort((a, b) => {
      // Ordenar por fecha (más antigua primero)
      const dateA = new Date(a.Fch_Objetivo).getTime();
      const dateB = new Date(b.Fch_Objetivo).getTime();
      
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      
      // Si misma fecha, ordenar por línea
      const lineCompare = (a.Linea || '').localeCompare(b.Linea || '');
      if (lineCompare !== 0) {
        return lineCompare;
      }
      
      // Si misma línea, ordenar por secuencia
      return (a.Secuencia || 0) - (b.Secuencia || 0);
    });

    // ✅ LUEGO: Crear enriched desde datos ordenados
    const enriched = sortedData.map((fab, index) => ({
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

    console.log('📊 [enrichedWorkOrders] Creados y ORDENADOS:', {
      total: enriched.length,
      primeros10: enriched.slice(0, 10).map(w => ({ 
        id: w.id, 
        numWO: w.numWO, 
        linea: w.linea, 
        seq: w.secuencia,
        fecha: w.fchObjetivo 
      })),
      distribucionPorFecha: enriched.reduce((acc, w) => {
        const fecha = w.fchObjetivo?.split('T')[0] || w.fchObjetivo;
        acc[fecha] = (acc[fecha] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });
    
    return enriched;
  }, [dataToUse]);

  const filteredWOIds = useMemo(() => {
    const ids = enrichedWorkOrders.map(wo => wo.id);
    console.log('🔢 [filteredWOIds]:', {
      total: enrichedWorkOrders.length,
      idsGenerados: ids.length
    });
    return ids;
  }, [enrichedWorkOrders]);

  const visibleWorkOrders = useMemo(() => {
    const visible = enrichedWorkOrders.filter(wo => filteredWOIds.includes(wo.id));
    console.log('👀 [visibleWorkOrders]:', {
      totalEnriched: enrichedWorkOrders.length,
      filteredIds: filteredWOIds.length,
      visibleResult: visible.length,
      primeros3Visible: visible.slice(0, 3).map(w => ({ 
        id: w.id, 
        numWO: w.numWO, 
        seq: w.secuencia,
        fecha: w.fchObjetivo 
      }))
    });
    return visible;
  }, [enrichedWorkOrders, filteredWOIds]);

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
    console.log('🔄 [REORDEN TABLE] Inicio:', { 
      draggedNumWOs, 
      targetNumWO,
      contextLength: fabricacionesFromContext.length,
      capacityLoaded,
      capacityLength: capacity.length,
      workingDaysLength: workingDays.length
    });

    const targetFab = fabricacionesFromContext.find(f => f.NumWO === targetNumWO);
    if (!targetFab) {
      console.error('❌ Target no encontrado en contexto:', targetNumWO);
      return;
    }

    const targetDay = targetFab.Fch_Objetivo;
    const targetLine = targetFab.Linea;

    console.log('📍 Target encontrado:', {
      NumWO: targetNumWO,
      Linea: targetLine,
      Dia: targetDay,
      Secuencia: targetFab.Secuencia
    });

    const draggedFabsOriginal = draggedNumWOs
      .map(numWO => fabricacionesFromContext.find(f => f.NumWO === numWO))
      .filter(Boolean);

    console.log('🎯 WOs arrastradas encontradas:', draggedFabsOriginal.length);
    draggedFabsOriginal.forEach(fab => {
      console.log(`   - ${fab!.NumWO}: Día ${fab!.Fch_Objetivo}, Seq ${fab!.Secuencia}, Línea ${fab!.Linea}`);
    });

    if (draggedFabsOriginal.length === 0) {
      console.error('❌ No se encontraron las WOs arrastradas en el contexto');
      return;
    }

    const draggedFabsUpdated = draggedFabsOriginal.map(fab => ({
      ...fab!,
      Fch_Objetivo: targetDay,
      Linea: targetLine
    }));

    console.log('📅 Cambiando WOs arrastradas al día/línea:', targetDay, targetLine);

    const existingWosInTarget = fabricacionesFromContext
      .filter(f => 
        f.Fch_Objetivo === targetDay && 
        f.Linea === targetLine &&
        !draggedNumWOs.includes(f.NumWO)
      )
      .sort((a, b) => a.Secuencia - b.Secuencia);

    console.log('📦 WOs ya en día/línea target:', existingWosInTarget.map(w => `${w.NumWO}:${w.Secuencia}`));

    const targetIdx = existingWosInTarget.findIndex(f => f.NumWO === targetNumWO);
    if (targetIdx === -1) {
      console.error('❌ Target no encontrado en WOs del día');
      return;
    }

    console.log('📌 Insertando en índice:', targetIdx);

    const reordered = [
      ...existingWosInTarget.slice(0, targetIdx),
      ...draggedFabsUpdated,
      ...existingWosInTarget.slice(targetIdx)
    ];

    const resequencedTarget = reordered.map((f, i) => ({ ...f, Secuencia: i + 1 }));

    console.log('✅ Nuevas secuencias en día target:', resequencedTarget.map(f => `${f.NumWO}:${f.Secuencia}`));

    const originalLocations = new Set<string>();
    draggedFabsOriginal.forEach(fab => {
      const originalDay = fab!.Fch_Objetivo;
      const originalLine = fab!.Linea;
      if (originalDay !== targetDay || originalLine !== targetLine) {
        originalLocations.add(`${originalDay}|${originalLine}`);
      }
    });

    console.log('🔄 Días/líneas originales a reordenar:', Array.from(originalLocations));

    let allFabs = fabricacionesFromContext.filter(f => {
      if (draggedNumWOs.includes(f.NumWO)) return false;
      if (f.Fch_Objetivo === targetDay && f.Linea === targetLine) return false;
      return true;
    });

    console.log('🗑️ Después de remover involucradas:', allFabs.length);

    allFabs.push(...resequencedTarget);

    console.log('➕ Después de agregar reordenadas:', allFabs.length);

    originalLocations.forEach(locationKey => {
      const [day, line] = locationKey.split("|");
      
      const wosInOriginal = allFabs
        .filter(f => f.Fch_Objetivo === day && f.Linea === line)
        .sort((a, b) => a.Secuencia - b.Secuencia);
      
      const resequencedOriginal = wosInOriginal.map((f, i) => ({ ...f, Secuencia: i + 1 }));
      
      console.log(`   Reordenando ${day}|${line}:`, resequencedOriginal.map(f => `${f.NumWO}:${f.Secuencia}`));
      
      allFabs = allFabs.map(f => {
        const updated = resequencedOriginal.find(r => r.NumWO === f.NumWO);
        return updated || f;
      });
    });

    // 🆕 APLICAR CAPACITY RESPETANDO ORDEN MANUAL
    let finalFabs = allFabs;
    
    if (capacityLoaded && capacity.length > 0 && workingDays.length > 0) {
      console.log('🎯 [REORDEN TABLE] Aplicando CAPACITY (respetando orden manual)...');
      
      // 🆕 SOLO redistribuir desde el día del drop en adelante
      const dropDate = targetDay.split('T')[0]; // Día donde se soltó la WO
      
      console.log('📍 [REORDEN TABLE] Día del drop:', dropDate);
      
      // 🆕 Obtener WOs de la línea desde el día del drop en adelante
      const wosToRedistribute = allFabs
        .filter(wo => {
          if (wo.Linea !== targetLine) return false;
          const woDate = wo.Fch_Objetivo.split('T')[0];
          return woDate >= dropDate; // Solo desde el día del drop en adelante
        })
        .sort((a, b) => {
          const dateCompare = new Date(a.Fch_Objetivo).getTime() - new Date(b.Fch_Objetivo).getTime();
          if (dateCompare !== 0) return dateCompare;
          return a.Secuencia - b.Secuencia;
        });
      
      // 🆕 Obtener WOs ANTERIORES al drop que NO se tocarán
      const wosBeforeDrop = allFabs.filter(wo => {
        if (wo.Linea !== targetLine) return true; // Otras líneas no se tocan
        const woDate = wo.Fch_Objetivo.split('T')[0];
        return woDate < dropDate; // Anteriores al drop no se tocan
      });
      
      console.log('📦 [REORDEN TABLE] WOs a redistribuir (desde', dropDate, '):', wosToRedistribute.length);
      console.log('   Orden:', wosToRedistribute.map(w => `${w.NumWO}:${w.Fch_Objetivo.split('T')[0]}:seq${w.Secuencia}`));
      console.log('🔒 [REORDEN TABLE] WOs anteriores intactas:', wosBeforeDrop.length);
      
      // 🆕 Crear mapa de capacity por día
      const capacityByDay = new Map<string, number>();
      const dayUsage = new Map<string, number>();
      
      workingDays.forEach(day => {
        const dayCapacity = capacity.find(c => c.date === day && c.line === targetLine);
        capacityByDay.set(day, dayCapacity?.capacity || DEFAULT_INITIAL_CAPACITY);
        dayUsage.set(day, 0);
      });
      
      // 🆕 CALCULAR capacity ya usada en días ANTERIORES al drop
      wosBeforeDrop.forEach(wo => {
        if (wo.Linea !== targetLine) return;
        
        const woDate = wo.Fch_Objetivo.split('T')[0];
        const woHours = parseFloat(wo.horas_totales_de_la_wo) || 0;
        const currentUsage = dayUsage.get(woDate) || 0;
        dayUsage.set(woDate, currentUsage + woHours);
      });
      
      console.log('📊 [REORDEN TABLE] Capacity pre-usada:', 
        Array.from(dayUsage.entries())
          .filter(([_, usage]) => usage > 0)
          .map(([day, usage]) => `${day}:${usage.toFixed(2)}h`)
      );
      
      // 🆕 Redistribuir WOs desde el día del drop
      const redistributed: typeof wosToRedistribute = [];
      
      // Empezar desde el día del drop
      let currentDayIndex = workingDays.findIndex(d => d === dropDate);
      
      if (currentDayIndex === -1) {
        currentDayIndex = workingDays.findIndex(d => d >= dropDate);
      }
      
      console.log('📅 [REORDEN TABLE] Iniciando redistribución desde:', workingDays[currentDayIndex]);
      
      wosToRedistribute.forEach((wo, idx) => {
        const woHours = parseFloat(wo.horas_totales_de_la_wo) || 0;
        let remainingHours = woHours;
        let assignedToDay: string | null = null;
        
        console.log(`   🔧 Procesando ${wo.NumWO} (${woHours.toFixed(2)}h)...`);
        
        // Buscar día con capacity disponible DESDE currentDayIndex
        while (currentDayIndex < workingDays.length && remainingHours > 0) {
          const currentDay = workingDays[currentDayIndex];
          const dayCapacity = capacityByDay.get(currentDay) || DEFAULT_INITIAL_CAPACITY;
          const dayUsed = dayUsage.get(currentDay) || 0;
          const availableCapacity = dayCapacity - dayUsed;
          
          if (availableCapacity > 0.01) { // Margen de error de 0.01h
            // Asignar WO a este día
            if (!assignedToDay) {
              assignedToDay = currentDay;
            }
            
            const hoursToUse = Math.min(remainingHours, availableCapacity);
            dayUsage.set(currentDay, dayUsed + hoursToUse);
            remainingHours -= hoursToUse;
            
            console.log(`      Día ${currentDay}: usa ${hoursToUse.toFixed(2)}h, quedan ${(availableCapacity - hoursToUse).toFixed(2)}h`);
            
            if (remainingHours <= 0.01) { // Margen de error
              // WO completamente asignada
              // NO avanzar currentDayIndex - la siguiente WO puede empezar en el mismo día si queda capacity
              break;
            }
          }
          
          // Si el día está lleno, avanzar al siguiente
          currentDayIndex++;
        }
        
        if (assignedToDay) {
          redistributed.push({
            ...wo,
            Fch_Objetivo: assignedToDay,
            Secuencia: idx + 1
          });
          console.log(`      ✅ ${wo.NumWO} → ${assignedToDay} (seq ${idx + 1})`);
        } else {
          // Si no se pudo asignar, mantener en su día original
          console.warn(`      ⚠️ ${wo.NumWO} no pudo ser asignada (sin capacity), manteniéndola en ${wo.Fch_Objetivo.split('T')[0]}`);
          redistributed.push({
            ...wo,
            Secuencia: idx + 1
          });
        }
        
        // 🆕 CRÍTICO: NO resetear currentDayIndex
        // Ya está en la posición correcta para la siguiente WO
      });
      
      console.log('✅ [REORDEN TABLE] Redistribución completada:', redistributed.length, 'WOs');
      
      // 🆕 RECALCULAR SECUENCIAS POR DÍA (no usar índice global)
      const redistributedByDay = new Map<string, typeof redistributed>();
      redistributed.forEach(wo => {
        const day = wo.Fch_Objetivo.split('T')[0];
        if (!redistributedByDay.has(day)) {
          redistributedByDay.set(day, []);
        }
        redistributedByDay.get(day)!.push(wo);
      });
      
      // Reasignar secuencias correctas por día
      const redistributedWithCorrectSeq: typeof redistributed = [];
      redistributedByDay.forEach((wosInDay, day) => {
        wosInDay.forEach((wo, dayIndex) => {
          redistributedWithCorrectSeq.push({
            ...wo,
            Secuencia: dayIndex + 1  // Secuencia dentro del día
          });
          console.log(`      🔢 ${wo.NumWO} día ${day}: secuencia ${dayIndex + 1}`);
        });
      });
      
      console.log('✅ [REORDEN TABLE] Secuencias corregidas por día');
      
      // Combinar WOs anteriores (intactas) + WOs redistribuidas
      const redistributedNumWOs = new Set(redistributedWithCorrectSeq.map(w => w.NumWO));
      finalFabs = [
        ...wosBeforeDrop.filter(wo => !redistributedNumWOs.has(wo.NumWO)),
        ...redistributedWithCorrectSeq
      ];
      
      console.log('✅ [REORDEN TABLE] Capacity aplicada (respetando orden). WOs finales:', finalFabs.length);
    } else {
      console.log('⚠️ [REORDEN TABLE] Capacity NO disponible, continuando sin aplicar restricciones');
    }

    // Ordenar resultado final
    finalFabs.sort((a, b) => {
      const dateCompare = new Date(a.Fch_Objetivo).getTime() - new Date(b.Fch_Objetivo).getTime();
      if (dateCompare !== 0) return dateCompare;
      
      const lineCompare = a.Linea.localeCompare(b.Linea);
      if (lineCompare !== 0) return lineCompare;
      
      return a.Secuencia - b.Secuencia;
    });

    console.log('📝 Actualizando contexto con', finalFabs.length, 'fabricaciones ordenadas');
    console.log('   Primeras 5:', finalFabs.slice(0, 5).map(f => `${f.NumWO}:${f.Fch_Objetivo}:${f.Secuencia}`));

    onGanttOrdersChanged(finalFabs);

    console.log('✅ [REORDEN TABLE] Completado');
  }, [fabricacionesFromContext, onGanttOrdersChanged, capacityLoaded, capacity, workingDays]);

  const handleRowHover = (woId: string | null) => {
    setHoveredRowId(woId);
  };

  const handleExpandClick = () => {
    openExpandedWindow({
      filteredWOIds,
      workOrders: enrichedWorkOrders,
      availableComponents,
      componentAvailability
    });
  };

  const handleRefreshData = () => {
    refetchFabricaciones();
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
        className="h-full overflow-hidden"
        style={{
          width: leftWidth,
          marginTop: hasPendingChanges ? '80px' : '40px'
        }}
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
          className="overflow-hidden h-[calc(100%-36px)]"
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
        className="h-full overflow-hidden"
        style={{
          width: `calc(100% - ${leftWidth} - 2px)`,
          marginTop: hasPendingChanges ? '80px' : '40px'
        }}
      >
        <h3 className="font-medium p-2 bg-gray-100 flex-shrink-0 border-b">
          Detalle Componentes
        </h3>

        <div
          ref={rightTableContainerRef}
          className="overflow-hidden h-[calc(100%-36px)]"
        >
          <ComponentsTable
            filteredWOIds={filteredWOIds}
            availableComponents={availableComponents}
            componentAvailability={componentAvailability}
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