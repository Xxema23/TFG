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
  const leftTableContainerRef = useRef<HTMLDivElement>(null);
  const rightTableContainerRef = useRef<HTMLDivElement>(null);
  const leftRowsRef = useRef<{[key: string]: HTMLTableRowElement | null}>({});
  const rightRowsRef = useRef<{[key: string]: HTMLTableRowElement | null}>({});

  const heightsSynced = useRef(false);
  const getOrderedWOIdsRef = useRef(getOrderedWOIds);
  getOrderedWOIdsRef.current = getOrderedWOIds;

  // ========================================
  // ✅ SCROLL SINCRONIZADO ULTRA-OPTIMIZADO
  // ========================================
  useEffect(() => {
    const left = leftTableContainerRef.current;
    const right = rightTableContainerRef.current;
    if (!left || !right) return;

    let isSyncing = false;
    let rafId: number | null = null;

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      if (isSyncing) return;
      
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        isSyncing = true;
        target.scrollTop = source.scrollTop;
        rafId = null;
        
        // Liberar el flag en el siguiente frame
        requestAnimationFrame(() => {
          isSyncing = false;
        });
      });
    };

    const handleLeftScroll = () => syncScroll(left, right);
    const handleRightScroll = () => syncScroll(right, left);

    // ✅ passive: true + capture: false = máxima performance
    left.addEventListener('scroll', handleLeftScroll, { passive: true, capture: false });
    right.addEventListener('scroll', handleRightScroll, { passive: true, capture: false });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      left.removeEventListener('scroll', handleLeftScroll);
      right.removeEventListener('scroll', handleRightScroll);
    };
  }, []);

  // ========================================
  // SINCRONIZACIÓN DE ALTURAS - UNA VEZ
  // ========================================
  useEffect(() => {
    if (workOrders.length === 0 || heightsSynced.current) return;

    const timer = setTimeout(() => {
      const filteredWOIds = getOrderedWOIdsRef.current();
      if (filteredWOIds.length === 0) return;

      const measurements: Array<{
        leftRow: HTMLTableRowElement;
        rightRow: HTMLTableRowElement;
        maxHeight: number;
      }> = [];

      filteredWOIds.forEach(woId => {
        const leftRow = leftRowsRef.current[woId];
        const rightRow = rightRowsRef.current[woId];
        if (!leftRow || !rightRow) return;

        const lh = leftRow.offsetHeight;
        const rh = rightRow.offsetHeight;
        const maxHeight = Math.max(lh, rh);

        if (Math.abs(lh - rh) > 2) {
          measurements.push({ leftRow, rightRow, maxHeight });
        }
      });

      measurements.forEach(({ leftRow, rightRow, maxHeight }) => {
        leftRow.style.height = `${maxHeight}px`;
        rightRow.style.height = `${maxHeight}px`;
      });

      const leftHeader = document.querySelector('#left-table thead tr') as HTMLElement;
      const rightHeader = document.querySelector('#right-table thead tr') as HTMLElement;
      if (leftHeader && rightHeader) {
        const maxH = Math.max(leftHeader.offsetHeight, rightHeader.offsetHeight);
        leftHeader.style.height = `${maxH}px`;
        rightHeader.style.height = `${maxH}px`;
      }

      heightsSynced.current = true;
    }, 200);

    return () => clearTimeout(timer);
  }, [workOrders.length]);

  useEffect(() => {
    heightsSynced.current = false;
  }, [workOrders.length]);

  return {
    leftTableContainerRef,
    rightTableContainerRef,
    leftRowsRef,
    rightRowsRef
  };
};

export default UseTableSync;  