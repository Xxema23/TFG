import { useRef, useCallback, useEffect } from 'react';

interface UseTableRefsReturn {
  leftRowsRef: React.MutableRefObject<{[key: string]: HTMLTableRowElement | null}>;
  rightRowsRef: React.MutableRefObject<{[key: string]: HTMLTableRowElement | null}>;
  clearRefs: () => void;
  clearLeftRefs: () => void;
  clearRightRefs: () => void;
  getRefStats: () => {
    leftRefs: number;
    rightRefs: number;
    totalRefs: number;
  };
  validateRefs: (expectedWOIds: string[]) => {
    valid: boolean;
    missing: string[];
    extra: string[];
  };
  debugRefs: (expectedWOIds: string[]) => void;
}

export const useTableRefs = (): UseTableRefsReturn => {
  const leftRowsRef = useRef<{[key: string]: HTMLTableRowElement | null}>({});
  const rightRowsRef = useRef<{[key: string]: HTMLTableRowElement | null}>({});

  // ✅ Función para limpiar todas las refs
  const clearRefs = useCallback(() => {
    console.log('🧹 Limpiando todas las refs de tablas');
    leftRowsRef.current = {};
    rightRowsRef.current = {};
  }, []);

  // ✅ Función para limpiar solo refs izquierdas
  const clearLeftRefs = useCallback(() => {
    console.log('🧹 Limpiando refs izquierdas');
    leftRowsRef.current = {};
  }, []);

  // ✅ Función para limpiar solo refs derechas
  const clearRightRefs = useCallback(() => {
    console.log('🧹 Limpiando refs derechas');
    rightRowsRef.current = {};
  }, []);

  // ✅ Función para obtener estadísticas de refs
  const getRefStats = useCallback(() => {
    const leftKeys = Object.keys(leftRowsRef.current);
    const rightKeys = Object.keys(rightRowsRef.current);
    
    const leftRefs = leftKeys.filter(
      key => leftRowsRef.current[key] !== null
    ).length;
    
    const rightRefs = rightKeys.filter(
      key => rightRowsRef.current[key] !== null
    ).length;

    return {
      leftRefs,
      rightRefs,
      totalRefs: leftRefs + rightRefs
    };
  }, []);

  // ✅ Función para validar refs contra WO IDs esperados
  const validateRefs = useCallback((expectedWOIds: string[]) => {
    const expectedSet = new Set(expectedWOIds);
    const leftKeys = new Set(Object.keys(leftRowsRef.current));
    const rightKeys = new Set(Object.keys(rightRowsRef.current));
    
    // Encontrar WO IDs que deberían tener refs pero no las tienen
    const missing = expectedWOIds.filter(woId => {
      const hasLeftRef = leftKeys.has(woId) && leftRowsRef.current[woId] !== null;
      const hasRightRef = rightKeys.has(woId) && rightRowsRef.current[woId] !== null;
      return !hasLeftRef || !hasRightRef;
    });
    
    // Encontrar refs que existen pero no deberían
    const extraLeft = Array.from(leftKeys).filter(woId => !expectedSet.has(woId));
    const extraRight = Array.from(rightKeys).filter(woId => !expectedSet.has(woId));
    const extra = [...new Set([...extraLeft, ...extraRight])];
    
    const valid = missing.length === 0 && extra.length === 0;
    
    if (!valid) {
      console.warn('⚠️ Validación de refs falló:', { missing, extra });
    }
    
    return { valid, missing, extra };
  }, []);

  // ✅ Función para hacer debug en consola
  const debugRefs = useCallback((expectedWOIds: string[]) => {
    const stats = getRefStats();
    const validation = validateRefs(expectedWOIds);
    
    console.group('🔍 Debug de Refs de Tablas');
    console.log('📊 Estadísticas:', stats);
    console.log('✅ Validación:', validation);
    console.log('🎯 Expected WOs:', expectedWOIds.length);
    console.log('📝 Expected IDs:', expectedWOIds);
    
    if (!validation.valid) {
      console.warn('❌ Refs faltantes:', validation.missing);
      console.warn('🗑️ Refs extra:', validation.extra);
    } else {
      console.log('✅ Todas las refs están correctas');
    }
    
    console.groupEnd();
  }, [getRefStats, validateRefs]);

  // ✅ Limpiar refs al desmontar el componente
  useEffect(() => {
    return () => {
      clearRefs();
    };
  }, [clearRefs]);

  return {
    leftRowsRef,
    rightRowsRef,
    clearRefs,
    clearLeftRefs,
    clearRightRefs,
    getRefStats,
    validateRefs,
    debugRefs
  };
};

// ✅ Hook para sincronización de scroll entre tablas (OPCIONAL)
export const useTableScrollSync = (
  leftTableRef: React.RefObject<HTMLDivElement>,
  rightTableRef: React.RefObject<HTMLDivElement>
) => {
  useEffect(() => {
    const leftTable = leftTableRef.current;
    const rightTable = rightTableRef.current;
    
    if (!leftTable || !rightTable) return;

    let isLeftScrolling = false;
    let isRightScrolling = false;

    const handleLeftScroll = () => {
      if (isRightScrolling) return;
      isLeftScrolling = true;
      rightTable.scrollTop = leftTable.scrollTop;
      setTimeout(() => { isLeftScrolling = false; }, 10);
    };

    const handleRightScroll = () => {
      if (isLeftScrolling) return;
      isRightScrolling = true;
      leftTable.scrollTop = rightTable.scrollTop;
      setTimeout(() => { isRightScrolling = false; }, 10);
    };

    leftTable.addEventListener('scroll', handleLeftScroll);
    rightTable.addEventListener('scroll', handleRightScroll);

    return () => {
      leftTable.removeEventListener('scroll', handleLeftScroll);
      rightTable.removeEventListener('scroll', handleRightScroll);
    };
  }, [leftTableRef, rightTableRef]);
};

export default useTableRefs;