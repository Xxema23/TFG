// DetailTablesPanel/hooks/UseTableSync.ts - VERSIÓN DEFINITIVA
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

  // ✅ Guards para prevenir loops infinitos de scroll
  const isScrollingFromLeft = useRef(false);
  const isScrollingFromRight = useRef(false);

  // ✅ SCROLL SINCRONIZADO - UNA SOLA VEZ AL MONTAR
  useEffect(() => {
    // Esperamos a que los refs estén disponibles
    const timer = setTimeout(() => {
      const leftContainer = leftTableContainerRef.current;
      const rightContainer = rightTableContainerRef.current;
      
      if (!leftContainer || !rightContainer) {
        console.warn('⚠️ [UseTableSync] Contenedores no disponibles en el montaje');
        return;
      }
      
      const handleLeftScroll = () => {
        if (isScrollingFromRight.current) return;
        
        isScrollingFromLeft.current = true;
        rightContainer.scrollTop = leftContainer.scrollTop;
        
        setTimeout(() => {
          isScrollingFromLeft.current = false;
        }, 50);
      };
      
      const handleRightScroll = () => {
        if (isScrollingFromLeft.current) return;
        
        isScrollingFromRight.current = true;
        leftContainer.scrollTop = rightContainer.scrollTop;
        
        setTimeout(() => {
          isScrollingFromRight.current = false;
        }, 50);
      };
      
      console.log('✅ [UseTableSync] Registrando scroll listeners (PERMANENTEMENTE)');
      
      // Usar passive:false para prevenir comportamiento predeterminado si es necesario
      leftContainer.addEventListener('scroll', handleLeftScroll, { passive: true });
      rightContainer.addEventListener('scroll', handleRightScroll, { passive: true });
      
      // Cleanup solo cuando el componente se desmonta REALMENTE
      return () => {
        console.log('🧹 [UseTableSync] Limpiando scroll listeners (DESMONTAJE REAL)');
        leftContainer.removeEventListener('scroll', handleLeftScroll);
        rightContainer.removeEventListener('scroll', handleRightScroll);
      };
    }, 100); // Pequeño delay para asegurar que los refs están listos

    return () => clearTimeout(timer);
  }, []); // ✅ ARRAY VACÍO - solo se ejecuta al montar/desmontar

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
  }, [workOrders.length, localOrderedWOIds.length]);

  return {
    leftTableContainerRef,
    rightTableContainerRef,
    leftRowsRef,
    rightRowsRef
  };
};

export default UseTableSync;