import React, { useRef } from 'react';
import { useDrop, XYCoord } from 'react-dnd';

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
  // SOLUCIÓN 1: Usar useRef para el elemento div
  const dropRef = useRef<HTMLDivElement>(null);

  /**
   * Calcula el ID de la WO antes de la cual se debe insertar, basado en la posición del cursor.
   */
  const calculateInsertPosition = (clientX: number): string | undefined => {
    console.log('🎯 calculateInsertPosition iniciado:', {
      day,
      line,
      clientX
    });

    // CORREGIDO: Intentar múltiples selectores para encontrar las WOs
    let workOrderElements: HTMLElement[] = [];
    
    // Intento 1: Selector original
    workOrderElements = Array.from(
      document.querySelectorAll(`.work-order[data-day="${day}"][data-line="${line}"]`)
    ) as HTMLElement[];
    
    // Intento 2: Si no encuentra, probar con otros selectores comunes
    if (workOrderElements.length === 0) {
      workOrderElements = Array.from(
        document.querySelectorAll(`[data-day="${day}"][data-line="${line}"].work-order`)
      ) as HTMLElement[];
    }
    
    // Intento 3: Buscar por atributos específicos del día y línea
    if (workOrderElements.length === 0) {
      const allWOs = Array.from(document.querySelectorAll('[data-wo-id]')) as HTMLElement[];
      workOrderElements = allWOs.filter(el => 
        el.getAttribute('data-day') === day && 
        el.getAttribute('data-line') === line
      );
    }
    
    // Intento 4: Buscar dentro del contenedor del día/línea
    if (workOrderElements.length === 0) {
      const dayContainer = document.querySelector(`[data-day="${day}"][data-line="${line}"]`);
      if (dayContainer) {
        workOrderElements = Array.from(
          dayContainer.querySelectorAll('[data-wo-id]')
        ) as HTMLElement[];
      }
    }

    console.log('🔍 Elementos encontrados:', {
      totalFound: workOrderElements.length,
      selectors: [
        `.work-order[data-day="${day}"][data-line="${line}"]`,
        `[data-day="${day}"][data-line="${line}"].work-order`,
        '[data-wo-id] filtered',
        'container search'
      ],
      elements: workOrderElements.map(el => ({
        woId: el.dataset.woId || el.getAttribute('data-wo-id') || undefined,
        className: el.className,
        dataDay: el.dataset.day || el.getAttribute('data-day') || undefined,
        dataLine: el.dataset.line || el.getAttribute('data-line') || undefined,
        rect: el.getBoundingClientRect()
      }))
    });

    if (workOrderElements.length === 0) {
      console.warn('❌ No se encontraron elementos WO para este día/línea');
      return undefined; // Insertar al final por defecto
    }

    // CORREGIDO: Obtener posiciones y ordenar correctamente
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
      .filter(item => item.woId) // Solo elementos con ID válido
      .sort((a, b) => a.left - b.left); // Ordenar por posición left

    console.log('📍 Elementos con posiciones ordenados:', elementsWithPositions.map(item => ({
      woId: item.woId,
      left: item.left,
      right: item.right,
      center: item.center
    })));

    // CORREGIDO: Lógica mejorada para determinar posición de inserción
    for (let i = 0; i < elementsWithPositions.length; i++) {
      const current = elementsWithPositions[i];
      
      // CASO 1: Cursor está antes del primer elemento
      if (i === 0 && clientX < current.center) {
        console.log(`✅ Insertando antes del primer elemento: ${current.woId}`);
        return current.woId;
      }
      
      // CASO 2: Cursor está entre dos elementos
      if (i > 0) {
        const previous = elementsWithPositions[i - 1];
        
        // Si el cursor está entre el final del anterior y el centro del actual
        if (clientX > previous.right && clientX < current.center) {
          console.log(`✅ Insertando entre elementos, antes de: ${current.woId}`);
          return current.woId;
        }
        
        // Si el cursor está en la primera mitad del elemento actual
        if (clientX >= current.left && clientX < current.center) {
          console.log(`✅ Insertando en primera mitad de: ${current.woId}`);
          return current.woId;
        }
      }
    }

    // CASO 3: Si llegamos aquí, insertar al final
    console.log('✅ Insertando al final (después del último elemento)');
    return undefined;
  };

  /**
   * Configuración del área de drop
   */
  const [{ isOver, canDrop, draggedItem }, drop] = useDrop({
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
          draggedItems: item.workOrders,
          dropAreaLeft: left,
          dropAreaWidth: width
        });

        // AGREGADO: Validación adicional antes del drop
        if (!item.workOrders || item.workOrders.length === 0) {
          console.error('❌ No hay items para hacer drop');
          return;
        }

        onDrop(day, line, item.workOrders, insertBeforeWO);
      } else {
        console.log('⚠️ Drop cancelado:', {
          didDrop: monitor.didDrop(),
          hasClientOffset: !!clientOffset
        });
      }
    },
    canDrop: (item: { workOrders: string[] }) => {
      const canDropResult = item && item.workOrders && item.workOrders.length > 0;
      console.log('🔍 CanDrop check:', {
        item,
        result: canDropResult,
        day,
        line
      });
      return canDropResult;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
      draggedItem: monitor.getItem() as { workOrders: string[] } | null,
    }),
  });

  // SOLUCIÓN 1: Conectar la ref manualmente
  drop(dropRef);

  return (
    <div
      ref={dropRef} // Usar la ref en lugar de la función drop directamente
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
      onDragOver={(e) => {
        e.preventDefault();
        // REDUCIDO: Menos logging para evitar spam
        if (Math.random() < 0.1) { // Solo log del 10% de los eventos
          console.log('DropArea dragOver sample:', {
            day,
            line,
            clientX: e.clientX,
            isOver,
            canDrop
          });
        }
      }}
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