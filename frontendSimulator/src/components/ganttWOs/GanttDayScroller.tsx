import React, { useMemo, useCallback } from "react";
import { IFabricacionConHoras } from "../../interfaces/IFabricacionConHoras";
import { DailyCapacity } from "./Types";
import VirtualizedWorkOrders from "./VirtualizedWorkOrders";

interface WorkOrderBlock {
  workOrder: IFabricacionConHoras;
  startDay: number;
  endDay: number;
  width: number;
  left: number;
  color: string;
}

interface GanttDayScrollerProps {
  days: string[];
  line: string;
  workOrders: IFabricacionConHoras[];
  capacity: DailyCapacity[];
  zoomLevel: number;
  selectedWOs: string[];
  setSelectedWOs: React.Dispatch<React.SetStateAction<string[]>>;
}

const GanttDayScroller: React.FC<GanttDayScrollerProps> = ({
  days,
  line,
  workOrders,
  capacity,
  zoomLevel,
  selectedWOs,
  setSelectedWOs,
}) => {
  const dayWidth = useMemo(() => 100 * zoomLevel, [zoomLevel]);

  const getColorForWO = useCallback((woNumber: string) => {
    const colors = ["bg-red-500", "bg-green-500", "bg-yellow-500", "bg-blue-500", "bg-purple-500"];
    const numericValue = parseInt(woNumber.replace(/\D/g, "")) || 0;
    return colors[numericValue % colors.length];
  }, []);

  // ⬇️ FALLBACK solo si capacity está completamente vacía
  const FALLBACK_CAPACITY = 1000000;

  const capacityByDay = useMemo(() => {
    const lineCapacity = capacity.filter(cap => cap.line === line || cap.line === "*");
    const capacityMap = new Map<string, number>();
    
    console.log(`📊 [GanttDayScroller] Capacity para línea ${line}:`, {
      totalCapacities: capacity.length,
      lineCapacities: lineCapacity.length,
      primeras3: lineCapacity.slice(0, 3).map(c => ({
        date: c.date,
        line: c.line,
        capacity: c.capacity
      }))
    });
    
    days.forEach((day) => {
      const customCapacity = lineCapacity.find((cap) => cap.date === day)?.capacity;
      
      // Solo usar fallback si NO existe capacity para ese día
      const finalCapacity = customCapacity !== undefined ? customCapacity : FALLBACK_CAPACITY;
      capacityMap.set(day, finalCapacity);
    });
    
    console.log(`🗺️ [GanttDayScroller] CapacityByDay generado:`, {
      totalDays: days.length,
      primeros3Days: days.slice(0, 3).map(day => ({
        day,
        capacity: capacityMap.get(day)
      }))
    });
    
    return capacityMap;
  }, [capacity, line, days]);

  const normalizeFecha = useCallback((fechaObjetivo: string): string => {
    if (fechaObjetivo.includes('T')) {
      return fechaObjetivo.split('T')[0];
    } else if (fechaObjetivo.includes(' ')) {
      return fechaObjetivo.split(' ')[0];
    }
    return fechaObjetivo;
  }, []);

  const blocks = useMemo<WorkOrderBlock[]>(() => {
    if (!workOrders?.length || !capacity || !days.length) {
      return [];
    }

    // ⬇️⬇️⬇️ LOG CRÍTICO: DÍAS RECIBIDOS ⬇️⬇️⬇️
    console.log('🗓️ [GanttDayScroller] DAYS recibidos:', {
      total: days.length,
      primeros5: days.slice(0, 5),
      ultimos3: days.slice(-3)
    });

    const dayIndexMap = new Map(days.map((day, index) => [day, index]));

    const sortedWorkOrders = [...workOrders].sort((a, b) => {
      const dateA = new Date(a.Fch_Objetivo).getTime();
      const dateB = new Date(b.Fch_Objetivo).getTime();
      return dateA - dateB || a.Secuencia - b.Secuencia;
    });

    // ⬇️⬇️⬇️ LOG CRÍTICO: WOs A PROCESAR ⬇️⬇️⬇️
    console.log('📦 [GanttDayScroller] WOs a procesar:', {
      total: sortedWorkOrders.length,
      primeras5: sortedWorkOrders.slice(0, 5).map(wo => ({
        NumWO: wo.NumWO,
        Fch_Objetivo: wo.Fch_Objetivo,
        Secuencia: wo.Secuencia
      }))
    });

    const blocks: WorkOrderBlock[] = [];
    const dayUsage = new Map<string, number>();
    days.forEach(day => dayUsage.set(day, 0));

    let skippedCount = 0;

    sortedWorkOrders.forEach(workOrder => {
      const startDay = normalizeFecha(workOrder.Fch_Objetivo);
      const startDayindex = dayIndexMap.get(startDay);

      if (workOrder.NumWO.endsWith('678')) {
  console.log('🔎 DEBUG WO ...678:', {
    NumWO: workOrder.NumWO,
    Fch_Objetivo_RAW: workOrder.Fch_Objetivo,
    startDay_Normalizado: startDay,
    startDayindex: startDayindex,
    dayIndexMap_tiene_2026_02_03: dayIndexMap.has('2026-02-03'),
    dayIndexMap_tiene_2026_02_04: dayIndexMap.has('2026-02-04'),
    days_primeros5: days.slice(0, 5),
    dayIndexMap_entries: Array.from(dayIndexMap.entries()).slice(0, 5)
  });
}
      
      // ⬇️⬇️⬇️ LOG CRÍTICO: WO SALTADA CON ANÁLISIS DE CARACTERES ⬇️⬇️⬇️
      if (startDayindex === undefined) {
        skippedCount++;
        if (skippedCount <= 5) { // Solo loggear las primeras 5 para no saturar
          console.log('⚠️ [GanttDayScroller] WO SALTADA - ANÁLISIS DETALLADO:', {
            NumWO: workOrder.NumWO,
            Fch_Objetivo: workOrder.Fch_Objetivo,
            startDayNormalizado: startDay,
            startDayLength: startDay.length,
            startDayCharCodes: Array.from(startDay).map(c => c.charCodeAt(0)),
            daysDisponiblesPrimeros3: days.slice(0, 3),
            primerDiaLength: days[0]?.length,
            primerDiaCharCodes: days[0] ? Array.from(days[0]).map(c => c.charCodeAt(0)) : [],
            segundoDiaLength: days[1]?.length,
            segundoDiaCharCodes: days[1] ? Array.from(days[1]).map(c => c.charCodeAt(0)) : [],
            dayIndexMapHas: dayIndexMap.has(startDay),
            dayIndexMapSize: dayIndexMap.size,
            comparisonConPrimerDia: startDay === days[0],
            comparisonConSegundoDia: startDay === days[1]
          });
        }
        return;
      }

      const woHours = Math.max(parseFloat(workOrder.horas_totales_de_la_wo || "0"), 0.5);
      let remainingHours = woHours;
      let totalWidth = 0;
      let startLeft = 0;
      let endDayindex = startDayindex;
      let isFirstDay = true;

      while (remainingHours > 0 && endDayindex < days.length) {
        const currentDay = days[endDayindex];
        const dailyCapacity = capacityByDay.get(currentDay) || FALLBACK_CAPACITY;
        const usedCapacity = dayUsage.get(currentDay) || 0;
        const availableCapacity = dailyCapacity - usedCapacity;

        if (availableCapacity <= 0) {
          endDayindex++;
          continue;
        }

        const hoursForThisDay = Math.min(remainingHours, availableCapacity);
        const widthForThisDay = (hoursForThisDay / dailyCapacity) * dayWidth;

        if (isFirstDay) {
          startLeft = endDayindex * dayWidth + (usedCapacity / dailyCapacity) * dayWidth;
          isFirstDay = false;
        }

        totalWidth += widthForThisDay;
        remainingHours -= hoursForThisDay;
        dayUsage.set(currentDay, usedCapacity + hoursForThisDay);

        if (remainingHours > 0) {
          endDayindex++;
        }
      }

      blocks.push({
        workOrder,
        startDay: startDayindex,
        endDay: endDayindex,
        width: totalWidth,
        left: startLeft,
        color: getColorForWO(workOrder.NumWO)
      });
    });

    // ⬇️⬇️⬇️ LOG RESUMEN FINAL ⬇️⬇️⬇️
    console.log(`🎨 [GanttDayScroller] RESUMEN FINAL:`, {
      totalWOsRecibidas: sortedWorkOrders.length,
      totalWOsSaltadas: skippedCount,
      totalBlocksGenerados: blocks.length,
      primeros3Blocks: blocks.slice(0, 3).map(b => ({
        NumWO: b.workOrder.NumWO,
        width: b.width,
        left: b.left,
        horasWO: b.workOrder.horas_totales_de_la_wo,
        startDay: days[b.startDay],
        dailyCapacity: capacityByDay.get(days[b.startDay])
      }))
    });

    return blocks;
  }, [workOrders, days, capacityByDay, dayWidth, getColorForWO, normalizeFecha]);

  const emptyContent = useMemo(() => (
    <div className="h-full flex items-center justify-center text-gray-400">
      <span>No hay órdenes de trabajo para esta línea</span>
    </div>
  ), []);

  const containerStyle = useMemo(() => ({
    minWidth: days.length * dayWidth
  }), [days.length, dayWidth]);

  return (
    <div className="relative w-full" style={containerStyle}>
      {blocks.length === 0 ? (
        emptyContent
      ) : (
        <VirtualizedWorkOrders
          blocks={blocks}
          zoomLevel={zoomLevel}
          line={line}
          days={days}
          dayWidth={dayWidth}
          selectedWOs={selectedWOs}
          setSelectedWOs={setSelectedWOs}
        />
      )}
    </div>
  );
};

// ⬇️⬇️⬇️ COMPARACIÓN MÁS ESTRICTA ⬇️⬇️⬇️
export default React.memo(GanttDayScroller, (prevProps, nextProps) => {
  // 1️⃣ Comparar length de capacity
  if (prevProps.capacity.length !== nextProps.capacity.length) {
    console.log('🔄 [React.memo] Capacity LENGTH cambió:', {
      prev: prevProps.capacity.length,
      next: nextProps.capacity.length
    });
    return false; // NO son iguales → RE-RENDER
  }
  
  // 2️⃣ Comparar VALORES de capacity (sampling en 3 puntos)
  if (prevProps.capacity.length > 0 && nextProps.capacity.length > 0) {
    const indicesToCheck = [
      0,
      Math.floor(prevProps.capacity.length / 2),
      prevProps.capacity.length - 1
    ];
    
    for (const i of indicesToCheck) {
      if (i < prevProps.capacity.length && i < nextProps.capacity.length) {
        const prevCap = prevProps.capacity[i];
        const nextCap = nextProps.capacity[i];
        
        if (prevCap.capacity !== nextCap.capacity || 
            prevCap.date !== nextCap.date || 
            prevCap.line !== nextCap.line) {
          console.log('🔄 [React.memo] Capacity VALUE cambió en índice', i, ':', {
            prev: { date: prevCap.date, line: prevCap.line, capacity: prevCap.capacity },
            next: { date: nextCap.date, line: nextCap.line, capacity: nextCap.capacity }
          });
          return false; // Capacity cambió → RE-RENDER
        }
      }
    }
  }

  // 3️⃣ Comparar otras props
  const lineChanged = prevProps.line !== nextProps.line;
  const zoomChanged = prevProps.zoomLevel !== nextProps.zoomLevel;
  const daysChanged = prevProps.days.length !== nextProps.days.length;
  const workOrdersChanged = prevProps.workOrders.length !== nextProps.workOrders.length;
  const selectedChanged = prevProps.selectedWOs.length !== nextProps.selectedWOs.length;
  
  if (lineChanged || zoomChanged || daysChanged || workOrdersChanged || selectedChanged) {
    console.log('🔄 [React.memo] Otras props cambiaron:', {
      lineChanged,
      zoomChanged,
      daysChanged,
      workOrdersChanged,
      selectedChanged
    });
    return false; // Props cambiaron → RE-RENDER
  }
  
  // 4️⃣ Comparación profunda de workOrders
  const workOrdersEqual = prevProps.workOrders.length === nextProps.workOrders.length &&
    prevProps.workOrders.every((wo, index) => {
      const nextWO = nextProps.workOrders[index];
      return nextWO && 
             wo.NumWO === nextWO.NumWO &&
             wo.Fch_Objetivo === nextWO.Fch_Objetivo &&
             wo.Secuencia === nextWO.Secuencia;
    });
  
  if (!workOrdersEqual) {
    console.log('🔄 [React.memo] WorkOrders CONTENT cambió');
    return false;
  }
  
  // ✅ TODO IGUAL → NO RE-RENDER
  return true;
});