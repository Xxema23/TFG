// hooks/useDragAndDrop.ts - VERSIÓN CORREGIDA
import { useState, useCallback, useRef } from 'react';
import { DragState } from '../Types';

interface UseDragAndDropProps {
  getOrderedWOIds: () => string[];
  selectedRows: Set<string>;
  onReorderWO?: (newOrder: string[]) => void;
  onLocalReorder: (newOrder: string[]) => void;
  onRowSelection: (woId: string, index: number, e: React.MouseEvent) => void;
}

export const useDragAndDrop = ({
  getOrderedWOIds,
  selectedRows,
  onReorderWO,
  onLocalReorder,
  onRowSelection
}: UseDragAndDropProps) => {
  const [dragState, setDragState] = useState<DragState>({
    draggedWO: null,
    draggedOverWO: null,
    isDragging: false
  });

  // Usar refs para evitar stale closures
  const selectedRowsRef = useRef<Set<string>>(new Set());
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Mantener ref actualizada
  selectedRowsRef.current = selectedRows;

  const handleDragStart = useCallback((e: React.DragEvent<HTMLTableRowElement>, woId: string) => {
    console.log('🎯 Drag start:', woId, 'Selected:', Array.from(selectedRowsRef.current));
    
    const filteredWOIds = getOrderedWOIds();
    const index = filteredWOIds.indexOf(woId);
    
    // CRÍTICO: Si la fila que estamos arrastrando no está seleccionada, seleccionarla ANTES
    if (!selectedRowsRef.current.has(woId)) {
      console.log('🔄 Seleccionando fila antes del drag:', woId);
      // Crear evento sintético para la selección
      const syntheticEvent = {
        ...e,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        stopPropagation: () => {},
        preventDefault: () => {}
      } as React.MouseEvent;
      
      onRowSelection(woId, index, syntheticEvent);
      
      // Esperar un tick para que se actualice la selección
      setTimeout(() => {
        initiateDrag(e, woId);
      }, 0);
      return;
    }
    
    initiateDrag(e, woId);
  }, [getOrderedWOIds, onRowSelection]);

  const initiateDrag = useCallback((e: React.DragEvent<HTMLTableRowElement>, woId: string) => {
    console.log('🚀 Iniciando drag real:', woId);
    
    setDragState({
      draggedWO: woId,
      draggedOverWO: null,
      isDragging: true
    });
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', woId);
    
    // Crear imagen de arrastre personalizada mejorada
    const count = selectedRowsRef.current.size;
    const dragText = count === 1 ? 'Moviendo 1 WO' : `Moviendo ${count} WOs`;
    
    const dragImage = document.createElement('div');
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      background: rgba(59, 130, 246, 0.95);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      fontSize: 14px;
      fontWeight: bold;
      boxShadow: 0 4px 12px rgba(0,0,0,0.3);
      zIndex: 9999;
      pointerEvents: none;
    `;
    dragImage.textContent = dragText;
    
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 60, 20);
    
    // Limpiar imagen después del drag
    dragTimeoutRef.current = setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 100);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTableRowElement>, woId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Solo cambiar el target si es diferente y no está seleccionado
    if (dragState.draggedWO && 
        dragState.draggedWO !== woId && 
        !selectedRowsRef.current.has(woId) &&
        dragState.draggedOverWO !== woId) {
      
      setDragState(prev => ({ 
        ...prev, 
        draggedOverWO: woId 
      }));
    }
  }, [dragState.draggedWO, dragState.draggedOverWO]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLTableRowElement>, woId: string) => {
    e.preventDefault();
    // Solo procesar si es un target válido
    if (dragState.draggedWO && 
        dragState.draggedWO !== woId && 
        !selectedRowsRef.current.has(woId)) {
      
      setDragState(prev => ({ 
        ...prev, 
        draggedOverWO: woId 
      }));
    }
  }, [dragState.draggedWO]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    
    // Verificar si realmente salimos del elemento
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    const isOutside = x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
    
    if (isOutside) {
      setDragState(prev => ({ 
        ...prev, 
        draggedOverWO: null 
      }));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLTableRowElement>, targetWoId: string) => {
    e.preventDefault();
    console.log('🎯 Drop en:', targetWoId, 'Selected:', Array.from(selectedRowsRef.current));
    
    if (!dragState.draggedWO || selectedRowsRef.current.size === 0) {
      console.log('❌ Drop inválido: no hay drag activo o selección');
      return;
    }
    
    // Si arrastramos sobre una WO seleccionada, cancelar
    if (selectedRowsRef.current.has(targetWoId)) {
      console.log('❌ Drop cancelado: target está seleccionado');
      resetDragState();
      return;
    }
    
    try {
      const currentOrder = getOrderedWOIds();
      const targetIndex = currentOrder.indexOf(targetWoId);
      
      if (targetIndex === -1) {
        console.log('❌ Target no encontrado en orden actual');
        resetDragState();
        return;
      }
      
      // Crear nuevo orden
      const newOrder = [...currentOrder];
      const selectedWOs = Array.from(selectedRowsRef.current);
      
      console.log('🔄 Reordenando:', {
        selectedWOs,
        targetWoId,
        targetIndex,
        originalOrder: currentOrder.length
      });
      
      // Remover las WOs seleccionadas (en orden inverso para mantener índices)
      const removedItems: { wo: string; originalIndex: number }[] = [];
      for (let i = newOrder.length - 1; i >= 0; i--) {
        if (selectedRowsRef.current.has(newOrder[i])) {
          const removed = newOrder.splice(i, 1)[0];
          removedItems.unshift({ wo: removed, originalIndex: i });
        }
      }
      
      // Recalcular posición de inserción
      let insertIndex = newOrder.indexOf(targetWoId);
      if (insertIndex === -1) {
        insertIndex = newOrder.length;
      }
      
      // Insertar elementos en nueva posición
      const itemsToInsert = removedItems.map(item => item.wo);
      newOrder.splice(insertIndex, 0, ...itemsToInsert);
      
      console.log('✅ Nuevo orden creado:', {
        original: currentOrder.length,
        new: newOrder.length,
        insertedAt: insertIndex,
        items: itemsToInsert.length
      });
      
      // Aplicar reorden
      if (onReorderWO) {
        onReorderWO(newOrder);
      } else {
        onLocalReorder(newOrder);
      }
      
    } catch (error) {
      console.error('❌ Error en handleDrop:', error);
    } finally {
      resetDragState();
    }
  }, [dragState.draggedWO, getOrderedWOIds, onReorderWO, onLocalReorder]);

  const handleDragEnd = useCallback(() => {
    console.log('🏁 Drag end');
    resetDragState();
  }, []);

  const resetDragState = useCallback(() => {
    setDragState({
      draggedWO: null,
      draggedOverWO: null,
      isDragging: false
    });
    
    // Limpiar timeout si existe
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
  }, []);

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd
  };
};