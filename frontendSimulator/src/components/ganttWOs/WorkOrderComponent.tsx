import React, { useRef } from "react";
import { useDrag, DragSourceMonitor } from "react-dnd";
import { IFabricacionConHoras } from "../../interfaces/IFabricacionConHoras";

interface WorkOrderComponentProps {
  workOrder: IFabricacionConHoras;
  zoomLevel: number;
  left: number;
  width: number;
  top: number;
  isSelected: boolean;
  onSelect: (id: string, ctrlKey: boolean) => void;
  selectedWOs: string[];
  style?: React.CSSProperties;
  dataDay: string;
  dataLine: string;
}

interface DragItem {
  workOrders: string[];
  sourceDay: string;
  sourceLine: string;
  dragType: string;
}

const WorkOrderComponent: React.FC<WorkOrderComponentProps> = ({
  workOrder,
  zoomLevel,
  left,
  width,
  top,
  isSelected,
  onSelect,
  selectedWOs,
  style,
  dataDay,
  dataLine,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  
  const [{ isDragging }, drag] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: "WORK_ORDER",
    item: (): DragItem => {
      const draggedWOs = isSelected ? selectedWOs : [workOrder.NumWO];
      
      if (!isSelected) {
        onSelect(workOrder.NumWO, false);
      }
      
      return { 
        workOrders: draggedWOs,
        sourceDay: dataDay,
        sourceLine: dataLine,
        dragType: 'work_order'
      };
    },
    canDrag: (): boolean => {
      return true;
    },
    collect: (monitor: DragSourceMonitor): { isDragging: boolean } => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(ref);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(workOrder.NumWO, e.ctrlKey);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!isSelected && !e.ctrlKey) {
      onSelect(workOrder.NumWO, false);
    }
  };

  const getBackgroundColor = (): string => {
    if (isDragging) return "rgba(59, 130, 246, 0.5)";
    if (isSelected) return "#3b82f6";
    return "#10b981";
  };

  const getTextColor = (): string => {
    return "white";
  };

  const getCursor = (): string => {
    if (isDragging) return "grabbing";
    return "grab";
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: `${left}px`,
        width: `${width}px`,
        top: `${top}px`,
        height: '40px',
        
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        border: isSelected ? "2px solid #1e40af" : "1px solid #059669",
        borderRadius: "4px",
        padding: "4px 8px",
        fontSize: `${12 * zoomLevel}px`,
        cursor: getCursor(),
        userSelect: "none",
        zIndex: isDragging ? 1000 : isSelected ? 100 : 10,
        opacity: isDragging ? 0.5 : 1,
        boxShadow: isSelected 
          ? "0 4px 8px rgba(59, 130, 246, 0.3)" 
          : "0 2px 4px rgba(0, 0, 0, 0.1)",
        transition: isDragging ? "none" : "all 0.2s ease",
        
        ...style,
      }}
      data-wo-id={workOrder.NumWO}
      data-day={dataDay}
      data-line={dataLine}
      data-sequence={workOrder.Secuencia}
      className="work-order"
      title={`WO: ${workOrder.NumWO}-${workOrder.Secuencia} | Línea: ${dataLine} | Día: ${workOrder.Fch_Objetivo}| Horas: ${workOrder.horas_totales_de_la_wo}`}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          fontWeight: isSelected ? "bold" : "normal",
        }}
      >
        {workOrder.NumWO}
      </div>
      {selectedWOs.length > 1 && isSelected && (
        <div
          style={{
            position: "absolute",
            top: "-8px",
            right: "-8px",
            backgroundColor: "#ef4444",
            color: "white",
            borderRadius: "50%",
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: "bold",
            pointerEvents: "none",
          }}
        >
          {selectedWOs.length}
        </div>
      )}
    </div>
  );
};

export default WorkOrderComponent;