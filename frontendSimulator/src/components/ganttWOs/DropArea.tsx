import React, { useRef } from 'react';
import { useDrop } from 'react-dnd';

interface DropAreaProps {
  day: string;
  line: string;
  left: number;
  width: number;
  onDrop: (day: string, line: string, draggedItems: string[], insertBeforeWO?: string) => void;
}

const DropArea: React.FC<DropAreaProps> = ({
  day,
  line,
  left,
  width,
  onDrop,
}) => {
  const dropRef = useRef<HTMLDivElement>(null);

  /**
   * Calcula el ID de la WO antes de la cual se debe insertar
   */
  const calculateInsertPosition = (clientX: number): string | undefined => {
    console.log('🎯 calculateInsertPosition iniciado:', {
      day,
      line,
      clientX
    });

    // Intentar múltiples selectores para encontrar las WOs
    let workOrderElements: HTMLElement[] = [];
    
    // Intento 1: Selector por clase y atributos
    workOrderElements = Array.from(
      document.querySelectorAll(`.work-order[data-day="${day}"][data-line="${line}"]`)
    ) as HTMLElement[];
    
    // Intento 2: Selector alternativo
    if (workOrderElements.length === 0) {
      workOrderElements = Array.from(
        document.querySelectorAll(`[data-day="${day}"][data-line="${line}"].work-order`)
      ) as HTMLElement[];
    }
    
    // Intento 3: Buscar por atributos específicos
    if (workOrderElements.length === 0) {
      const allWOs = Array.from(document.querySelectorAll('[data-wo-id]')) as HTMLElement[];
      workOrderElements = allWOs.filter(el => 
        el.getAttribute('data-day') === day && 
        el.getAttribute('data-line') === line
      );
    }

    console.log('🔍 Elementos encontrados:', {
      totalFound: workOrderElements.length,
      day,
      line
    });

    if (workOrderElements.length === 0) {
      console.warn('❌ No se encontraron elementos WO para este día/línea');
      return undefined;
    }

    // Obtener posiciones y ordenar
    const elementsWithPositions = workOrderElements
      .map(el => {
        const rect = el.getBoundingClientRect();
        const woId = el.dataset.woId || el.getAttribute('data-wo-id') || undefined;
        
        return {
          element: el,
          woId,
          left: rect.left,
          right: rect.right,
          center: rect.left + rect.width / 2,
          width: rect.width,
          rect
        };
      })
      .filter(item => item.woId)
      .sort((a, b) => a.left - b.left);

    console.log('📍 Elementos ordenados:', elementsWithPositions.map(item => ({
      woId: item.woId,
      left: item.left,
      center: item.center
    })));

    // Determinar posición de inserción
    for (let i = 0; i < elementsWithPositions.length; i++) {
      const current = elementsWithPositions[i];
      
      // CASO 1: Cursor antes del primer elemento
      if (i === 0 && clientX < current.center) {
        console.log(`✅ Insertando antes del primer elemento: ${current.woId}`);
        return current.woId;
      }
      
      // CASO 2: Cursor entre elementos
      if (i > 0) {
        const previous = elementsWithPositions[i - 1];
        
        if (clientX > previous.right && clientX < current.center) {
          console.log(`✅ Insertando entre elementos, antes de: ${current.woId}`);
          return current.woId;
        }
        
        if (clientX >= current.left && clientX < current.center) {
          console.log(`✅ Insertando en primera mitad de: ${current.woId}`);
          return current.woId;
        }
      }
    }

    // CASO 3: Insertar al final
    console.log('✅ Insertando al final');
    return undefined;
  };

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: "WORK_ORDER",
    drop: (item: { workOrders: string[] }, monitor) => {
      const clientOffset = monitor.getClientOffset();

      if (!monitor.didDrop() && clientOffset) {
        console.log('🎯 DropArea: Iniciando proceso de drop...');
        
        const insertBeforeWO = calculateInsertPosition(clientOffset.x);

        console.log("🎯 DropArea: Drop realizado", {
          day,
          line,
          insertBeforeWO,
          clientX: clientOffset.x,
          draggedItems: item.workOrders
        });

        if (!item.workOrders || item.workOrders.length === 0) {
          console.error('❌ No hay items para hacer drop');
          return;
        }

        // ✅ SIMPLIFICADO: Pasamos el día del DropArea
        // La corrección del día se hace en UseGanttHooks.stableHandleWorkOrderDrop
        onDrop(day, line, item.workOrders, insertBeforeWO);
      }
    },
    canDrop: (item: { workOrders: string[] }) => {
      return item && item.workOrders && item.workOrders.length > 0;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  drop(dropRef);

  return (
    <div
      ref={dropRef}
      style={{
        position: "absolute",
        left: `${left}px`,
        width: `${width}px`,
        height: "100%",
        backgroundColor: isOver && canDrop
          ? "rgba(59, 130, 246, 0.3)"
          : canDrop
          ? "rgba(156, 163, 175, 0.1)"
          : "transparent",
        border: isOver && canDrop ? "2px dashed #3b82f6" : "none",
        zIndex: 1,
        minHeight: "60px",
        transition: "all 0.2s ease",
        cursor: isOver && canDrop ? "copy" : canDrop ? "grab" : "not-allowed",
      }}
      data-drop-day={day}
      data-drop-line={line}
      className="drop-area-target"
    >
      {isOver && canDrop && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            color: '#3b82f6',
            fontWeight: 'bold',
            fontSize: '12px',
            zIndex: 10,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}
        >
          Soltar aquí
        </div>
      )}
    </div>
  );
};

export default DropArea;