// components/EquipmentTable.tsx - CON LOG DE DEBUG
import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { DateEditor } from './DateEditor';
import { getRowClasses, formatCurrency } from '../utils/TableHelpers';
import { WorkOrder } from '../types';
import { IFabricacionConHoras } from '../../../../interfaces/IFabricacionConHoras';
import { updateFabricacionConHoras } from '../../../../services/FabricacionConHoras';
import { useFabricacionesContext } from '../../../../contexts/FabricacionesContext';

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
    return dateString;
  }
};

const formatHours = (hours: number | string | undefined | null): string => {
  if (hours === undefined || hours === null || hours === '') return '0.00';
  const numericHours = typeof hours === 'string' ? parseFloat(hours) : hours;
  if (typeof numericHours !== 'number' || isNaN(numericHours)) return '0.00';
  return numericHours.toFixed(2);
};

const formatNumericField = (value: any): string => {
  if (value === undefined || value === null || value === '') return '';
  return String(value);
};

interface EquipmentTableProps {
  filteredWOIds: string[];
  workOrders: any[];
  refetchFabricaciones: () => Promise<void>;
  hoveredRowId: string | null;
  selectedRows: Set<string>;
  onRowSelection: (woId: string, index: number, e: React.MouseEvent<HTMLTableRowElement>) => void;
  onRowHover: (woId: string | null) => void;
  onWorkOrderUpdated?: (woId: string, field: string, value: any) => void;
  onReorderInTable?: (draggedNumWOs: string[], targetNumWO: string) => void;
}

const EquipmentRow = memo<{
  wo: WorkOrder;
  woId: string;
  index: number;
  isSelected: boolean;
  selectedRows: Set<string>;
  hoveredRowId: string | null;
  isUpdating: boolean;
  editingWO: string | null;
  newDate: string;
  onRowSelection: (woId: string, index: number, e: React.MouseEvent) => void;
  onRowHover: (woId: string | null) => void;
  onStartEditing: (woId: string, currentDate: string, e: React.MouseEvent) => void;
  onSaveDate: (date: string) => Promise<void>;
  onCancelEditing: (e: React.MouseEvent) => void;
  onDateChange: (date: string) => void;
  getPaletInfo: (wo: WorkOrder) => string;
  onDrop: (draggedNumWOs: string[], targetNumWO: string) => void;
  workOrdersMap: Record<string, WorkOrder>;
}>(({
  wo,
  woId,
  index,
  isSelected,
  selectedRows,
  hoveredRowId,
  isUpdating,
  editingWO,
  newDate,
  onRowSelection,
  onRowHover,
  onStartEditing,
  onSaveDate,
  onCancelEditing,
  onDateChange,
  getPaletInfo,
  onDrop,
  workOrdersMap
}) => {
  const ref = useRef<HTMLTableRowElement>(null);

  // ⬇️⬇️⬇️ LOG DE DEBUG AÑADIDO ⬇️⬇️⬇️
  console.log(`📋 [EquipmentRow] ${wo.numWO}: día=${wo.fchObjetivo?.split('T')[0]}, seq=${wo.secuencia}, linea=${wo.linea}`);

  const [{ isDragging }, drag] = useDrag({
    type: 'WORK_ORDER',
    item: () => {
      const draggedWOs = isSelected 
        ? Array.from(selectedRows)
            .map(id => workOrdersMap[id]?.numWO)
            .filter(Boolean)
        : [wo.numWO];
      
      return { workOrders: draggedWOs };
    },
    canDrag: !isUpdating,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver, canDrop }, drop] = useDrop({
    accept: 'WORK_ORDER',
    canDrop: (item: { workOrders: string[] }) => {
      return !selectedRows.has(woId);
    },
    drop: (item: { workOrders: string[] }) => {
      onDrop(item.workOrders, wo.numWO);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  drag(drop(ref));

  const rowClasses = `
    ${isSelected ? 'bg-blue-100 border-blue-300' : ''}
    ${hoveredRowId === woId ? 'bg-gray-50' : ''}
    ${isDragging ? 'opacity-50' : ''}
    ${isOver && canDrop ? 'border-t-4 border-blue-500' : ''}
    ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
    transition-all duration-150 border-b
  `;

  return (
    <tr
      ref={ref}
      className={rowClasses}
      onClick={(e) => !isUpdating && onRowSelection(woId, index, e)}
      onMouseEnter={() => onRowHover(woId)}
      onMouseLeave={() => onRowHover(null)}
      data-wo-id={woId}
      data-num-wo={wo.numWO}
      style={{ pointerEvents: isUpdating ? 'none' : 'auto' }}
    >
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap font-medium">
        {formatNumericField(wo.numWO)}
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap">
        {formatNumericField(wo.equipo)}
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap text-center relative">
        {formatNumericField(wo.secuencia)}
        {isUpdating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap text-center">
        {formatNumericField(wo.linea)}
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap">
        {formatNumericField(wo.numDoc)}
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap">
        {formatNumericField(wo.tipDoc)}
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap text-center">
        <span className={getPaletInfo(wo) === '-' ? 'text-gray-400' : 'text-blue-600 font-medium'}>
          {getPaletInfo(wo)}
        </span>
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap">
        <span className={`px-2 py-1 rounded-full text-xs ${
          wo.estadoWO === 'Completado' ? 'bg-green-100 text-green-800' :
          wo.estadoWO === 'En Proceso' ? 'bg-yellow-100 text-yellow-800' :
          wo.estadoWO === 'Pendiente' ? 'bg-gray-100 text-gray-800' :
          'bg-blue-100 text-blue-800'
        }`}>
          {formatNumericField(wo.estadoWO)}
        </span>
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap relative">
        <DateEditor
          currentDate={wo.fchObjetivo || ''}
          isEditing={editingWO === wo.id}
          onStartEdit={(e) => onStartEditing(wo.id, wo.fchObjetivo || '', e)}
          onSave={onSaveDate}
          onCancel={onCancelEditing}
          onDateChange={onDateChange}
          value={newDate}
        />
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap">
        {formatDateDisplay(wo.fchAcuse)}
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap">
        {formatDateDisplay(wo.fchAlbarAn)}
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap text-right">
        <span className="font-medium text-green-600">
          {formatCurrency(wo.importe)}
        </span>
      </td>
      <td className="px-2 py-1 border-b text-xs whitespace-nowrap text-right">
        <span className="font-medium text-blue-600">
          {formatHours(wo.cshTotal)} h
        </span>
      </td>
    </tr>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.woId === nextProps.woId &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.hoveredRowId === nextProps.hoveredRowId &&
    prevProps.isUpdating === nextProps.isUpdating &&
    prevProps.editingWO === nextProps.editingWO &&
    prevProps.newDate === nextProps.newDate &&
    prevProps.wo.fchObjetivo === nextProps.wo.fchObjetivo &&
    prevProps.wo.secuencia === nextProps.wo.secuencia &&
    prevProps.selectedRows.size === nextProps.selectedRows.size
  );
});

EquipmentRow.displayName = 'EquipmentRow';

const arePropsEqual = (
  prevProps: EquipmentTableProps,
  nextProps: EquipmentTableProps
): boolean => {
  if (prevProps.filteredWOIds.length !== nextProps.filteredWOIds.length) {
    return false;
  }
  if (prevProps.filteredWOIds.join(',') !== nextProps.filteredWOIds.join(',')) {
    return false;
  }
  if (prevProps.workOrders.length !== nextProps.workOrders.length) {
    return false;
  }
  if (prevProps.hoveredRowId !== nextProps.hoveredRowId) {
    return false;
  }
  if (prevProps.selectedRows.size !== nextProps.selectedRows.size) {
    return false;
  }
  return true;
};

const EquipmentTableComponent: React.FC<EquipmentTableProps> = ({
  filteredWOIds,
  workOrders,
  refetchFabricaciones,
  hoveredRowId,
  selectedRows,
  onRowSelection,
  onRowHover,
  onWorkOrderUpdated,
  onReorderInTable
}) => {
  const [isUpdating, setIsUpdating] = useState<Set<string>>(new Set());
  const [editingWO, setEditingWO] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const { updateSingleFabricacion } = useFabricacionesContext();

  const workOrdersMap = useMemo(() => {
    const map: Record<string, WorkOrder> = {};
    workOrders.forEach(wo => {
      if (wo && wo.id) {
        map[wo.id] = wo;
      }
    });
    return map;
  }, [workOrders]);

  const updateWorkOrderField = useCallback(async (
    woId: string,
    field: string,
    value: any
  ): Promise<boolean> => {
    try {
      setIsUpdating(prev => new Set([...prev, woId]));

      const wo = workOrdersMap[woId];
      if (!wo) {
        alert(`No se encontró la orden de trabajo para id: ${woId}`);
        return false;
      }
      const numWO = wo.numWO;

      const updateData: Partial<IFabricacionConHoras> = {
        Fch_Objetivo: field === 'Fch_Objetivo' ? value : undefined,
        Secuencia: field === 'Secuencia' ? value : undefined
      };

      updateSingleFabricacion(numWO, updateData);

      if (onWorkOrderUpdated) {
        onWorkOrderUpdated(woId, field, value);
      }

      try {
        await updateFabricacionConHoras(numWO, updateData);
      } catch (dbError) {
        const rollbackData: Partial<IFabricacionConHoras> = {
          Fch_Objetivo: field === 'Fch_Objetivo' ? wo.fchObjetivo : undefined,
          Secuencia: field === 'Secuencia' ? wo.secuencia : undefined
        };
        updateSingleFabricacion(numWO, rollbackData);
        throw dbError;
      }

      return true;

    } catch (error) {
      alert(`Error al actualizar ${field}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      return false;
    } finally {
      setIsUpdating(prev => {
        const newSet = new Set(prev);
        newSet.delete(woId);
        return newSet;
      });
    }
  }, [onWorkOrderUpdated, workOrdersMap, updateSingleFabricacion]);

  const startEditing = useCallback((woId: string, currentDate: string, e: React.MouseEvent): void => {
    e.stopPropagation();
    setEditingWO(woId);

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
      setNewDate(currentDate || '');
    }
  }, []);

  const saveDate = useCallback(async (newDateValue: string): Promise<void> => {
    if (!editingWO) return;

    try {
      const success = await updateWorkOrderField(editingWO, 'Fch_Objetivo', newDateValue);

      if (success) {
        setEditingWO(null);
        setNewDate('');
      }
    } catch (error) {
      console.error('Error al guardar fecha:', error);
    }
  }, [editingWO, updateWorkOrderField]);

  const cancelEditing = useCallback((e: React.MouseEvent): void => {
    e.stopPropagation();
    setEditingWO(null);
    setNewDate('');
  }, []);

  const getPaletInfo = useCallback((wo: WorkOrder): string => {
    if (!wo) return '-';

    try {
      if (wo.paletInfo && wo.paletInfo.num_de_palet) {
        return String(wo.paletInfo.num_de_palet);
      }

      if ((wo as any).numPalet) {
        return String((wo as any).numPalet);
      }

      if ((wo as any).palet) {
        return String((wo as any).palet);
      }

      if ((wo as any).num_palet) {
        return String((wo as any).num_palet);
      }

      return '-';
    } catch (error) {
      return '-';
    }
  }, []);

  const handleDrop = useCallback((draggedNumWOs: string[], targetNumWO: string) => {
    if (onReorderInTable) {
      onReorderInTable(draggedNumWOs, targetNumWO);
    }
  }, [onReorderInTable]);

  if (!filteredWOIds || !Array.isArray(filteredWOIds)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 text-center">
          <p>⚠️ Error: No se recibieron IDs de órdenes de trabajo válidos</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <table
        id="left-table"
        className="min-w-full border-collapse table-fixed"
        style={{ borderSpacing: 0 }}
        role="table"
        aria-label="Tabla de equipos y órdenes de trabajo"
      >
        <thead>
          <tr className="bg-gray-50 text-xs sticky top-0 z-10">
            <th className="px-2 py-1 text-left border-b sticky top-0 z-10 bg-gray-50 w-20 font-semibold">NumWO</th>
            <th className="px-2 py-1 text-left border-b sticky top-0 z-10 bg-gray-50 w-20 font-semibold">Equipo</th>
            <th className="px-2 py-1 text-center border-b sticky top-0 z-10 bg-gray-50 w-20 font-semibold">Secuencia</th>
            <th className="px-2 py-1 text-center border-b sticky top-0 z-10 bg-gray-50 w-16 font-semibold">Línea</th>
            <th className="px-2 py-1 text-left border-b sticky top-0 z-10 bg-gray-50 w-20 font-semibold">NumDoc</th>
            <th className="px-2 py-1 text-left border-b sticky top-0 z-10 bg-gray-50 w-20 font-semibold">TipDoc</th>
            <th className="px-2 py-1 text-center border-b sticky top-0 z-10 bg-gray-50 w-16 font-semibold">📦 Palets</th>
            <th className="px-2 py-1 text-left border-b sticky top-0 z-10 bg-gray-50 w-24 font-semibold">Estado WO</th>
            <th className="px-2 py-1 text-left border-b sticky top-0 z-10 bg-gray-50 w-28 font-semibold">📅 Fch Objetivo</th>
            <th className="px-2 py-1 text-left border-b sticky top-0 z-10 bg-gray-50 w-24 font-semibold">Fch Acuse</th>
            <th className="px-2 py-1 text-left border-b sticky top-0 z-10 bg-gray-50 w-24 font-semibold">Fch Albarán</th>
            <th className="px-2 py-1 text-right border-b sticky top-0 z-10 bg-gray-50 w-20 font-semibold">💰 Importe</th>
            <th className="px-2 py-1 text-right border-b sticky top-0 z-10 bg-gray-50 w-20 font-semibold">⏱️ CSH total</th>
          </tr>
        </thead>
        <tbody>
          {filteredWOIds.length === 0 ? (
            <tr>
              <td colSpan={13} className="px-4 py-8 text-center text-gray-500">
                <div className="flex flex-col items-center space-y-2">
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="font-medium">No hay órdenes de trabajo disponibles</p>
                  <p className="text-sm">No se encontraron datos que coincidan con los filtros aplicados.</p>
                </div>
              </td>
            </tr>
          ) : (
            filteredWOIds.map((woId, index) => {
              const wo = workOrdersMap[woId];
              if (!wo) {
                return null;
              }

              return (
                <EquipmentRow
                  key={woId}
                  wo={wo}
                  woId={woId}
                  index={index}
                  isSelected={selectedRows.has(woId)}
                  selectedRows={selectedRows}
                  hoveredRowId={hoveredRowId}
                  isUpdating={isUpdating.has(woId)}
                  editingWO={editingWO}
                  newDate={newDate}
                  onRowSelection={onRowSelection}
                  onRowHover={onRowHover}
                  onStartEditing={startEditing}
                  onSaveDate={saveDate}
                  onCancelEditing={cancelEditing}
                  onDateChange={setNewDate}
                  getPaletInfo={getPaletInfo}
                  onDrop={handleDrop}
                  workOrdersMap={workOrdersMap}
                />
              );
            })
          )}
        </tbody>
      </table>

      {isUpdating.size > 0 && (
        <div className="fixed bottom-4 left-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 z-50">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">
            Sincronizando {isUpdating.size} cambio{isUpdating.size > 1 ? 's' : ''}...
          </span>
        </div>
      )}
    </>
  );
};

export const EquipmentTable = React.memo(EquipmentTableComponent, arePropsEqual);

export default EquipmentTable;