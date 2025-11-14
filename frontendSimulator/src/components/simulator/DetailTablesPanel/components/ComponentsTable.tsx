// components/ComponentsTable.tsx - VERSIÓN CORREGIDA
import React from 'react';
import { ComponentAvailability } from '../Types';

interface ComponentsTableProps {
  filteredWOIds: string[];
  availableComponents: string[];
  componentAvailability: ComponentAvailability;
  hoveredRowId: string | null;
  selectedRows: Set<string>;
  isDragging: boolean;
  draggedOverWO: string | null;
  rightRowsRef: React.MutableRefObject<{[key: string]: HTMLTableRowElement | null}>;
  onRowSelection: (woId: string, index: number, e: React.MouseEvent<HTMLTableRowElement>) => void;
  onRowHover: (woId: string | null) => void;
  onDragStart: (e: React.DragEvent<HTMLTableRowElement>, woId: string) => void;
  onDragOver: (e: React.DragEvent<HTMLTableRowElement>, woId: string) => void;
  onDragEnter: (e: React.DragEvent<HTMLTableRowElement>, woId: string) => void;
  onDragLeave: (e: React.DragEvent<HTMLTableRowElement>) => void;
  onDrop: (e: React.DragEvent<HTMLTableRowElement>, woId: string) => void;
  onDragEnd: () => void;
}

export const ComponentsTable: React.FC<ComponentsTableProps> = ({
  filteredWOIds,
  availableComponents,
  componentAvailability,
  hoveredRowId,
  selectedRows,
  isDragging,
  draggedOverWO,
  rightRowsRef,
  onRowSelection,
  onRowHover,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragEnd
}) => {
  // Log para depuración con validaciones de existencia
  console.log({
    filteredWOIds: filteredWOIds?.length || 0,
    availableComponents: availableComponents?.length || 0,
    componentAvailability: Object.keys(componentAvailability || {}).length
  });
  
  // Función para renderizar el valor de disponibilidad de componentes
  const renderValue = (value: string | number | undefined): React.ReactNode => {
    if (value === undefined || value === null || value === '') {
      return <span className="text-gray-400">-</span>;
    }
    
    const valueStr = String(value);
    
    // Valores negativos o con SP en rojo
    if (valueStr.startsWith('-') || valueStr.includes('SP')) {
      return <span className="text-red-600 font-medium">{valueStr}</span>;
    }
    
    // Valores numéricos positivos en verde
    if (!isNaN(Number(valueStr)) && Number(valueStr) > 0) {
      return <span className="text-green-600">{valueStr}</span>;
    }
    
    return <span className="text-gray-900">{valueStr}</span>;
  };

  // Validación de props requeridas
  if (!filteredWOIds || !availableComponents || !componentAvailability) {
    return (
      <div className="overflow-y-auto overflow-x-auto h-[calc(100%-36px)] flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <p>Error: Faltan datos requeridos para mostrar la tabla</p>
          <p className="text-sm mt-2">
            Verifique que se hayan cargado correctamente los datos de componentes
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto overflow-x-auto h-[calc(100%-36px)]">
      <table 
        id="right-table"
        className="min-w-full border-collapse table-fixed"
        style={{ borderSpacing: 0 }}
      >
        <thead>
          <tr className="bg-gray-50 text-xs sticky top-0 z-10">
            <th className="px-3 py-1 text-left border-b sticky top-0 z-10 bg-gray-50 w-20 font-semibold">
              WO ID
            </th>
            {availableComponents.map((component) => (
              <th 
                key={component} 
                className="px-3 py-1 text-center border-b sticky top-0 z-10 bg-gray-50 w-32 font-semibold"
                title={`Componente: ${component}`}
              >
                {component}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredWOIds.length === 0 ? (
            <tr>
              <td 
                colSpan={availableComponents.length + 1} 
                className="px-4 py-8 text-center text-gray-500"
              >
                <div className="flex flex-col items-center space-y-2">
                  <svg 
                    className="w-12 h-12 text-gray-300" 
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
                  <p className="text-sm">
                    No hay órdenes que coincidan con los filtros aplicados.
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            filteredWOIds.map((woId, index) => {
              const isSelected = selectedRows.has(woId);
              const isBeingDragged = isDragging && selectedRows.has(woId);
              const isDropTarget = draggedOverWO === woId && !selectedRows.has(woId);
              
              return (
                <tr 
                  key={woId}
                  ref={(el) => {
                    if (rightRowsRef.current) {
                      rightRowsRef.current[woId] = el;
                    }
                  }}
                  draggable
                  className={`
                    transition-all duration-150 cursor-grab active:cursor-grabbing border-b
                    ${hoveredRowId === woId ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    ${isSelected ? 'bg-blue-100 border-blue-200 shadow-sm' : ''}
                    ${isBeingDragged ? 'opacity-60 transform rotate-1 scale-[0.98]' : ''}
                    ${isDropTarget ? 'border-t-4 border-blue-500 bg-blue-25' : ''}
                  `.replace(/\s+/g, ' ').trim()}
                  onClick={(e) => onRowSelection(woId, index, e)}
                  onMouseEnter={() => onRowHover(woId)}
                  onMouseLeave={() => onRowHover(null)}
                  onDragStart={(e) => onDragStart(e, woId)}
                  onDragOver={(e) => onDragOver(e, woId)}
                  onDragEnter={(e) => onDragEnter(e, woId)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDrop(e, woId)}
                  onDragEnd={onDragEnd}
                  role="row"
                  tabIndex={0}
                  aria-selected={isSelected}
                >
                  <td className="px-3 py-2 text-left font-medium text-xs whitespace-nowrap">
                    <span 
                      className={`
                        ${isSelected ? 'text-blue-800' : 'text-gray-900'}
                        ${isBeingDragged ? 'text-blue-600' : ''}
                      `.trim()}
                    >
                      {woId}
                    </span>
                  </td>
                  {availableComponents.map((component) => (
                    <td 
                      key={`${woId}-${component}`} 
                      className="px-3 py-2 text-center text-xs"
                    >
                      {renderValue(componentAvailability[woId]?.[component]?.value)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ComponentsTable;