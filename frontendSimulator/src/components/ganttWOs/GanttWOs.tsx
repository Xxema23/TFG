import React, { memo, useMemo, useEffect } from "react";
import { useGanttHooks } from "./useGanttHooks/UseGanttHooks";
import GanttDayScroller from "./GanttDayScroller";
import { IFabricacionConHoras } from "../../interfaces/IFabricacionConHoras";
import { getISOWeek } from "date-fns";
import { useFabricacionesContext } from "../../contexts/FabricacionesContext";

interface GanttWOsProps {
  filteredWorkOrders?: IFabricacionConHoras[];
  filterActive?: boolean;
  refetchFabricaciones: () => Promise<void>;
  onDataLoad?: (workOrders: IFabricacionConHoras[]) => void;
}

interface DayHeaderProps {
  day: string;
  zoomLevel: number;
}

interface GanttLineProps {
  line: string;
  workOrders: IFabricacionConHoras[];
  workingDays: string[];
  capacity: any;
  zoomLevel: number;
  selectedWOs: string[];
  setSelectedWOs: React.Dispatch<React.SetStateAction<string[]>>;
}

interface GanttData {
  workOrders: IFabricacionConHoras[];
  capacity: any;
}

const DayHeader = memo(({ day, zoomLevel }: DayHeaderProps) => {
  const date = new Date(day);
  const isToday = date.toDateString() === new Date().toDateString();
  const dayWidth = 100 * zoomLevel;
  const dayOfMonth = date.getDate().toString().padStart(2, "0");
  const monthShort = date
    .toLocaleDateString("es-ES", { month: "short" })
    .toUpperCase();
  const weekNumber = getISOWeek(date);

  return (
    <div
      className={`border-r flex items-center justify-center px-2 py-1 text-center transition-colors ${
        isToday
          ? "bg-blue-100 border-blue-300 text-blue-900 font-bold shadow-inner"
          : "bg-gray-50 text-gray-700 border-gray-200"
      }`}
      style={{
        width: `${dayWidth}px`,
        minWidth: `${dayWidth}px`,
      }}
    >
      <div className="flex flex-col items-center leading-tight">
        <span className="text-sm">{`${dayOfMonth} ${monthShort}`}</span>
        <span className="text-xs text-gray-500">{`W${weekNumber}`}</span>
      </div>
    </div>
  );
});

const GanttLine = memo(({
  line,
  workOrders,
  workingDays,
  capacity,
  zoomLevel,
  selectedWOs,
  setSelectedWOs
}: GanttLineProps) => {
  return (
    <div className="flex border-b border-gray-100 hover:bg-gray-50">
      <div className="w-32 p-3 border-r border-gray-200 bg-white font-medium text-gray-700 flex items-center justify-end pr-4">
        {line}
      </div>
      <div className="flex-1 relative" style={{ minHeight: "60px" }}>
        <GanttDayScroller
          days={workingDays}
          line={line}
          workOrders={workOrders}
          capacity={capacity}
          zoomLevel={zoomLevel}
          selectedWOs={selectedWOs}
          setSelectedWOs={setSelectedWOs}
        />
      </div>
    </div>
  );
});

const GanttWOs: React.FC<GanttWOsProps> = ({ 
  filteredWorkOrders = [], 
  filterActive = false, 
  refetchFabricaciones,
  onDataLoad 
}) => {
  const { onGanttOrdersChanged } = useFabricacionesContext();

  // ✅ OPTIMIZACIÓN: Pasar filteredWorkOrders a useGanttHooks
  const {
    data,
    zoomLevel,
    workingDays,
    handleZoomIn,
    handleZoomOut,
    isSaving,
    selectedWOs,
    setSelectedWOs,
    isCapacityReady,  // ⬅️ IMPORTAR
  } = useGanttHooks(filteredWorkOrders);

  useEffect(() => {
    const handleGanttUpdate = (event: CustomEvent) => {
      console.log('📢 [GanttWOs] Recibido evento gantt-workorders-updated:', event.detail.workOrders.length);
      onGanttOrdersChanged(event.detail.workOrders);
    };

    window.addEventListener('gantt-workorders-updated', handleGanttUpdate as EventListener);

    return () => {
      window.removeEventListener('gantt-workorders-updated', handleGanttUpdate as EventListener);
    };
  }, [onGanttOrdersChanged]);

  const workOrdersToUse = useMemo(() => {
    if (filteredWorkOrders && filteredWorkOrders.length > 0) {
      if (onDataLoad) {
        onDataLoad(filteredWorkOrders);
      }
      
      return filteredWorkOrders;
    }
    
    if (data && data.workOrders) {
      return data.workOrders;
    }
    
    return [];
  }, [filteredWorkOrders, data, onDataLoad]);

  const ControlButtons = useMemo(() => (
    <div className="flex items-center space-x-2">
      {filterActive && (
        <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <span>Filtros aplicados</span>
        </div>
      )}
      
      {isSaving && (
        <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          <svg
            className="animate-spin h-4 w-4 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>Guardando automáticamente...</span>
        </div>
      )}
      
      <button
        onClick={handleZoomOut}
        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
        title="Alejar"
        type="button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <button
        onClick={handleZoomIn}
        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
        title="Acercar"
        type="button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  ), [
    filterActive,
    isSaving,
    handleZoomOut,
    handleZoomIn
  ]);

  const processedData = useMemo(() => {
    if (!workOrdersToUse) {
      return null;
    }

    if (!Array.isArray(workOrdersToUse)) {
      return null;
    }

    if (workOrdersToUse.length === 0) {
      return null;
    }

    if (workingDays.length === 0) {
      return null;
    }

    const capacity = data?.capacity || [];
    
    const uniqueLines = Array.from(new Set(workOrdersToUse.map((wo) => wo.Linea)));
    
    const lineWorkOrders: { [key: string]: IFabricacionConHoras[] } = {};
    uniqueLines.forEach(line => {
      lineWorkOrders[line] = workOrdersToUse
        .filter((wo) => wo.Linea === line)
        .sort((a, b) => {
          const dateA = new Date(a.Fch_Objetivo).getTime();
          const dateB = new Date(b.Fch_Objetivo).getTime();
          return dateA - dateB || a.Secuencia - b.Secuencia;
        });
    });

    return { uniqueLines, lineWorkOrders, capacity };
  }, [workOrdersToUse, workingDays, data?.capacity]);

  // ⬇️⬇️⬇️ AÑADIR LOADING STATE PARA CAPACITY ⬇️⬇️⬇️
  if (!isCapacityReady || !data?.capacity?.length) {
    return (
      <div className="flex items-center justify-center h-64 w-full">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-2"></div>
          <span className="text-gray-600 text-sm">Cargando capacidades...</span>
        </div>
      </div>
    );
  }

  if (!processedData) {
    return (
      <div className="flex items-center justify-center h-64 w-full">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-2"></div>
          <span className="text-gray-600 text-sm">
            {workOrdersToUse.length === 0 
              ? "No hay órdenes de trabajo para mostrar" 
              : "Cargando datos y configurando calendario..."
            }
          </span>
          <div className="mt-2 text-xs text-gray-500 text-center">
            <div>Props: {filteredWorkOrders?.length || 0} fabricaciones</div>
            <div>Hook: {data?.workOrders?.length || 0} fabricaciones</div>
            <div>Días laborables: {workingDays.length}</div>
          </div>
        </div>
      </div>
    );
  }

  const { uniqueLines, lineWorkOrders, capacity } = processedData;

  return (
    <div className="w-full bg-white shadow-sm rounded-lg" style={{ isolation: 'isolate' }}>
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-800">Planificación</h2>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{workOrdersToUse.length}</span> fabricaciones
            {filterActive && <span className="text-blue-600 ml-2">(filtradas)</span>}
            {selectedWOs.length > 0 && (
              <span className="ml-2">
                - <span className="font-medium">{selectedWOs.length}</span> seleccionadas
              </span>
            )}
          </div>
          <div className="text-xs text-green-600 flex items-center space-x-1">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>Guardado automático activo</span>
          </div>
        </div>
        {ControlButtons}
      </div>

      <div className="flex" style={{ maxHeight: "calc(100vh - 200px)" }}>
        {/* Columna fija izquierda */}
        <div className="flex-none w-32 z-10 shadow-md">
          <div className="p-3 border-r border-b border-gray-200 bg-white font-medium text-gray-700 flex items-center justify-center h-[49px]">
            Líneas
          </div>
          {uniqueLines.map((line) => (
            <div key={line} className="border-r border-b border-gray-200 bg-white font-medium text-gray-700 flex items-center justify-end pr-4 p-3" style={{ minHeight: "60px" }}>
              {line}
            </div>
          ))}
        </div>

        {/* Área scrollable */}
        <div className="overflow-auto flex-1">
          <div className="min-w-max">
            <div className="flex border-b border-gray-200 bg-gray-50">
              {workingDays.map((day) => (
                <DayHeader key={day} day={day} zoomLevel={zoomLevel} />
              ))}
            </div>
            {uniqueLines.map((line) => (
              <div key={line} className="flex border-b border-gray-100 hover:bg-gray-50" style={{ minHeight: "60px" }}>
                <GanttDayScroller
                  days={workingDays}
                  line={line}
                  workOrders={lineWorkOrders[line]}
                  capacity={capacity}
                  zoomLevel={zoomLevel}
                  selectedWOs={selectedWOs}
                  setSelectedWOs={setSelectedWOs}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(GanttWOs);