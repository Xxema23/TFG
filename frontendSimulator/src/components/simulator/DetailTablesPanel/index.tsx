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
import { recalculateAffectedWorkOrders, getWeekNumber, DEFAULT_INITIAL_CAPACITY } from '../../ganttWOs/useGanttHooks/UseGanttHooks';
import { CapacityData } from '../../../interfaces/Capacity';
import { getCapacities } from '../../../services/CapacityService';
import { useComponentesDisponibilidad } from '../../../hooks/useComponentesDisponibilidad';
import { transformComponentesData, calcularConsumoSecuencial } from '../../../services/componentesService';

// ========================================
// ✅ FLAG PARA LOGS DE DEBUG
// ========================================
const ENABLE_CAPACITY_LOGS = false;

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
  // ========================================
  // 1️⃣ ESTADOS LOCALES
  // ========================================
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [lastModifiedDay, setLastModifiedDay] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<any[]>([]);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [capacityLoaded, setCapacityLoaded] = useState(false);

  // ========================================
  // 2️⃣ CONTEXTO
  // ========================================
  const {
    fabricaciones: fabricacionesFromContext,
    updateSingleFabricacion,
    onGanttOrdersChanged,
    hasPendingChanges
  } = useFabricacionesContext();

  // ========================================
  // 3️⃣ HOOKS DE DATOS
  // ========================================
  const {
    data: fabricacionesConHoras = [],
    isLoading: isFabricacionesLoading,
    error: fabricacionesError,
    refetch: refetchFabricaciones,
  } = useFabricacionesConHoras();

  // ========================================
  // 4️⃣ ✅✅✅ FIX CRÍTICO: workingDays INTELIGENTE ✅✅✅
  // ========================================
  const memoizedWorkingDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche
    const allWorkingDays: string[] = [];
    
    // ✅ LÓGICA INTELIGENTE: Empezar desde la WO más antigua o desde hoy
    let startDate = new Date(today);
    
    if (fabricacionesFromContext.length > 0) {
      // Encontrar la fecha más antigua de todas las WOs
      const oldestDate = new Date(
        Math.min(...fabricacionesFromContext.map(f => {
          const woDate = new Date(f.Fch_Objetivo);
          woDate.setHours(0, 0, 0, 0);
          return woDate.getTime();
        }))
      );
      
      console.log('📅 [memoizedWorkingDays] Fecha más antigua de WOs:', oldestDate.toISOString().split('T')[0]);
      console.log('📅 [memoizedWorkingDays] Fecha de hoy:', today.toISOString().split('T')[0]);
      
      // Si la WO más antigua es anterior a hoy, usar esa fecha
      // Si no, usar hoy
      startDate = oldestDate < today ? oldestDate : today;
      
      console.log('✅ [memoizedWorkingDays] Fecha de inicio seleccionada:', startDate.toISOString().split('T')[0]);
    } else {
      console.log('⚠️ [memoizedWorkingDays] No hay WOs, usando fecha de hoy');
    }
    
    // 30 días adelante desde HOY (no desde startDate)
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 30);
    
    console.log('📅 [memoizedWorkingDays] Rango:', {
      desde: startDate.toISOString().split('T')[0],
      hasta: endDate.toISOString().split('T')[0],
      totalWOs: fabricacionesFromContext.length
    });
    
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

    console.log('✅ [memoizedWorkingDays] Calculado:', allWorkingDays.length, 'días');
    console.log('📅 [memoizedWorkingDays] Primeros 3 días:', allWorkingDays.slice(0, 3));
    console.log('📅 [memoizedWorkingDays] Últimos 3 días:', allWorkingDays.slice(-3));
    
    return allWorkingDays;
  }, [
    fabricacionesFromContext.length,
    // ⬇️ Detectar cambios en fechas de WOs
    fabricacionesFromContext.map(f => f.Fch_Objetivo).join(',')
  ]);

  // ========================================
  // 5️⃣ dataToUse MEMOIZADO
  // ========================================
  const dataToUse = useMemo(() => {
    console.log('🔍 [dataToUse] Evaluando:', {
      contextLength: fabricacionesFromContext.length,
      filteredLength: filteredFabrications.length,
      hookLength: fabricacionesConHoras.length,
      useFilteredData,
      defaultLineFilter,
      lastUpdated: lastUpdated?.toISOString()
    });

    if (useFilteredData && filteredFabrications.length > 0) {
      console.log('✅ Usando filteredFabrications (filtros activos):', filteredFabrications.length);
      return filteredFabrications;
    }

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

    if (!useFilteredData && fabricacionesFromContext.length > 0) {
      console.log('✅ Usando fabricacionesFromContext (sin filtros):', fabricacionesFromContext.length);
      return fabricacionesFromContext;
    }

    if (filteredFabrications.length > 0) {
      console.log('⚠️ Usando filteredFabrications (fallback):', filteredFabrications.length);
      return filteredFabrications;
    }

    console.log('✅ Usando datos del hook:', fabricacionesConHoras.length);
    return fabricacionesConHoras;
  }, [fabricacionesFromContext, filteredFabrications, useFilteredData, fabricacionesConHoras, lastUpdated, defaultLineFilter]);

  // ========================================
  // 6️⃣ HOOK PARA CARGAR COMPONENTES DISPONIBILIDAD
  // ========================================
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

  // ========================================
  // 7️⃣ EFFECTS
  // ========================================
  useEffect(() => {
    if (hasPendingChanges && dataToUse.length > 0) {
      const sortedByDate = [...dataToUse].sort((a, b) => 
        new Date(b.Fch_Objetivo).getTime() - new Date(a.Fch_Objetivo).getTime()
      );
      setLastModifiedDay(sortedByDate[0]?.Fch_Objetivo || null);
    }
  }, [hasPendingChanges, dataToUse]);

  // ✅ CAPACITY LOADING
  useEffect(() => {
    const convertWeeklyToDaily = (
      weeklyCapacities: CapacityData[], 
      workingDaysArray: string[]
    ): any[] => {
      const dailyCapacities: any[] = [];
      const capacityMap = new Map<string, number>();

      weeklyCapacities.forEach(capacity => {
        const key = `${capacity.line}-${capacity.week}-${capacity.year}`;
        capacityMap.set(key, capacity.value);
      });

      const allLines = Array.from(new Set([
        ...weeklyCapacities.map(c => c.line),
        ...fabricacionesFromContext.map(wo => wo.Linea)
      ]));

      workingDaysArray.forEach(day => {
        const [year, month, dayNum] = day.split('-').map(Number);
        const date = new Date(year, month - 1, dayNum);
        const dayOfWeek = date.getDay();
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          return;
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
            date: day,
            capacity: dailyCapacity
          });
        });
      });

      return dailyCapacities;
    };

    const loadCapacityData = async () => {
      try {
        console.log('🔄 [DetailTablesPanel] Cargando capacity...');
        
        if (fabricacionesFromContext.length > 0) {
          const sortedDays = memoizedWorkingDays;
          
          console.log('🎯 [loadCapacityData] Usando días memoizados:', sortedDays.length);
          
          setWorkingDays(sortedDays);
          
          const currentYear = new Date().getFullYear();
          const weeklyCapacities = await getCapacities(1, currentYear);
          
          console.log('📊 [DetailTablesPanel] Capacidades semanales cargadas:', weeklyCapacities.length);
          
          const dailyCapacities = convertWeeklyToDaily(weeklyCapacities, sortedDays);
          
          setCapacity(dailyCapacities);
          console.log('✅ [DetailTablesPanel] Capacity diaria generada:', dailyCapacities.length, 'entradas');
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
  }, [fabricacionesFromContext.length, capacityLoaded, memoizedWorkingDays]);

  useEffect(() => {
    if (capacityLoaded && capacity.length === 0 && fabricacionesFromContext.length > 0) {
      console.log('⚠️ [DetailTablesPanel] Capacity vacía detectada, permitiendo recarga...');
      setCapacityLoaded(false);
    }
  }, [capacityLoaded, capacity.length, fabricacionesFromContext.length]);

  // ========================================
  // 8️⃣ ⬇️⬇️⬇️ FIX CRÍTICO: DEDUPLICAR + usar orden del contexto ⬇️⬇️⬇️
  // ========================================
  const enrichedWorkOrders = useMemo(() => {
    if (!dataToUse.length) {
      console.log('⚠️ [enrichedWorkOrders] dataToUse vacío');
      return [];
    }

    // ✅ PASO 1: DEDUPLICAR por NumWO (última aparición gana)
    const uniqueWOsMap = new Map<string, typeof dataToUse[0]>();
    
    dataToUse.forEach(fab => {
      // La última ocurrencia de cada NumWO sobrescribe las anteriores
      uniqueWOsMap.set(fab.NumWO, fab);
    });
    
    // Convertir el Map de vuelta a array (mantiene orden de inserción)
    const uniqueDataToUse = Array.from(uniqueWOsMap.values());
    
    console.log('🔍 [enrichedWorkOrders] Deduplicación:', {
      original: dataToUse.length,
      despuesDeDuplicar: uniqueDataToUse.length,
      duplicadasEliminadas: dataToUse.length - uniqueDataToUse.length
    });

    // ✅ PASO 2: Crear enrichedWorkOrders desde datos únicos
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

    console.log('📊 [enrichedWorkOrders] Creados (únicos + orden del contexto):', enriched.length);
    
    return enriched;
  }, [
    dataToUse.length,
    dataToUse[0]?.NumWO,
    dataToUse[dataToUse.length - 1]?.NumWO,
    // ⬇️ CRÍTICO: Detectar cambios de secuencia para re-renderizar
    dataToUse.map(d => `${d.NumWO}-${d.Secuencia}`).join(',')
  ]);

  // ========================================
  // 9️⃣ Signatures estables (optimizado)
  // ========================================
  
  const workOrdersSignature = useMemo(() => {
    return enrichedWorkOrders.map(wo => `${wo.numWO}-${wo.linea}-${wo.secuencia}`).join('|');
  }, [
    enrichedWorkOrders.length,
    enrichedWorkOrders[0]?.numWO,
    enrichedWorkOrders[enrichedWorkOrders.length - 1]?.numWO
  ]);

  const componentesSignature = useMemo(() => {
    if (componentes.length === 0) return '';
    
    const hash = `${componentes.length}-${componentes[0]?.wo || ''}-${componentes[componentes.length - 1]?.wo || ''}`;
    
    console.log('🔑 [componentesSignature] Generada (optimizada):', {
      hashLength: hash.length,
      componentes: componentes.length,
      hash
    });
    
    return hash;
  }, [
    componentes.length,
    componentes[0]?.wo,
    componentes[componentes.length - 1]?.wo
  ]);

  const { componentesColumnas, componentesData } = useMemo(() => {
    if (!componentesSignature || enrichedWorkOrders.length === 0) {
      console.log('⏭️ [consumoSecuencial] Skip: sin datos');
      return {
        componentesColumnas: [],
        componentesData: {}
      };
    }

    console.log('🔢 [DetailTablesPanel] Calculando consumo secuencial...', {
      componentesOriginales: componentes.length,
      workOrders: enrichedWorkOrders.length
    });

    const componentesConConsumo = calcularConsumoSecuencial(
      componentes,
      enrichedWorkOrders.map(wo => ({
        numWO: wo.numWO,
        linea: wo.linea
      }))
    );

    console.log('✅ [DetailTablesPanel] Consumo calculado:', componentesConConsumo.length);

    const { availableComponents, componentAvailability } = transformComponentesData(
      componentesConConsumo,
      enrichedWorkOrders.map(wo => wo.numWO) 
    );

    return {
      componentesColumnas: availableComponents,
      componentesData: componentAvailability
    };
  }, [componentesSignature, workOrdersSignature, componentes, enrichedWorkOrders]);

  useEffect(() => {
    if (Object.keys(componentesData).length > 0) {
      console.log('🔍 [ESTRUCTURA FINAL componentesData]', {
        totalWOs: Object.keys(componentesData).length,
        primeraWO: Object.keys(componentesData)[0],
        datosDeEsaWO: componentesData[Object.keys(componentesData)[0]]
      });
    }
  }, [componentesData]);

  // ========================================
  // 🔟 filteredWOIds y visibleWorkOrders
  // ========================================
  const filteredWOIds = useMemo(() => {
    const ids = enrichedWorkOrders.map(wo => wo.id);
    console.log('🔢 [filteredWOIds]:', ids.length);
    return ids;
  }, [
    enrichedWorkOrders.length,
    enrichedWorkOrders[0]?.id,
    enrichedWorkOrders[enrichedWorkOrders.length - 1]?.id
  ]);

  const visibleWorkOrders = useMemo(() => {
    const visible = enrichedWorkOrders.filter(wo => filteredWOIds.includes(wo.id));
    console.log('👀 [visibleWorkOrders]:', visible.length);
    return visible;
  }, [
    enrichedWorkOrders.length,
    filteredWOIds.length
  ]);

  // ========================================
  // 1️⃣1️⃣ HOOKS DE UI
  // ========================================
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

  // ========================================
  // 1️⃣2️⃣ HANDLER - CAPACITY SOLO EN WOs AFECTADAS
  // ========================================
  const handleReorderInTable = useCallback((draggedNumWOs: string[], targetNumWO: string) => {
    console.log('🔄 [REORDEN TABLE] Inicio:', { 
      draggedNumWOs, 
      targetNumWO,
      dataToUseLength: dataToUse.length,
      capacityLoaded,
      capacityLength: capacity.length,
      workingDaysLength: workingDays.length
    });

    const targetFab = dataToUse.find(f => f.NumWO === targetNumWO);
    if (!targetFab) {
      console.error('❌ Target no encontrado en dataToUse:', targetNumWO);
      return;
    }

    const targetDay = targetFab.Fch_Objetivo;
    const targetLine = targetFab.Linea;

    if (ENABLE_CAPACITY_LOGS) {
      console.log('📍 Target encontrado:', {
        NumWO: targetNumWO,
        Linea: targetLine,
        Dia: targetDay,
        Secuencia: targetFab.Secuencia
      });
    }

    const draggedFabsOriginal = draggedNumWOs
      .map(numWO => dataToUse.find(f => f.NumWO === numWO))
      .filter(Boolean);

    if (ENABLE_CAPACITY_LOGS) {
      console.log('🎯 WOs arrastradas encontradas:', draggedFabsOriginal.length);
      draggedFabsOriginal.forEach(fab => {
        console.log(`   - ${fab!.NumWO}: Día ${fab!.Fch_Objetivo}, Seq ${fab!.Secuencia}, Línea ${fab!.Linea}`);
      });
    }

    if (draggedFabsOriginal.length === 0) {
      console.error('❌ No se encontraron las WOs arrastradas en dataToUse');
      return;
    }

    const draggedFabsUpdated = draggedFabsOriginal.map(fab => ({
      ...fab!,
      Fch_Objetivo: targetDay,
      Linea: targetLine
    }));

    const existingWosInTarget = dataToUse
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

    let allFabs = dataToUse.filter(f => {
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
    
    // ✅ CAPACITY SOLO EN WOs AFECTADAS
    if (capacityLoaded && capacity.length > 0 && workingDays.length > 0) {
      console.log('🎯 [REORDEN TABLE] Aplicando CAPACITY solo a WOs afectadas...');
      
      const dropDate = targetDay.split('T')[0];
      const draggedNumWOsSet = new Set(draggedNumWOs);
      
      const wosToRedistribute = allFabs
        .filter(wo => {
          if (draggedNumWOsSet.has(wo.NumWO)) return true;
          
          if (wo.Linea === targetLine) {
            const woDate = wo.Fch_Objetivo.split('T')[0];
            return woDate === dropDate;
          }
          
          return false;
        })
        .sort((a, b) => {
          const dateCompare = new Date(a.Fch_Objetivo).getTime() - new Date(b.Fch_Objetivo).getTime();
          if (dateCompare !== 0) return dateCompare;
          return a.Secuencia - b.Secuencia;
        });
      
      const wosToKeepIntact = allFabs.filter(wo => {
        return !wosToRedistribute.find(w => w.NumWO === wo.NumWO);
      });
      
      console.log(`📦 WOs a redistribuir: ${wosToRedistribute.length}`);
      console.log(`🔒 WOs intactas: ${wosToKeepIntact.length}`);
      
      const capacityByDay = new Map<string, number>();
      const dayUsage = new Map<string, number>();
      
      workingDays.forEach(day => {
        const dayCapacity = capacity.find(c => c.date === day && c.line === targetLine);
        capacityByDay.set(day, dayCapacity?.capacity || DEFAULT_INITIAL_CAPACITY);
        dayUsage.set(day, 0);
      });
      
      wosToKeepIntact.forEach(wo => {
        if (wo.Linea !== targetLine) return;
        
        const woDate = wo.Fch_Objetivo.split('T')[0];
        if (workingDays.includes(woDate)) {
          const woHours = parseFloat(wo.horas_totales_de_la_wo) || 0;
          const currentUsage = dayUsage.get(woDate) || 0;
          dayUsage.set(woDate, currentUsage + woHours);
        }
      });
      
      const redistributed: typeof wosToRedistribute = [];
      
      let currentDayIndex = workingDays.findIndex(d => d === dropDate);
      
      if (currentDayIndex === -1) {
        currentDayIndex = workingDays.findIndex(d => d >= dropDate);
      }
      
      wosToRedistribute.forEach((wo, idx) => {
        const woHours = parseFloat(wo.horas_totales_de_la_wo) || 0;
        let remainingHours = woHours;
        let assignedToDay: string | null = null;
        
        let dayIndex = workingDays.findIndex(d => d === dropDate);
        
        while (dayIndex < workingDays.length && remainingHours > 0) {
          const currentDay = workingDays[dayIndex];
          const dayCapacity = capacityByDay.get(currentDay) || DEFAULT_INITIAL_CAPACITY;
          const dayUsed = dayUsage.get(currentDay) || 0;
          const availableCapacity = dayCapacity - dayUsed;
          
          if (ENABLE_CAPACITY_LOGS) {
            console.log(`  📅 Día ${currentDay}: Capacidad ${dayCapacity}h, Usado ${dayUsed.toFixed(2)}h, Disponible ${availableCapacity.toFixed(2)}h`);
          }
          
          if (availableCapacity > 0.01) {
            if (!assignedToDay) {
              assignedToDay = currentDay;
            }
            
            const hoursToUse = Math.min(remainingHours, availableCapacity);
            dayUsage.set(currentDay, dayUsed + hoursToUse);
            remainingHours -= hoursToUse;
            
            if (ENABLE_CAPACITY_LOGS) {
              console.log(`    ✅ Asignando ${hoursToUse.toFixed(2)}h de WO ${wo.NumWO} a ${currentDay}`);
            }
            
            if (remainingHours <= 0.01) {
              break;
            }
          }
          
          dayIndex++;
        }
        
        if (assignedToDay) {
          redistributed.push({
            ...wo,
            Fch_Objetivo: assignedToDay,
            Secuencia: idx + 1
          });
          
          if (ENABLE_CAPACITY_LOGS) {
            console.log(`  ✅ WO ${wo.NumWO} (${woHours}h) → ${assignedToDay}`);
          }
        } else {
          redistributed.push({
            ...wo,
            Secuencia: idx + 1
          });
          console.warn(`  ⚠️ WO ${wo.NumWO} no cabía en ningún día disponible`);
        }
      });
      
      console.log('✅ [REORDEN TABLE] Redistribución completada:', redistributed.length, 'WOs');
      
      const redistributedByDay = new Map<string, typeof redistributed>();
      redistributed.forEach(wo => {
        const day = wo.Fch_Objetivo.split('T')[0];
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
      
      const redistributedNumWOs = new Set(redistributedWithCorrectSeq.map(w => w.NumWO));
      finalFabs = [
        ...wosToKeepIntact.filter(wo => !redistributedNumWOs.has(wo.NumWO)),
        ...redistributedWithCorrectSeq
      ];
      
      console.log('✅ [REORDEN TABLE] Capacity aplicada. WOs finales:', finalFabs.length);
      console.log('   🔒 WOs preservadas:', wosToKeepIntact.length);
      console.log('   🔄 WOs redistribuidas:', redistributedWithCorrectSeq.length);
    } else {
      console.log('⚠️ [REORDEN TABLE] Capacity NO disponible');
    }

    finalFabs.sort((a, b) => {
      const dateCompare = new Date(a.Fch_Objetivo).getTime() - new Date(b.Fch_Objetivo).getTime();
      if (dateCompare !== 0) return dateCompare;
      
      const lineCompare = a.Linea.localeCompare(b.Linea);
      if (lineCompare !== 0) return lineCompare;
      
      return a.Secuencia - b.Secuencia;
    });

    console.log('📝 Actualizando contexto con', finalFabs.length, 'fabricaciones');

    const contextoActualizado = fabricacionesFromContext.map(fabContext => {
      const fabModificada = finalFabs.find(f => f.NumWO === fabContext.NumWO);
      return fabModificada || fabContext;
    });

    onGanttOrdersChanged(contextoActualizado);

    console.log('✅ [REORDEN TABLE] Completado');
    console.log('🔄 [REORDEN TABLE] Recargando componentes...');
    refetchComponentes();
  }, [dataToUse, fabricacionesFromContext, onGanttOrdersChanged, capacityLoaded, capacity, workingDays, refetchComponentes]);

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

  // ========================================
  // 1️⃣3️⃣ RENDERS CONDICIONALES
  // ========================================
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

  // ========================================
  // 1️⃣4️⃣ RENDER PRINCIPAL
  // ========================================
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