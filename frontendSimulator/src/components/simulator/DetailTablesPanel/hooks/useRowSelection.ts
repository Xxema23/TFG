// DetailTablesPanel/hooks/UseRowSelection.ts - VERSIÓN CORREGIDA
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseRowSelectionProps {
  getOrderedWOIds: () => string[];
  selectedWorkOrderIds: string[];
  availableWOs: string[];
}

export const UseRowSelection = ({
  getOrderedWOIds,
  selectedWorkOrderIds,
  availableWOs
}: UseRowSelectionProps) => {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1);
  
  // Usar refs para evitar dependencias circulares
  const getOrderedWOIdsRef = useRef(getOrderedWOIds);
  const prevAvailableWOsRef = useRef<string>('');
  const prevSelectedWOsRef = useRef<string>('');
  
  // Mantener ref actualizada
  getOrderedWOIdsRef.current = getOrderedWOIds;

  // Función de selección mejorada con mejor logging
  const handleRowSelection = useCallback((woId: string, index: number, e: React.MouseEvent) => {
    console.log('🖱️ Row selection:', { woId, index, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey });
    
    setSelectedRows(prevSelected => {
      const newSelection = new Set(prevSelected);
      const filteredWOIds = getOrderedWOIdsRef.current();
      
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Click: Toggle individual selection
        if (newSelection.has(woId)) {
          newSelection.delete(woId);
          console.log('❌ Removed from selection:', woId);
        } else {
          newSelection.add(woId);
          console.log('✅ Added to selection:', woId);
        }
        setLastSelectedIndex(index);
        
      } else if (e.shiftKey && lastSelectedIndex !== -1) {
        // Shift+Click: Select range
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        console.log('📏 Range selection:', { start, end, lastSelectedIndex });
        
        for (let i = start; i <= end; i++) {
          const woIdAtIndex = filteredWOIds[i];
          if (woIdAtIndex) {
            newSelection.add(woIdAtIndex);
          }
        }
        
      } else {
        // Single click: Select only this row
        newSelection.clear();
        newSelection.add(woId);
        setLastSelectedIndex(index);
        console.log('🎯 Single selection:', woId);
      }
      
      console.log('📊 Final selection:', Array.from(newSelection));
      return newSelection;
    });
  }, [lastSelectedIndex]);

  // useEffect optimizado para evitar resets innecesarios
  useEffect(() => {
    const currentAvailableWOs = availableWOs.sort().join(',');
    const currentSelectedWOs = selectedWorkOrderIds.sort().join(',');
    
    // Solo resetear si realmente cambiaron los datos significativos
    const availableChanged = prevAvailableWOsRef.current !== currentAvailableWOs;
    const selectedChanged = prevSelectedWOsRef.current !== currentSelectedWOs;
    
    if (availableChanged || selectedChanged) {
      console.log('🔄 Resetting selection due to data changes:', {
        availableChanged,
        selectedChanged,
        newAvailableCount: availableWOs.length,
        newSelectedCount: selectedWorkOrderIds.length
      });
      
      setSelectedRows(new Set());
      setLastSelectedIndex(-1);
      
      // Actualizar refs
      prevAvailableWOsRef.current = currentAvailableWOs;
      prevSelectedWOsRef.current = currentSelectedWOs;
    }
  }, [availableWOs, selectedWorkOrderIds]);

  // Función para seleccionar múltiples filas programáticamente
  const selectRows = useCallback((woIds: string[]) => {
    setSelectedRows(new Set(woIds));
  }, []);

  // Función para limpiar selección
  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
    setLastSelectedIndex(-1);
  }, []);

  // Función para obtener filas seleccionadas como array
  const getSelectedRowsArray = useCallback(() => {
    return Array.from(selectedRows);
  }, [selectedRows]);

  return {
    selectedRows,
    setSelectedRows,
    handleRowSelection,
    selectedRowsArray: getSelectedRowsArray(),
    selectedCount: selectedRows.size,
    selectRows,
    clearSelection,
    lastSelectedIndex
  };
};

export default UseRowSelection;