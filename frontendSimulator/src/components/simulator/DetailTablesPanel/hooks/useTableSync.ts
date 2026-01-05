// DetailTablesPanel/hooks/UseTableSync.ts - VERSIÓN LIMPIA SIN LOGS
// ✅ Sincroniza scroll (fluido)
// ✅ Sincroniza alturas UNA VEZ al montar
// ❌ SIN ResizeObserver (elimina lag)
// ❌ SIN recálculo constante (elimina lag)

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
  // ========================================
  // 1️⃣ REFERENCIAS
  // ========================================
  
  // Referencias para los contenedores de las tablas
  const leftTableContainerRef = useRef<HTMLDivElement>(null);
  const rightTableContainerRef = useRef<HTMLDivElement>(null);
  
  // Referencias para las filas
  const leftRowsRef = useRef<{[key: string]: HTMLTableRowElement | null}>({});
  const rightRowsRef = useRef<{[key: string]: HTMLTableRowElement | null}>({});

  // Ref para la función getOrderedWOIds
  const getOrderedWOIdsRef = useRef(getOrderedWOIds);
  getOrderedWOIdsRef.current = getOrderedWOIds;

  // Guards para prevenir loops infinitos de scroll
  const isScrollingFromLeft = useRef(false);
  const isScrollingFromRight = useRef(false);

  // Throttle para scroll sync
  const scrollThrottleTimer = useRef<number | null>(null);

  // ✅ Flag para saber si ya sincronizamos alturas
  const heightsSynced = useRef(false);

  // ========================================
  // 2️⃣ SCROLL SINCRONIZADO
  // ========================================
  
  useEffect(() => {
    const timer = setTimeout(() => {
      const leftContainer = leftTableContainerRef.current;
      const rightContainer = rightTableContainerRef.current;
      
      if (!leftContainer || !rightContainer) {
        return;
      }
      
      // Handler para scroll izquierda → derecha
      const handleLeftScroll = () => {
        if (isScrollingFromRight.current) return;
        if (scrollThrottleTimer.current) return;
        
        scrollThrottleTimer.current = requestAnimationFrame(() => {
          isScrollingFromLeft.current = true;
          rightContainer.scrollTop = leftContainer.scrollTop;
          scrollThrottleTimer.current = null;
          
          requestAnimationFrame(() => {
            isScrollingFromLeft.current = false;
          });
        });
      };
      
      // Handler para scroll derecha → izquierda
      const handleRightScroll = () => {
        if (isScrollingFromLeft.current) return;
        if (scrollThrottleTimer.current) return;
        
        scrollThrottleTimer.current = requestAnimationFrame(() => {
          isScrollingFromRight.current = true;
          leftContainer.scrollTop = rightContainer.scrollTop;
          scrollThrottleTimer.current = null;
          
          requestAnimationFrame(() => {
            isScrollingFromRight.current = false;
          });
        });
      };
      
      // Registrar listeners (passive: true para mejor performance)
      leftContainer.addEventListener('scroll', handleLeftScroll, { passive: true });
      rightContainer.addEventListener('scroll', handleRightScroll, { passive: true });
      
      return () => {
        if (scrollThrottleTimer.current) {
          cancelAnimationFrame(scrollThrottleTimer.current);
        }
        leftContainer.removeEventListener('scroll', handleLeftScroll);
        rightContainer.removeEventListener('scroll', handleRightScroll);
      };
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // ========================================
  // 3️⃣ SINCRONIZACIÓN DE ALTURAS - UNA VEZ AL MONTAR
  // ========================================
  
  useEffect(() => {
    // ✅ SOLO sincronizar UNA VEZ cuando haya workOrders
    if (workOrders.length === 0) {
      return;
    }

    // ✅ Si ya sincronizamos, NO volver a hacerlo
    if (heightsSynced.current) {
      return;
    }

    // ✅ Pequeño delay para asegurar que el DOM está listo
    const timer = setTimeout(() => {
      const filteredWOIds = getOrderedWOIdsRef.current();
      
      if (filteredWOIds.length === 0) {
        return;
      }

      // ✅ FASE 1: Recopilar mediciones (read phase)
      const measurements: Array<{
        woId: string;
        leftRow: HTMLTableRowElement;
        rightRow: HTMLTableRowElement;
        leftHeight: number;
        rightHeight: number;
      }> = [];

      filteredWOIds.forEach(woId => {
        const leftRow = leftRowsRef.current[woId];
        const rightRow = rightRowsRef.current[woId];
        
        if (!leftRow || !rightRow) return;
        
        measurements.push({
          woId,
          leftRow,
          rightRow,
          leftHeight: leftRow.offsetHeight,
          rightHeight: rightRow.offsetHeight
        });
      });

      // ✅ FASE 2: Aplicar cambios (write phase)
      let changesApplied = 0;
      measurements.forEach(({ leftRow, rightRow, leftHeight, rightHeight }) => {
        const maxHeight = Math.max(leftHeight, rightHeight);
        
        // Solo aplicar si hay diferencia > 2px
        if (Math.abs(leftHeight - maxHeight) > 2) {
          leftRow.style.height = `${maxHeight}px`;
          changesApplied++;
        }
        if (Math.abs(rightHeight - maxHeight) > 2) {
          rightRow.style.height = `${maxHeight}px`;
          changesApplied++;
        }
      });

      // ✅ SINCRONIZAR HEADERS
      const leftHeaderRow = document.querySelector('#left-table thead tr') as HTMLElement;
      const rightHeaderRow = document.querySelector('#right-table thead tr') as HTMLElement;
      
      if (leftHeaderRow && rightHeaderRow) {
        const leftHeight = leftHeaderRow.offsetHeight;
        const rightHeight = rightHeaderRow.offsetHeight;
        const maxHeight = Math.max(leftHeight, rightHeight);
        
        if (Math.abs(leftHeight - maxHeight) > 2) {
          leftHeaderRow.style.height = `${maxHeight}px`;
          changesApplied++;
        }
        if (Math.abs(rightHeight - maxHeight) > 2) {
          rightHeaderRow.style.height = `${maxHeight}px`;
          changesApplied++;
        }
      }
      
      // ✅ Marcar como sincronizado
      heightsSynced.current = true;

    }, 200); // 200ms delay para asegurar DOM listo

    return () => clearTimeout(timer);
  }, [workOrders.length]); // ✅ Solo cuando cambia el número de workOrders

  // ========================================
  // 4️⃣ RETURN
  // ========================================
  
  return {
    leftTableContainerRef,
    rightTableContainerRef,
    leftRowsRef,
    rightRowsRef
  };
};

export default UseTableSync;