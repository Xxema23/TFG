// components/ComponentsTable.tsx - VERSIÓN OPTIMIZADA
import React, { useMemo } from 'react';

interface ComponentsTableProps {
  workOrders: any[];
  availableComponents: string[];
  componentAvailability: Record<string, Record<string, {
    disponible: number;
    fecha_entrega: string | null;
    formatted_value: string;
    req_quantity: number;
    stock_global: number;
  }>>;
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
  isLoading?: boolean;
}

export const ComponentsTable: React.FC<ComponentsTableProps> = ({
  workOrders,
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
  onDragEnd,
  isLoading = false
}) => {
  
  console.log('🎨 [ComponentsTable] Render:', {
    workOrders: workOrders.length,
    availableComponents: availableComponents.length,
    selectedRows: selectedRows.size
  });
  
  /**
   * ✅ FILTRO INTELIGENTE DE COLUMNAS
   * Sin selección → mostrar top 10 de cada WO (del backend)
   * Con selección → SOLO componentes de WOs seleccionadas, ordenados por criticidad
   */
  const filteredComponents = useMemo(() => {
    // Sin selección → todas las columnas (ya son top 10 por WO del backend)
    if (selectedRows.size === 0) {
      console.log('📊 [filteredComponents] Sin selección → mostrar todas:', availableComponents.length);
      return availableComponents;
    }

    // ✅ Con selección → SOLO componentes de WOs seleccionadas
    const componentesSet = new Set<string>();
    
    selectedRows.forEach(woId => {
      const wo = workOrders.find(w => w.id === woId);
      if (wo && componentAvailability[wo.numWO]) {
        Object.keys(componentAvailability[wo.numWO]).forEach(itemCode => {
          if (itemCode !== 'NO_COMPONENTS') {
            componentesSet.add(itemCode);
          }
        });
      }
    });

    // ✅ Ordenar por CRITICIDAD (menor disponible primero)
    const componentsArray = Array.from(componentesSet);
    
    const sorted = componentsArray.sort((a, b) => {
      let minA = Infinity;
      let minB = Infinity;
      
      // Encontrar disponibilidad MÍNIMA entre todas las WOs seleccionadas
      selectedRows.forEach(woId => {
        const wo = workOrders.find(w => w.id === woId);
        if (wo) {
          const compA = componentAvailability[wo.numWO]?.[a];
          const compB = componentAvailability[wo.numWO]?.[b];
          
          if (compA) minA = Math.min(minA, compA.disponible);
          if (compB) minB = Math.min(minB, compB.disponible);
        }
      });
      
      // Más críticos primero (incluyendo negativos)
      return minA - minB;
    });
    
    console.log('🔍 [filteredComponents] Seleccionadas:', {
      wos: selectedRows.size,
      componentes: sorted.length,
      top5Críticos: sorted.slice(0, 5)
    });

    return sorted;
  }, [selectedRows, workOrders, availableComponents, componentAvailability]);

  // ✅ Renderizar valor con color
  const renderValue = (disponible: number, reqQuantity: number): React.ReactNode => {
    if (disponible > 0) {
      return (
        <div className="flex flex-col items-center">
          <span className="text-green-700 font-semibold text-xs">
            {disponible}
          </span>
          <span className="text-gray-500 text-[10px]">
            (usa {reqQuantity})
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center">
        <span className="text-red-700 font-bold text-xs">
          {disponible}
        </span>
        <span className="text-gray-500 text-[10px]">
          (usa {reqQuantity})
        </span>
      </div>
    );
  };

  // ✅ Renderizar celda
  const renderCell = (wo: string, itemCode: string) => {
    const comp = componentAvailability[wo]?.[itemCode];
    
    if (!comp) {
      return (
        <td key={itemCode} className="px-2 py-1 text-center border-b bg-gray-50">
          <span className="text-gray-400 text-xs">-</span>
        </td>
      );
    }

    const disponible = comp.disponible;
    const reqQuantity = comp.req_quantity;
    const stockGlobal = comp.stock_global;
    
    const bgColor = disponible > 0 
      ? 'bg-green-50 hover:bg-green-100' 
      : 'bg-red-50 hover:bg-red-100';
    
    const borderColor = disponible > 0 
      ? 'border-l-2 border-green-300' 
      : 'border-l-2 border-red-300';
    
    const tooltip = disponible > 0
      ? `✅ ${itemCode}\nDisponible: ${disponible} uds\nNecesita: ${reqQuantity} uds\nStock global: ${stockGlobal} uds`
      : `❌ ${itemCode}\nDisponible: ${disponible} uds (AGOTADO)\nNecesita: ${reqQuantity} uds\nStock global: ${stockGlobal} uds`;

    return (
      <td 
        key={itemCode}
        className={`px-2 py-1 text-center border-b transition-colors ${bgColor} ${borderColor}`}
        title={tooltip}
      >
        {renderValue(disponible, reqQuantity)}
      </td>
    );
  };

  // Estados de carga/error
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-gray-500 text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="font-medium">Cargando componentes...</p>
        </div>
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-gray-500 text-center">
          <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p className="font-medium">No hay órdenes de trabajo</p>
        </div>
      </div>
    );
  }

  if (filteredComponents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-gray-500 text-center">
          <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="font-medium">No hay componentes</p>
          <p className="text-sm text-gray-400 mt-1">
            {selectedRows.size > 0 
              ? 'Las WOs seleccionadas no tienen artículos'
              : 'Las WOs no tienen artículos'
            }
          </p>
        </div>
      </div>
    );
  }

  // ✅ TABLA PRINCIPAL - SIN BANNER AZUL ❌
  return (
    <table 
      id="right-table"
      className="border-collapse"
      style={{ 
        borderSpacing: 0,
        minWidth: `${Math.max(800, (filteredComponents.length + 1) * 150)}px`
      }}
    >
      <thead>
        <tr className="bg-gray-100 text-xs sticky top-0 z-10 border-b-2 border-gray-300">
          <th className="px-2 py-2 text-left border-b sticky top-0 z-10 bg-gray-100 w-28 font-bold text-gray-700">
            NumWO
          </th>
          {filteredComponents.map((component) => (
            <th 
              key={component} 
              className="px-2 py-2 text-center border-b sticky top-0 z-10 bg-gray-100 w-24 font-bold text-gray-700"
              title={`Artículo: ${component}`}
            >
              <div className="truncate">
                {component}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {workOrders.map((wo, index) => {
          const woId = wo.id;
          const numWO = wo.numWO;
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
                ${isSelected ? 'bg-blue-100 border-blue-300 shadow-sm' : ''}
                ${isBeingDragged ? 'opacity-60' : ''}
                ${isDropTarget ? 'border-t-4 border-blue-500' : ''}
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
            >
              <td className="px-2 py-1 text-left font-semibold text-xs whitespace-nowrap border-b bg-white">
                <span className={isSelected ? 'text-blue-800' : 'text-gray-900'}>
                  {numWO}
                </span>
              </td>
              {filteredComponents.map((component) => 
                renderCell(numWO, component)
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default ComponentsTable;