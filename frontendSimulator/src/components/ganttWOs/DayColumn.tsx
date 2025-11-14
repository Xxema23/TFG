import React, { useRef, useMemo } from "react";
import { useDrop } from "react-dnd";
import { Capacity } from "./Types"; // Asegúrate de que Capacity esté definido correctamente
import { IFabricacionConHoras } from "../../interfaces/IFabricacionConHoras";
import VirtualizedWorkOrders from "./VirtualizedWorkOrders";

interface DayColumnProps {
  day: string;
  line: string;
  workOrders: IFabricacionConHoras[];
  capacity: Capacity[];
  zoomLevel: number;
  onDrop: (droppedWO: IFabricacionConHoras, targetDay: string, targetLine: string) => void;
  selectedWOs: string[];                                         // <-- PROP AÑADIDO
  setSelectedWOs: React.Dispatch<React.SetStateAction<string[]>>; // <-- PROP AÑADIDO
}

const DayColumn: React.FC<DayColumnProps> = ({
  day,
  line,
  workOrders,
  capacity,
  zoomLevel,
  onDrop,
  selectedWOs,    // <-- DESESTRUCTURAR
  setSelectedWOs, // <-- DESESTRUCTURAR
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: "workOrder",
    drop: (item: IFabricacionConHoras) => {
      onDrop(item, day, line);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  drop(ref);

  const lineCapacity = useMemo(() => {
    const cap = capacity.find((cap) => cap.line === line && cap.date === day)?.capacity;
    return cap ?? 8;
  }, [capacity, line, day]);

  const dayWidth = 100 * zoomLevel;

  const isToday = useMemo(() => {
    return new Date(day).toDateString() === new Date().toDateString();
  }, [day]);

  const totalHoras = useMemo(() => {
    return workOrders.reduce((acc, wo) => {
      const horas = parseFloat(wo.horas_totales_de_la_wo);
      return acc + (isNaN(horas) ? 0 : horas);
    }, 0);
  }, [workOrders]);

  const blocks = useMemo(() => { // Estos bloques se ajustan a WorkOrderBlock de VirtualizedWorkOrders (sin color)
    return workOrders.map((wo) => ({
      workOrder: wo,
      // Asegúrate de que startDay/endDay sean números como espera WorkOrderBlock en VirtualizedWorkOrders.
      // Usar un timestamp está bien si VirtualizedWorkOrders no los interpreta como índices de array.
      // Dada la lógica de renderizado de VirtualizedWorkOrders, utiliza principalmente `left` y `width`.
      startDay: new Date(wo.Fch_Objetivo).getTime(),
      endDay: new Date(wo.Fch_Objetivo).getTime(),
      width: dayWidth,
      left: 0,
    }));
  }, [workOrders, dayWidth, day]); // Se añadió 'day' al array de dependencias

  return (
    <div
      ref={ref}
      className={`relative border-r border-gray-200 ${
        isToday ? "bg-blue-50/30" : "bg-white"
      } ${isOver ? "bg-blue-100" : ""}`}
      style={{
        width: `${dayWidth}px`,
        // Considera si la altura debe ser dinámica o fija según el contenido de VirtualizedWorkOrders
        height: `${workOrders.length * 40}px`, // Esto podría entrar en conflicto si VirtualizedWorkOrders posiciona de forma absoluta
        minHeight: "72px",
        position: "relative",
        transition: "background-color 0.2s",
        overflow: "hidden", // Ten cuidado con overflow: hidden si los componentes WO pueden exceder los límites
      }}
    >
      <VirtualizedWorkOrders
        blocks={blocks}
        zoomLevel={zoomLevel}
        line={line}
        days={[day]} // Solo un día para esta columna
        dayWidth={dayWidth}
        selectedWOs={selectedWOs}     // <-- PASAR PROP
        setSelectedWOs={setSelectedWOs} // <-- PASAR PROP
      />

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
        <div
          className="h-full bg-blue-400"
          style={{
            width: `${Math.min((totalHoras / lineCapacity) * 100, 100)}%`,
            maxWidth: "100%",
          }}
        />
      </div>
    </div>
  );
};

export default DayColumn;