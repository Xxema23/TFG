// src/components/simulator/DetailTablesPanel/utils/TableHelpers.ts

/**
 * Obtiene la lista de IDs ordenada según los criterios aplicados
 */
export const getOrderedWOIds = (
  selectedWorkOrderIds: string[], 
  availableWOs: string[], 
  localOrderedWOIds: string[]
): string[] => {
  // Si hay un orden local (por arrastrar y soltar), utilizarlo
  if (localOrderedWOIds.length > 0) {
    // Asegurarse de que no falten elementos
    const result = [...localOrderedWOIds];
    
    // Añadir cualquier elemento disponible que no esté en el orden local
    availableWOs.forEach(woId => {
      if (!result.includes(woId)) {
        result.push(woId);
      }
    });
    
    return result;
  }
  
  // Si hay selección, mostrar primero los elementos seleccionados
  if (selectedWorkOrderIds.length > 0) {
    const result = [...selectedWorkOrderIds];
    
    // Añadir el resto de elementos disponibles no seleccionados
    availableWOs.forEach(woId => {
      if (!result.includes(woId)) {
        result.push(woId);
      }
    });
    
    return result;
  }
  
  // Si no hay selección ni orden local, devolver los disponibles
  return [...availableWOs];
};

/**
 * Obtener las clases CSS para las filas de las tablas
 */
export const getRowClasses = (
  woId: string,
  hoveredRowId: string | null,
  selectedRows: Set<string>,
  isDragging: boolean,
  draggedOverWO: string | null
): string => {
  const classes = [
    'transition-all duration-150 cursor-grab active:cursor-grabbing'
  ];
  
  // Fila sobre la que está el ratón
  if (hoveredRowId === woId) {
    classes.push('bg-blue-50');
  } else {
    classes.push('hover:bg-gray-50');
  }
  
  // Fila seleccionada
  if (selectedRows.has(woId)) {
    classes.push('bg-blue-100 border-blue-200');
  }
  
  // Fila que se está arrastrando
  if (isDragging && selectedRows.has(woId)) {
    classes.push('opacity-60 transform rotate-1');
  }
  
  // Fila sobre la que se está arrastrando
  if (draggedOverWO === woId && !selectedRows.has(woId)) {
    classes.push('border-t-4 border-blue-500');
  }
  
  return classes.join(' ');
};

/**
 * Formatear valor numérico como moneda
 */
export const formatCurrency = (value?: number): string => {
  if (value === undefined || value === null) return '';
  
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
};