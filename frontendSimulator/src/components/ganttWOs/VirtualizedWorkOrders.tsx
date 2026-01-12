import React from "react";
import { useDrop } from 'react-dnd';
import WorkOrderComponent from "./WorkOrderComponent";
import DropArea from "./DropArea";
import { IFabricacionConHoras } from "../../interfaces/IFabricacionConHoras";
import DropMonitor from "./DropMonitor";

interface WorkOrderBlock {
  workOrder: IFabricacionConHoras;
  startDay: number;
  endDay: number;
  width: number;
  left: number;
}

interface VirtualizedWorkOrdersProps {
  blocks: WorkOrderBlock[];
  zoomLevel: number;
  line: string;
  days: string[];
  dayWidth: number;
  selectedWOs: string[];
  setSelectedWOs: React.Dispatch<React.SetStateAction<string[]>>;
}

const BetweenWODropZone: React.FC<{
  day: string;
  line: string;
  left: number;
  width: number;
  height: number;
  insertBeforeWO: string;
  onDrop: (day: string, line: string, draggedItems: string[], insertBeforeWO?: string) => void;
  debugMode?: boolean;
}> = ({ day, line, left, width, height, insertBeforeWO, onDrop, debugMode = false }) => {
  
  const dropRef = React.useRef<HTMLDivElement>(null);
  
  // ✅ TIPADO CORRECTO (como lo tenías originalmente)
  const [{ isOver, canDrop, item }, drop] = useDrop<{ workOrders: string[] }, { handled: boolean; zone: string; insertBeforeWO: string }, { isOver: boolean; canDrop: boolean; item: { workOrders: string[] } | null }>({
    accept: "WORK_ORDER",
    drop: (dragItem: { workOrders: string[] }, monitor) => {
      onDrop(day, line, dragItem.workOrders, insertBeforeWO);
      return { handled: true, zone: 'between-wo', insertBeforeWO };
    },
    canDrop: (dragItem: { workOrders: string[] }) => {
      const isValid = dragItem && 
                     dragItem.workOrders && 
                     dragItem.workOrders.length > 0;
      
      return isValid;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      item: monitor.getItem(),
    }),
  });

  React.useEffect(() => {
    drop(dropRef.current);
  }, [drop]);

  const isDragging = item !== null;

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    left: `${left}px`,
    width: `${width}px`,
    height: `${height}px`,
    top: 0,
    zIndex: 999,
    pointerEvents: 'auto',
    borderRadius: "4px",
  };

  let finalStyle = { ...baseStyle };

  if (isOver && canDrop) {
    finalStyle = {
      ...finalStyle,
      backgroundColor: "rgba(0, 255, 0, 0.6)",
      border: "3px solid green",
      cursor: "copy",
    };
  } else if (canDrop && isDragging) {
    finalStyle = {
      ...finalStyle,
      backgroundColor: debugMode ? "rgba(0, 255, 0, 0.3)" : "rgba(0, 255, 0, 0.2)",
      border: debugMode ? "2px dashed green" : "1px dashed rgba(0, 255, 0, 0.6)",
      cursor: "copy",
    };
  } else if (canDrop && !isDragging) {
    finalStyle = {
      ...finalStyle,
      backgroundColor: debugMode ? "rgba(0, 255, 0, 0.1)" : "transparent",
      border: debugMode ? "1px dashed rgba(0, 255, 0, 0.3)" : "none",
      cursor: "default",
    };
  } else {
    finalStyle = {
      ...finalStyle,
      backgroundColor: debugMode ? "rgba(255, 0, 0, 0.2)" : "transparent",
      border: debugMode ? "1px dashed red" : "none",
      cursor: debugMode ? "not-allowed" : "default",
    };
  }

  return (
    <div
      ref={dropRef}
      style={finalStyle}
      data-testid={`drop-zone-before-${insertBeforeWO}`}
      title={`Drop zone antes de ${insertBeforeWO}`}
    >
      {debugMode && (
        <div style={{ 
          fontSize: '9px', 
          color: canDrop ? 'green' : 'red',
          fontWeight: 'bold',
          textAlign: 'center',
          pointerEvents: 'none',
          padding: '1px'
        }}>
          ⬆️{insertBeforeWO.slice(-4)}
          <br />
          {canDrop ? '✅' : '❌'}
          {isDragging ? ' 🎯' : ''}
        </div>
      )}
      
      {isOver && canDrop && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'white',
            border: '2px solid green',
            padding: '2px 4px',
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: 'bold',
            color: 'green',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
          }}
        >
          ⬆️ ANTES DE {insertBeforeWO.slice(-4)}
        </div>
      )}
    </div>
  );
};

const VirtualizedWorkOrders: React.FC<VirtualizedWorkOrdersProps> = ({
  blocks,
  zoomLevel,
  line,
  days,
  dayWidth,
  selectedWOs,
  setSelectedWOs,
}) => {
  const [debugMode, setDebugMode] = React.useState(false);

  const handleDrop = (day: string, line: string, draggedItems: string[], insertBeforeWO?: string) => {
    DropMonitor.notifyDrop({ 
      day, 
      line, 
      draggedItems,
      insertBeforeWO 
    });
  };

  const handleSelect = (id: string, ctrlKey: boolean) => {
    setSelectedWOs(prev => {
      if (ctrlKey) {
        return prev.includes(id)
          ? prev.filter(woId => woId !== id)
          : [...prev, id];
      } else {
        return [id];
      }
    });
  };

  const betweenWODropZones = React.useMemo(() => {
    const zones: Array<{
      day: string;
      left: number;
      width: number;
      insertBeforeWO: string;
    }> = [];

    const wosByDay = new Map<string, Array<{ wo: WorkOrderBlock; dayindex: number }>>();
    
    blocks.forEach(block => {
      const dayindex = block.startDay;
      const day = days[dayindex];
      if (!wosByDay.has(day)) {
        wosByDay.set(day, []);
      }
      wosByDay.get(day)!.push({ wo: block, dayindex });
    });

    wosByDay.forEach((dayWOs, day) => {
      const sorted = dayWOs.sort((a, b) => a.wo.left - b.wo.left);
      const dayindex = days.indexOf(day);
      const dayStartX = dayindex * dayWidth;

      if (sorted.length > 0) {
        const firstWO = sorted[0].wo;
        zones.push({
          day,
          left: Math.max(dayStartX, firstWO.left - 10),
          width: 20,
          insertBeforeWO: firstWO.workOrder.NumWO
        });
      }

      for (let i = 0; i < sorted.length - 1; i++) {
        const currentWO = sorted[i].wo;
        const nextWO = sorted[i + 1].wo;
        
        const currentEnd = currentWO.left + currentWO.width;
        const nextStart = nextWO.left;
        const midPoint = (currentEnd + nextStart) / 2;
        
        zones.push({
          day,
          left: midPoint - 10,
          width: 20,
          insertBeforeWO: nextWO.workOrder.NumWO
        });
      }
    });

    return zones;
  }, [blocks, days, dayWidth]);

  // ✅ LOG DE DEBUGGING AÑADIDO (opcional - puedes quitarlo después)
  React.useEffect(() => {
    console.log('🎨 [VirtualizedWorkOrders] BLOCKS RECIBIDOS:', {
      total: blocks.length,
      primeros3: blocks.slice(0, 3).map(b => ({
        NumWO: b.workOrder.NumWO,
        startDay: b.startDay,
        startDayString: days[b.startDay],
        left: b.left,
        width: b.width
      }))
    });
  }, [blocks, days]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div style={{
        position: 'absolute',
        top: '-35px',
        right: '0px',
        zIndex: 2000,
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <button 
          onClick={() => setDebugMode(!debugMode)}
          style={{ 
            padding: '4px 8px', 
            fontSize: '11px',
            backgroundColor: debugMode ? '#22c55e' : '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Debug: {debugMode ? 'ON' : 'OFF'}
        </button>
        <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>
          Drop Zones: {betweenWODropZones.length}
        </span>
        <span style={{ color: '#8b5cf6', fontWeight: 'bold' }}>
          WOs: {blocks.length}
        </span>
      </div>

      {days.map((day, dayindex) => (
        <div
          key={`drop-area-container-${day}`}
          style={{
            position: 'absolute',
            left: dayindex * dayWidth,
            width: dayWidth,
            height: '100%',
            zIndex: 1,
          }}
        >
          <DropArea
            day={day}
            line={line}
            left={0}
            width={dayWidth}
            onDrop={handleDrop}
          />
        </div>
      ))}
      
      {blocks.map((block, index) => {
        const { workOrder, width, left } = block;
        const dayForWO = days[block.startDay];
        return (
          <WorkOrderComponent
            key={`wo-${workOrder.NumWO}-${index}`}
            workOrder={workOrder}
            zoomLevel={zoomLevel}
            left={left}
            width={width}
            top={4}
            isSelected={selectedWOs.includes(workOrder.NumWO)}
            onSelect={handleSelect}
            selectedWOs={selectedWOs}
            style={{
              position: 'absolute',
              height: '40px',
              zIndex: 50,
              pointerEvents: 'auto',
            }}
            dataDay={dayForWO}
            dataLine={line}
          />
        );
      })}
      
      {betweenWODropZones.map((zone, index) => (
        <BetweenWODropZone
          key={`drop-artificial-${zone.day}-${zone.insertBeforeWO}-${index}`}
          day={zone.day}
          line={line}
          left={zone.left}
          width={zone.width}
          height={48}
          insertBeforeWO={zone.insertBeforeWO}
          onDrop={handleDrop}
          debugMode={debugMode}
        />
      ))}
    </div>
  );
};

export default VirtualizedWorkOrders; 