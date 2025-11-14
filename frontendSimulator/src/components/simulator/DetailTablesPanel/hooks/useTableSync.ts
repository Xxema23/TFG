// DetailTablesPanel/hooks/UseTableSync.ts - VERSIÓN CORREGIDA
import { useRef, useEffect } from 'react';

interface UseTableSyncProps {
  workOrders: any[];
  selectedWorkOrderIds: string[];
  availableWOs: string[];
  localOrderedWOIds: string[];
  getOrderedWOIds: () => string[];
}

export const UseTableSync = ({
  workOrders,
  selectedWorkOrderIds,
  availableWOs,
  localOrderedWOIds,
  getOrderedWOIds
}: UseTableSyncProps) => {
  // ✅ Referencias para los contenedores de las tablas
  const leftTableContainerRef = useRef<HTMLDivElement>(null);
  const rightTableContainerRef = useRef<HTMLDivElement>(null);
  
  // ✅ Referencias para las filas
  const leftRowsRef = useRef<{[key: string]: HTMLTableRowElement | null}>({});
  const rightRowsRef = useRef<{[key: string]: HTMLTableRowElement | null}>({});

  // ✅ Ref para la función para evitar dependencias circulares
  const getOrderedWOIdsRef = useRef(getOrderedWOIds);
  getOrderedWOIdsRef.current = getOrderedWOIds;

  // ✅ Sincronización de scroll entre tablas
  useEffect(() => {
    const leftContainer = leftTableContainerRef.current;
    const rightContainer = rightTableContainerRef.current;
    
    if (!leftContainer || !rightContainer) return;
    
    const handleLeftScroll = () => {
      rightContainer.scrollTop = leftContainer.scrollTop;
    };
    
    const handleRightScroll = () => {
      leftContainer.scrollTop = rightContainer.scrollTop;
    };
    
    leftContainer.addEventListener('scroll', handleLeftScroll);
    rightContainer.addEventListener('scroll', handleRightScroll);
    
    return () => {
      leftContainer.removeEventListener('scroll', handleLeftScroll);
      rightContainer.removeEventListener('scroll', handleRightScroll);
    };
  }, []); // ✅ Dependencias vacías - solo se ejecuta una vez

  // ✅ Sincronización de alturas de filas (con throttling para performance)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const syncRowHeights = () => {
      const filteredWOIds = getOrderedWOIdsRef.current();
      
      // ✅ Sincronizar encabezados
      const leftHeaderRow = document.querySelector('#left-table thead tr') as HTMLElement;
      const rightHeaderRow = document.querySelector('#right-table thead tr') as HTMLElement;
      
      if (leftHeaderRow && rightHeaderRow) {
        const leftHeight = leftHeaderRow.getBoundingClientRect().height;
        const rightHeight = rightHeaderRow.getBoundingClientRect().height;
        const maxHeight = Math.max(leftHeight, rightHeight);
        
        leftHeaderRow.style.height = `${maxHeight}px`;
        rightHeaderRow.style.height = `${maxHeight}px`;
      }
      
      // ✅ Sincronizar filas del cuerpo
      filteredWOIds.forEach(woId => {
        const leftRow = leftRowsRef.current[woId];
        const rightRow = rightRowsRef.current[woId];
        
        if (!leftRow || !rightRow) return;
        
        // Resetear alturas
        leftRow.style.height = '';
        rightRow.style.height = '';
        
        // Calcular nueva altura
        requestAnimationFrame(() => {
          const leftHeight = leftRow.getBoundingClientRect().height;
          const rightHeight = rightRow.getBoundingClientRect().height;
          const maxHeight = Math.max(leftHeight, rightHeight) + 1;
          
          leftRow.style.height = `${maxHeight}px`;
          rightRow.style.height = `${maxHeight}px`;
        });
      });
    };
    
    // ✅ Throttle para evitar demasiadas ejecuciones
    const throttledSync = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(syncRowHeights, 100);
    };
    
    throttledSync();
    
    // ✅ Observer para detectar cambios en el tamaño
    const resizeObserver = new ResizeObserver(throttledSync);
    
    if (leftTableContainerRef.current) {
      resizeObserver.observe(leftTableContainerRef.current);
    }
    if (rightTableContainerRef.current) {
      resizeObserver.observe(rightTableContainerRef.current);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [workOrders.length, localOrderedWOIds.length]); // ✅ Dependencias estables

  return {
    leftTableContainerRef,
    rightTableContainerRef,
    leftRowsRef,
    rightRowsRef
  };
};

export default UseTableSync;