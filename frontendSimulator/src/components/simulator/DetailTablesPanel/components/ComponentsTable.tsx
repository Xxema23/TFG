// components/ComponentsTable.tsx - Columnas dinámicas: globales o por WO seleccionada
import React, { useState, useMemo, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';

interface CompData {
  disponible: number;
  fecha_entrega: string | null;
  formatted_value: string;
  req_quantity: number;
  stock_global: number;
}

interface ComponentsTableProps {
  workOrders: any[];
  availableComponents: string[];
  componentAvailability: Record<string, Record<string, CompData>>;
  hoveredRowId: string | null;
  selectedRows: Set<string>;
  isDragging: boolean;
  draggedOverWO: string | null;
  rightRowsRef: React.MutableRefObject<{ [key: string]: HTMLTableRowElement | null }>;
  onRowSelection: (woId: string, index: number, e: React.MouseEvent<HTMLTableRowElement>) => void;
  onRowHover: (woId: string | null) => void;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  isLoading?: boolean;
}

// ─── Utilidades ───────────────────────────────

const getStatus = (comp: CompData): 'ok' | 'risk' | 'critical' => {
  if (comp.disponible < 0) return 'critical';
  if (comp.disponible < comp.req_quantity) return 'risk';
  return 'ok';
};

const CELL_BG   = { ok: 'bg-green-50',   risk: 'bg-yellow-50',  critical: 'bg-red-50'   };
const CELL_BORDER = { ok: 'border-l-2 border-green-300', risk: 'border-l-2 border-yellow-400', critical: 'border-l-2 border-red-400' };
const CELL_TEXT = { ok: 'text-green-700 font-semibold', risk: 'text-yellow-700 font-semibold', critical: 'text-red-700 font-bold' };
const ICON = { ok: '🟢', risk: '🟡', critical: '🔴' };

// Portal singleton
let portalEl: HTMLDivElement | null = null;
const getPortal = () => {
  if (!portalEl) { portalEl = document.createElement('div'); document.body.appendChild(portalEl); }
  return portalEl;
};

// ─── Celda memoizada ──────────────────────────

const CompCell = memo<{ comp: CompData | undefined; code: string }>(({ comp, code }) => {
  if (!comp) return (
    <td className="px-2 py-1 text-center border-b bg-gray-50 w-24 min-w-[80px]">
      <span className="text-gray-300 text-xs">—</span>
    </td>
  );
  const s = getStatus(comp);
  return (
    <td
      className={`px-2 py-1 text-center border-b w-24 min-w-[80px] ${CELL_BG[s]} ${CELL_BORDER[s]}`}
      title={`${code}\nDisp: ${comp.disponible} | Necesita: ${comp.req_quantity} | Stock: ${comp.stock_global}`}
    >
      <div className="flex flex-col items-center leading-tight">
        <span className={`text-xs ${CELL_TEXT[s]}`}>{comp.disponible}</span>
        <span className="text-[10px] text-gray-400">/{comp.req_quantity}</span>
      </div>
    </td>
  );
}, (p, n) => p.comp === n.comp);
CompCell.displayName = 'CompCell';

// ─── Tooltip hover ────────────────────────────

type TipState = { visible: boolean; wo: any; x: number; y: number };

const HoverTooltip = memo<{ wo: any; componentAvailability: Record<string, Record<string, CompData>>; allComponents: string[]; x: number; y: number }>(
  ({ wo, componentAvailability, allComponents, x, y }) => {
    const comps = useMemo(() => {
      const wc = componentAvailability[wo.numWO] || {};
      return allComponents
        .filter(c => wc[c] && c !== 'NO_COMPONENTS')
        .map(c => ({ code: c, data: wc[c], s: getStatus(wc[c]) }))
        .sort((a, b) => a.data.disponible - b.data.disponible);
    }, [wo.numWO, componentAvailability, allComponents]);

    if (!comps.length) return null;
    const left = Math.min(x + 14, window.innerWidth - 310);
    const top  = Math.min(y + 14, window.innerHeight - 380);

    return (
      <div style={{ position: 'fixed', left, top, zIndex: 9999, width: 280, maxHeight: 340, overflowY: 'auto', pointerEvents: 'none' }}
        className="bg-white border border-gray-200 rounded-lg shadow-2xl text-xs">
        <div className="px-3 py-2 bg-gray-50 border-b font-bold text-gray-700 sticky top-0">
          {wo.numWO} · {comps.length} componentes
        </div>
        {comps.map(({ code, data, s }) => (
          <div key={code} className={`px-3 py-1.5 flex justify-between border-b last:border-0 ${CELL_BG[s]}`}>
            <span className="truncate flex-1 text-gray-700">{ICON[s]} {code}</span>
            <span className={`ml-2 shrink-0 ${CELL_TEXT[s]}`}>{data.disponible}</span>
            <span className="ml-1 text-gray-400">/{data.req_quantity}</span>
          </div>
        ))}
      </div>
    );
  }
);
HoverTooltip.displayName = 'HoverTooltip';

// ─── Fila ─────────────────────────────────────

interface RowProps {
  wo: any;
  index: number;
  columns: string[];
  componentAvailability: Record<string, Record<string, CompData>>;
  allComponents: string[];
  externalHovered: boolean;
  isSelected: boolean;
  isFocused: boolean;          // WO cuyas columnas se están mostrando
  onRowSelection: (woId: string, index: number, e: React.MouseEvent<HTMLTableRowElement>) => void;
  onRowHover: (woId: string | null) => void;
  rowRef: (el: HTMLTableRowElement | null) => void;
  onTooltip: (s: TipState) => void;
  onFocusToggle: (woId: string) => void;
}

const ComponentRow = memo<RowProps>(({
  wo, index, columns, componentAvailability, allComponents,
  externalHovered, isSelected, isFocused,
  onRowSelection, onRowHover, rowRef, onTooltip, onFocusToggle
}) => {
  const rafRef = useRef<number | null>(null);
  const wc = componentAvailability[wo.numWO] || {};

  const handleEnter = useCallback((e: React.MouseEvent) => {
    onRowHover(wo.id);
    onTooltip({ visible: true, wo, x: e.clientX, y: e.clientY });
  }, [wo, onRowHover, onTooltip]);

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const x = e.clientX, y = e.clientY;
    rafRef.current = requestAnimationFrame(() => { onTooltip({ visible: true, wo, x, y }); rafRef.current = null; });
  }, [wo, onTooltip]);

  const handleLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    onRowHover(null);
    onTooltip({ visible: false, wo: null, x: 0, y: 0 });
  }, [onRowHover, onTooltip]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLTableRowElement>) => {
    onRowSelection(wo.id, index, e);
    onFocusToggle(wo.id);
  }, [wo.id, index, onRowSelection, onFocusToggle]);

  const rowBg = isSelected
    ? 'bg-blue-100'
    : externalHovered
      ? 'bg-blue-50'
      : '';

  return (
    <tr
      ref={rowRef}
      className={`border-b transition-colors duration-75 cursor-pointer ${rowBg} ${isFocused ? 'outline outline-2 outline-blue-400' : ''}`}
      onClick={handleClick}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {/* NumWO sticky */}
      <td className="px-2 py-1.5 text-xs font-semibold whitespace-nowrap border-b bg-white sticky left-0 z-10 w-24">
        <div className="flex items-center gap-1">
          {isFocused && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
          <span className={isSelected ? 'text-blue-800' : 'text-gray-900'}>{wo.numWO}</span>
        </div>
      </td>
      {/* Celdas de componentes */}
      {columns.map(code => (
        <CompCell key={code} code={code} comp={wc[code]} />
      ))}
    </tr>
  );
}, (p, n) =>
  p.wo.id === n.wo.id &&
  p.externalHovered === n.externalHovered &&
  p.isSelected === n.isSelected &&
  p.isFocused === n.isFocused &&
  p.columns === n.columns &&
  p.componentAvailability === n.componentAvailability
);
ComponentRow.displayName = 'ComponentRow';

// ─── Tabla principal ──────────────────────────

const ComponentsTableComponent: React.FC<ComponentsTableProps> = ({
  workOrders, availableComponents, componentAvailability,
  hoveredRowId, selectedRows, rightRowsRef,
  onRowSelection, onRowHover, isLoading = false,
}) => {
  const [tooltip, setTooltip] = useState<TipState>({ visible: false, wo: null, x: 0, y: 0 });
  const [focusedWOId, setFocusedWOId] = useState<string | null>(null);

  const handleTooltip  = useCallback((s: TipState) => setTooltip(s), []);
  const handleFocusToggle = useCallback((woId: string) => {
    setFocusedWOId(prev => prev === woId ? null : woId);
  }, []);

  // Columnas: top 10 de la WO focusada, o top 10 globales
  const columns = useMemo(() => {
    const clean = availableComponents.filter(c => c !== 'NO_COMPONENTS');
    if (clean.length === 0) return [];

    if (focusedWOId) {
      // WO focusada → sus 10 componentes más críticos
      const focusedWO = workOrders.find(w => w.id === focusedWOId);
      if (focusedWO) {
        const wc = componentAvailability[focusedWO.numWO] || {};
        return clean
          .filter(c => wc[c])
          .map(c => ({ code: c, disp: wc[c].disponible }))
          .sort((a, b) => a.disp - b.disp)
          .slice(0, 10)
          .map(x => x.code);
      }
    }

    // Sin foco → top 10 globales (menor disponible entre todas las WOs)
    return clean
      .map(code => {
        let min = Infinity;
        for (const wo of workOrders) {
          const d = componentAvailability[wo.numWO]?.[code]?.disponible;
          if (d !== undefined && d < min) min = d;
        }
        return { code, min };
      })
      .sort((a, b) => a.min - b.min)
      .slice(0, 10)
      .map(x => x.code);
  }, [focusedWOId, availableComponents, componentAvailability, workOrders.length]);

  const focusedWO = focusedWOId ? workOrders.find(w => w.id === focusedWOId) : null;

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center text-gray-500">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p>Cargando componentes...</p>
      </div>
    </div>
  );

  if (workOrders.length === 0) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-gray-400 text-sm">No hay órdenes de trabajo</p>
    </div>
  );

  return (
    <>
      <table id="right-table" className="border-collapse" style={{ borderSpacing: 0, minWidth: Math.max(400, columns.length * 96 + 120) }}>
        <thead>
          <tr className="bg-gray-100 text-xs sticky top-0 z-10 border-b-2 border-gray-300">
            {/* Header NumWO con indicador de modo */}
            <th className="px-2 py-2 text-left font-bold text-gray-700 bg-gray-100 sticky left-0 z-20 w-24">
              <div className="flex flex-col leading-tight">
                <span>NumWO</span>
                {focusedWO ? (
                  <span className="text-[9px] text-blue-600 font-normal">
                    📌 {focusedWO.numWO}
                    <button
                      onClick={() => setFocusedWOId(null)}
                      className="ml-1 text-gray-400 hover:text-red-500"
                      title="Volver a vista global"
                    >✕</button>
                  </span>
                ) : (
                  <span className="text-[9px] text-gray-400 font-normal">top 10 global</span>
                )}
              </div>
            </th>
            {columns.map(code => (
              <th key={code}
                className="px-2 py-2 text-center font-bold text-gray-700 bg-gray-100 w-24 min-w-[80px]"
                title={code}
              >
                <div className="truncate text-xs">{code}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workOrders.map((wo, i) => (
            <ComponentRow
              key={wo.id}
              wo={wo}
              index={i}
              columns={columns}
              componentAvailability={componentAvailability}
              allComponents={availableComponents}
              externalHovered={hoveredRowId === wo.id}
              isSelected={selectedRows.has(wo.id)}
              isFocused={focusedWOId === wo.id}
              onRowSelection={onRowSelection}
              onRowHover={onRowHover}
              rowRef={(el) => { if (rightRowsRef.current) rightRowsRef.current[wo.id] = el; }}
              onTooltip={handleTooltip}
              onFocusToggle={handleFocusToggle}
            />
          ))}
        </tbody>
      </table>

      {tooltip.visible && tooltip.wo && createPortal(
        <HoverTooltip
          wo={tooltip.wo}
          componentAvailability={componentAvailability}
          allComponents={availableComponents}
          x={tooltip.x}
          y={tooltip.y}
        />,
        getPortal()
      )}
    </>
  );
};

const arePropsEqual = (p: ComponentsTableProps, n: ComponentsTableProps) =>
  p.workOrders.length === n.workOrders.length &&
  p.availableComponents.length === n.availableComponents.length &&
  p.componentAvailability === n.componentAvailability &&
  p.selectedRows.size === n.selectedRows.size &&
  p.hoveredRowId === n.hoveredRowId &&
  p.isLoading === n.isLoading;

export const ComponentsTable = React.memo(ComponentsTableComponent, arePropsEqual);
export default ComponentsTable;