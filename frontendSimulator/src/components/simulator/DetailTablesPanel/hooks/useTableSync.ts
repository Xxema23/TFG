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
  const leftTableContainerRef  = useRef<HTMLDivElement>(null);
  const rightTableContainerRef = useRef<HTMLDivElement>(null);
  const leftRowsRef  = useRef<{ [key: string]: HTMLTableRowElement | null }>({});
  const rightRowsRef = useRef<{ [key: string]: HTMLTableRowElement | null }>({});

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ SCROLL SINCRONIZADO — sin cambios, ya estaba bien implementado
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const left  = leftTableContainerRef.current;
    const right = rightTableContainerRef.current;
    if (!left || !right) return;

    let isSyncing = false;
    let rafId: number | null = null;

    const syncScroll = (source: HTMLElement, target: HTMLElement) => {
      if (isSyncing) return;
      if (rafId !== null) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        isSyncing = true;
        target.scrollTop = source.scrollTop;
        rafId = null;
        requestAnimationFrame(() => { isSyncing = false; });
      });
    };

    const handleLeftScroll  = () => syncScroll(left,  right);
    const handleRightScroll = () => syncScroll(right, left);

    left.addEventListener('scroll',  handleLeftScroll,  { passive: true, capture: false });
    right.addEventListener('scroll', handleRightScroll, { passive: true, capture: false });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      left.removeEventListener('scroll',  handleLeftScroll);
      right.removeEventListener('scroll', handleRightScroll);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ✅ SYNC DE ALTURAS ELIMINADA — ComponentsTable tiene máximo 10 columnas
  // fijas y filas de altura predecible (~34px). El setTimeout + offsetHeight
  // anterior forzaba un reflow completo del DOM en cada cambio de workOrders.length
  // (cada drag & drop que redistribuye WOs a días distintos). Ya no es necesario.
  //
  // Si en el futuro ComponentsTable vuelve a tener columnas variables o
  // contenido multilinea, restaurar el bloque de heightsSynced aquí.
  // ─────────────────────────────────────────────────────────────────────────

  return {
    leftTableContainerRef,
    rightTableContainerRef,
    leftRowsRef,
    rightRowsRef
  };
};

export default UseTableSync;