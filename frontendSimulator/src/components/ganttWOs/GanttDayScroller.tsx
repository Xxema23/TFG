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

  const capacityByDay = useMemo(() => {
    const lineCapacity = capacity.filter(cap => cap.line === line || cap.line === "*");
    const capacityMap = new Map<string, number>();
    
    days.forEach((day) => {
      const customCapacity = lineCapacity.find((cap) => cap.date === day)?.capacity;
      capacityMap.set(day, customCapacity || 1000);
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

    const dayIndexMap = new Map(days.map((day, index) => [day, index]));

    const sortedWorkOrders = [...workOrders].sort((a, b) => {
      const dateA = new Date(a.Fch_Objetivo).getTime();
      const dateB = new Date(b.Fch_Objetivo).getTime();
      return dateA - dateB || a.Secuencia - b.Secuencia;
    });

    const blocks: WorkOrderBlock[] = [];
    const dayUsage = new Map<string, number>();
    days.forEach(day => dayUsage.set(day, 0));

    sortedWorkOrders.forEach(workOrder => {
      const startDay = normalizeFecha(workOrder.Fch_Objetivo);
      const startDayindex = dayIndexMap.get(startDay);
      
      if (startDayindex === undefined) {
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
        const dailyCapacity = capacityByDay.get(currentDay) || 1000;
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

export default React.memo(GanttDayScroller, (prevProps, nextProps) => {
  return (
    prevProps.line === nextProps.line &&
    prevProps.zoomLevel === nextProps.zoomLevel &&
    prevProps.days.length === nextProps.days.length &&
    prevProps.workOrders.length === nextProps.workOrders.length &&
    prevProps.capacity.length === nextProps.capacity.length &&
    prevProps.selectedWOs.length === nextProps.selectedWOs.length &&
    prevProps.workOrders.every((wo, index) => 
      wo.NumWO === nextProps.workOrders[index]?.NumWO &&
      wo.Fch_Objetivo === nextProps.workOrders[index]?.Fch_Objetivo &&
      wo.Secuencia === nextProps.workOrders[index]?.Secuencia
    )
  );
});