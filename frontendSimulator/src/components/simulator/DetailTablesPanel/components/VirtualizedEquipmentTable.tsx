// src/components/simulator/DetailTablesPanel/components/VirtualizedEquipmentTable.tsx
import React, { useState, memo, useMemo, useCallback } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { WorkOrder } from '../Types';
import { DateEditor } from './DateEditor';
import { getRowClasses, formatCurrency } from '../utils/TableHelpers';

interface VirtualizedEquipmentTableProps {
  filteredWOIds: string[];
  workOrders: WorkOrder[];
  hoveredRowId: string | null;
  selectedRows: Set<string>;
  isDragging: boolean;
  draggedOverWO: string | null;
  onRowSelection: (woId: string, index: number, e: React.MouseEvent<HTMLDivElement>) => void;
  onRowHover: (woId: string | null) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, woId: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, woId: string) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>, woId: string) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, woId: string) => void;
  onDragEnd: () => void;
  onUpdateWorkOrder?: (woId: string, field: string, value: any) => void;
}

// Interfaz para los datos que se pasan a cada fila
interface RowData {
  filteredWOIds: string[];
  workOrdersMap: Map<string, WorkOrder>;
  hoveredRowId: string | null;
  selectedRows: Set<string>;
  isDragging: boolean;
  draggedOverWO: string | null;
  editingWO: string | null;
  newDate: string;
  onRowSelection: (woId: string, index: number, e: React.MouseEvent<HTMLDivElement>) => void;
  onRowHover: (woId: string | null) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, woId: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, woId: string) => void;
  onDragEnter: (e: React.DragEvent<HTMLDivElement>, woId: string) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, woId: string) => void;
  onDragEnd: () => void;
  startEditing: (woId: string, currentDate: string, e: React.MouseEvent) => void;
  saveDate: (newDateValue: string) => void;
  cancelEditing: (e: React.MouseEvent) => void;
  setNewDate: (date: string) => void;
}

// Función para formatear fechas
const formatDateDisplay = (dateString: string | undefined | null): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.warn('Error al formatear fecha:', error, dateString);
    return dateString;
  }
};

// Función para formatear horas
const formatHours = (hours: number | string | undefined | null): string => {
  if (hours === undefined || hours === null || hours === '') return '0.00';
  
  const numericHours = typeof hours === 'string' ? parseFloat(hours) : hours;
  
  if (typeof numericHours !== 'number' || isNaN(numericHours)) return '0.00';
  
  return numericHours.toFixed(2);
};

// Función para obtener información de palets
const getPaletInfo = (wo: WorkOrder): string => {
  if (!wo) return '-';
  
  try {
    if (wo.paletInfo && wo.paletInfo.num_de_palet) {
      return String(wo.paletInfo.num_de_palet);
    }
    
    // Fallback para otros posibles campos de palet
    if ((wo as any).numPalet) {
      return String((wo as any).numPalet);
    }
    
    if ((wo as any).palet) {
      return String((wo as any).palet);
    }
    
    return '-';
  } catch (error) {
    console.warn('Error al obtener información de palet:', error, wo);
    return '-';
  }
};

// Componente memorizado para cada fila
const WorkOrderRow = memo<ListChildComponentProps<RowData>>(({ index, style, data }) => {
  const woId = data.filteredWOIds[index];
  const wo = data.workOrdersMap.get(woId);
  
  // Memorizar clases de fila
  const rowClasses = useMemo(() => 
    getRowClasses(woId, data.hoveredRowId, data.selectedRows, data.isDragging, data.draggedOverWO),
    [woId, data.hoveredRowId, data.selectedRows, data.isDragging, data.draggedOverWO]
  );

  if (!wo) {
    return (
      <div style={style}>
        <div className={`h-full flex items-center justify-center ${rowClasses} border-b`}>
          <span className="text-red-400 text-xs">⚠️ {woId} - Datos no disponibles</span>
        </div>
      </div>
    );
  }

  // Handlers de drag events memorizados
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    data.onDragStart(e, woId);
  }, [data.onDragStart, woId]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    data.onDragOver(e, woId);
  }, [data.onDragOver, woId]);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    data.onDragEnter(e, woId);
  }, [data.onDragEnter, woId]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    data.onDragLeave(e);
  }, [data.onDragLeave]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    data.onDrop(e, woId);
  }, [data.onDrop, woId]);

  const handleRowClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    data.onRowSelection(woId, index, e);
  }, [data.onRowSelection, woId, index]);

  const handleMouseEnter = useCallback(() => {
    data.onRowHover(woId);
  }, [data.onRowHover, woId]);

  const handleMouseLeave = useCallback(() => {
    data.onRowHover(null);
  }, [data.onRowHover]);

  const handleStartEdit = useCallback((e: React.MouseEvent) => {
    data.startEditing(wo.id, wo.fchObjetivo || '', e);
  }, [data.startEditing, wo.id, wo.fchObjetivo]);

  return (
    <div style={style}>
      <div 
        draggable
        className={`h-full flex items-center ${rowClasses} border-b cursor-grab active:cursor-grabbing transition-colors duration-150`}
        onClick={handleRowClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onDragEnd={data.onDragEnd}
        role="row"
        tabIndex={0}
        aria-selected={data.selectedRows.has(woId)}
      >
        <div className="px-2 text-xs whitespace-nowrap w-20 flex-shrink-0 font-medium">
          {wo.numWO || ''}
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-20 flex-shrink-0">
          {wo.equipo || ''}
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-20 flex-shrink-0 text-center">
          {wo.secuencia || ''}
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-16 flex-shrink-0 text-center">
          {wo.linea || ''}
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-20 flex-shrink-0">
          {wo.numDoc || ''}
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-20 flex-shrink-0">
          {wo.tipDoc || ''}
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-16 flex-shrink-0 text-center">
          <span className={getPaletInfo(wo) === '-' ? 'text-gray-400' : 'text-blue-600 font-medium'}>
            {getPaletInfo(wo)}
          </span>
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-20 flex-shrink-0">
          <span className={`px-2 py-1 rounded-full text-xs ${
            wo.estadoWO === 'Completado' ? 'bg-green-100 text-green-800' :
            wo.estadoWO === 'En Proceso' ? 'bg-yellow-100 text-yellow-800' :
            wo.estadoWO === 'Pendiente' ? 'bg-gray-100 text-gray-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {wo.estadoWO || ''}
          </span>
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-24 flex-shrink-0">
          <DateEditor
            currentDate={wo.fchObjetivo || ''}
            isEditing={data.editingWO === wo.id}
            onStartEdit={handleStartEdit}
            onSave={data.saveDate}
            onCancel={data.cancelEditing}
            onDateChange={data.setNewDate}
            value={data.newDate}
          />
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-24 flex-shrink-0">
          {formatDateDisplay(wo.fchAcuse)}
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-24 flex-shrink-0">
          {formatDateDisplay(wo.fchAlbarAn)}
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-20 flex-shrink-0 text-right">
          <span className="font-medium text-green-600">
            {formatCurrency(wo.importe)}
          </span>
        </div>
        <div className="px-2 text-xs whitespace-nowrap w-20 flex-shrink-0 text-right">
          <span className="font-medium text-blue-600">
            {formatHours(wo.cshTotal)} h
          </span>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Función de comparación personalizada para evitar re-renders innecesarios
  const prevWoId = prevProps.data.filteredWOIds[prevProps.index];
  const nextWoId = nextProps.data.filteredWOIds[nextProps.index];
  
  if (prevWoId !== nextWoId) return false;
  if (prevProps.data.hoveredRowId !== nextProps.data.hoveredRowId) return false;
  if (prevProps.data.selectedRows !== nextProps.data.selectedRows) return false;
  if (prevProps.data.isDragging !== nextProps.data.isDragging) return false;
  if (prevProps.data.draggedOverWO !== nextProps.data.draggedOverWO) return false;
  if (prevProps.data.editingWO !== nextProps.data.editingWO) return false;
  if (prevProps.data.newDate !== nextProps.data.newDate) return false;
  
  // Comparar el work order específico
  const prevWO = prevProps.data.workOrdersMap.get(prevWoId);
  const nextWO = nextProps.data.workOrdersMap.get(nextWoId);
  
  return prevWO === nextWO;
});

WorkOrderRow.displayName = 'WorkOrderRow';

// Componente principal con optimizaciones
export const VirtualizedEquipmentTable: React.FC<VirtualizedEquipmentTableProps> = memo(({
  filteredWOIds,
  workOrders,
  hoveredRowId,
  selectedRows,
  isDragging,
  draggedOverWO,
  onRowSelection,
  onRowHover,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragEnd,
  onUpdateWorkOrder
}) => {
  const [editingWO, setEditingWO] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');

  // Crear Map para acceso O(1) a work orders
  const workOrdersMap = useMemo(() => {
    const map = new Map<string, WorkOrder>();
    if (workOrders && Array.isArray(workOrders)) {
      workOrders.forEach(wo => {
        if (wo && wo.id) {
          map.set(wo.id, wo);
        }
      });
    }
    return map;
  }, [workOrders]);

  // Funciones memorizadas para edición de fechas
  const startEditing = useCallback((woId: string, currentDate: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    setEditingWO(woId);
    
    // Formatear la fecha al formato YYYY-MM-DD para el input date
    try {
      let formattedDate = currentDate || '';
      
      if (formattedDate.includes('/')) {
        const parts = formattedDate.split('/');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      
      setNewDate(formattedDate);
    } catch (error) {
      console.warn('Error al formatear fecha para edición:', error, currentDate);
      setNewDate(currentDate || '');
    }
  }, []);

  const saveDate = useCallback((newDateValue: string): void => {
    if (!editingWO) return;
    
    try {
      console.log(`✅ Guardando nueva fecha para ${editingWO}: ${newDateValue}`);
      
      // Notificar al componente padre sobre el cambio
      if (onUpdateWorkOrder) {
        onUpdateWorkOrder(editingWO, 'fchObjetivo', newDateValue);
      }
      
      setEditingWO(null);
      setNewDate('');
    } catch (error) {
      console.error('Error al guardar fecha:', error);
      setEditingWO(null);
      setNewDate('');
    }
  }, [editingWO, onUpdateWorkOrder]);

  const cancelEditing = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation();
    setEditingWO(null);
    setNewDate('');
  }, []);

  const setNewDateCallback = useCallback((date: string): void => {
    setNewDate(date);
  }, []);

  // Memorizar datos para pasar a cada fila
  const itemData = useMemo<RowData>(() => ({
    filteredWOIds,
    workOrdersMap,
    hoveredRowId,
    selectedRows,
    isDragging,
    draggedOverWO,
    editingWO,
    newDate,
    onRowSelection,
    onRowHover,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    onDragEnd,
    startEditing,
    saveDate,
    cancelEditing,
    setNewDate: setNewDateCallback
  }), [
    filteredWOIds,
    workOrdersMap,
    hoveredRowId,
    selectedRows,
    isDragging,
    draggedOverWO,
    editingWO,
    newDate,
    onRowSelection,
    onRowHover,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    onDragEnd,
    startEditing,
    saveDate,
    cancelEditing,
    setNewDateCallback
  ]);

  // Calcular altura dinámica con validación
  const containerHeight = useMemo(() => {
    try {
      return Math.max(400, (typeof window !== 'undefined' ? window.innerHeight : 600) - 300);
    } catch (error) {
      return 400; // Altura por defecto
    }
  }, []);

  // Headers memorizados
  const headers = useMemo(() => (
    <div className="bg-gray-50 text-xs sticky top-0 z-10 border-b">
      <div className="flex items-center h-8" role="row">
        <div className="px-2 w-20 font-semibold flex-shrink-0" role="columnheader">NumWO</div>
        <div className="px-2 w-20 font-semibold flex-shrink-0" role="columnheader">Equipo</div>
        <div className="px-2 w-20 font-semibold flex-shrink-0" role="columnheader">Secuencia</div>
        <div className="px-2 w-16 font-semibold flex-shrink-0" role="columnheader">Línea</div>
        <div className="px-2 w-20 font-semibold flex-shrink-0" role="columnheader">NumDoc</div>
        <div className="px-2 w-20 font-semibold flex-shrink-0" role="columnheader">TipDoc</div>
        <div className="px-2 w-16 font-semibold flex-shrink-0" role="columnheader">📦 Palets</div>
        <div className="px-2 w-20 font-semibold flex-shrink-0" role="columnheader">Estado WO</div>
        <div className="px-2 w-24 font-semibold flex-shrink-0" role="columnheader">📅 Fch Objetivo</div>
        <div className="px-2 w-24 font-semibold flex-shrink-0" role="columnheader">Fch Acuse</div>
        <div className="px-2 w-24 font-semibold flex-shrink-0" role="columnheader">Fch Albarán</div>
        <div className="px-2 w-20 font-semibold flex-shrink-0 text-right" role="columnheader">💰 Importe</div>
        <div className="px-2 w-20 font-semibold flex-shrink-0 text-right" role="columnheader">⏱️ CSH total</div>
      </div>
    </div>
  ), []);

  // Validación de datos
  if (!filteredWOIds || !Array.isArray(filteredWOIds)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <p>⚠️ Error: Datos de órdenes de trabajo no válidos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" role="table" aria-label="Tabla virtualizada de equipos">
      {/* Header fijo */}
      {headers}

      {/* Lista virtualizada */}
      <div className="flex-1 overflow-hidden">
        {filteredWOIds.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4 text-gray-500">
            <div className="text-center">
              <svg 
                className="w-12 h-12 text-gray-300 mx-auto mb-4" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
              <p className="font-medium">No hay órdenes de trabajo disponibles</p>
              <p className="text-sm mt-1">No se encontraron datos que coincidan con los filtros aplicados.</p>
            </div>
          </div>
        ) : (
          <List
            height={containerHeight}
            width="100%" // Propiedad requerida añadida
            itemCount={filteredWOIds.length}
            itemSize={40} // Altura de cada fila en píxeles
            itemData={itemData} // Corregido el typo
            overscanCount={5} // Pre-renderizar 5 elementos extra arriba y abajo
            className="scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
          >
            {WorkOrderRow}
          </List>
        )}
      </div>
      
      {/* Información de estado en la parte inferior */}
      {filteredWOIds.length > 0 && (
        <div className="text-xs text-gray-500 px-2 py-1 border-t bg-gray-50">
          Mostrando {filteredWOIds.length} órdenes de trabajo • Tabla virtualizada para mejor rendimiento
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Comparación personalizada para el componente principal
  return (
    prevProps.filteredWOIds.length === nextProps.filteredWOIds.length &&
    prevProps.filteredWOIds.every((id, i) => id === nextProps.filteredWOIds[i]) &&
    prevProps.hoveredRowId === nextProps.hoveredRowId &&
    prevProps.selectedRows === nextProps.selectedRows &&
    prevProps.isDragging === nextProps.isDragging &&
    prevProps.draggedOverWO === nextProps.draggedOverWO &&
    prevProps.workOrders.length === nextProps.workOrders.length
  );
});

VirtualizedEquipmentTable.displayName = 'VirtualizedEquipmentTable';

export default VirtualizedEquipmentTable;