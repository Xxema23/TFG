// GanttHeader.tsx
import React, { useMemo, memo, useCallback } from "react";

interface GanttHeaderProps {
  workingDays: string[];
}

// Formateadores de fecha memoizados para reutilización
const getFormattedDateParts = (dateStr: string) => {
  const date = new Date(dateStr);
  return {
    day: date.getDate(),
    month: date.toLocaleString('default', { month: 'short' }),
    weekday: date.toLocaleString('default', { weekday: 'narrow' }),
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
    isToday: date.toDateString() === new Date().toDateString()
  };
};

// Componente de celda individual para evitar renderizar todas las celdas cuando solo una cambia
const DateCell = memo(({ day }: { day: string }) => {
  // useMemo para evitar recalcular las partes de fecha en cada render
  const { day: dayNum, month, weekday, isWeekend, isToday } = useMemo(() => 
    getFormattedDateParts(day), [day]);
  
  return (
    <div
      className={`
        ${isToday ? "bg-indigo-50 border-indigo-200" : "bg-white border-gray-100"} 
        ${isWeekend ? "bg-gray-50" : ""}
        font-medium text-center border-r border-b p-1 
        sticky top-0 z-10 h-14 flex flex-col items-center justify-center 
        transition-colors
      `}
    >
      <div className="text-xs text-gray-400">{weekday}</div>
      <div className="font-medium text-sm">{dayNum}</div>
      <div className="text-xs text-gray-400">{month}</div>
    </div>
  );
});

DateCell.displayName = 'DateCell';

const GanttHeader: React.FC<GanttHeaderProps> = memo(({ workingDays }) => {
  return (
    <>
      <div className="bg-white font-medium text-center border-b border-r border-gray-100 p-2 sticky top-0 left-0 z-10 shadow-sm h-14 flex items-center justify-center">
        <span className="text-gray-600">Líneas</span>
      </div>
      
      {/* Mapear los días utilizando el componente memoizado DateCell */}
      {workingDays.map((day) => (
        <DateCell key={day} day={day} />
      ))}
    </>
  );
});

GanttHeader.displayName = 'GanttHeader';

export default GanttHeader;