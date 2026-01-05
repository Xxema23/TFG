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
  
  const getOrderedWOIdsRef = useRef(getOrderedWOIds);
  const prevAvailableWOsRef = useRef<string>('');
  const prevSelectedWOsRef = useRef<string>('');
  
  getOrderedWOIdsRef.current = getOrderedWOIds;

  const handleRowSelection = useCallback((woId: string, index: number, e: React.MouseEvent) => {
    setSelectedRows(prevSelected => {
      const newSelection = new Set(prevSelected);
      const filteredWOIds = getOrderedWOIdsRef.current();
      
      if (e.ctrlKey || e.metaKey) {
        if (newSelection.has(woId)) {
          newSelection.delete(woId);
        } else {
          newSelection.add(woId);
        }
        setLastSelectedIndex(index);
        
      } else if (e.shiftKey && lastSelectedIndex !== -1) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        for (let i = start; i <= end; i++) {
          const woIdAtIndex = filteredWOIds[i];
          if (woIdAtIndex) {
            newSelection.add(woIdAtIndex);
          }
        }
        
      } else {
        newSelection.clear();
        newSelection.add(woId);
        setLastSelectedIndex(index);
      }
      
      return newSelection;
    });
  }, [lastSelectedIndex]);

  useEffect(() => {
    const currentAvailableWOs = availableWOs.sort().join(',');
    const currentSelectedWOs = selectedWorkOrderIds.sort().join(',');
    
    const availableChanged = prevAvailableWOsRef.current !== currentAvailableWOs;
    const selectedChanged = prevSelectedWOsRef.current !== currentSelectedWOs;
    
    if (availableChanged || selectedChanged) {
      setSelectedRows(new Set());
      setLastSelectedIndex(-1);
      
      prevAvailableWOsRef.current = currentAvailableWOs;
      prevSelectedWOsRef.current = currentSelectedWOs;
    }
  }, [availableWOs, selectedWorkOrderIds]);

  const selectRows = useCallback((woIds: string[]) => {
    setSelectedRows(new Set(woIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
    setLastSelectedIndex(-1);
  }, []);

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