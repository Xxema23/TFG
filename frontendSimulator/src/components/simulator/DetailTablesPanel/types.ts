// components/DetailTablesPanel/Types.ts
import { IFabricacionConHoras } from '../../../interfaces/IFabricacionConHoras'; // ✅ AGREGAR IMPORT

export interface WorkOrder {
  id: string;
  numWO: string;
  equipo: string;
  secuencia: string | number; // Changed from number to string | number
  linea: string;
  numDoc: string | null; // 🔧 Permitir null
  tipDoc: string | null; // 🔧 Permitir null
  estadoWO: string;
  fchObjetivo: string;
  fchAcuse: string | null; // 🔧 Permitir null
  fchAlbarAn: string | null; // 🔧 Permitir null
  importe: number; // 🔧 Permitir null (ya estaba como number)
  cshTotal: number;
  // ✅ NUEVA: Información de palets
  paletInfo?: {
    num_de_palet: string | null; // 🔧 Permitir null
    palet_2nd_number?: string | null;
  } | null;
  
  // ✅ NUEVAS PROPIEDADES PARA SINCRONIZACIÓN
  cliente?: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  precioUnitario?: number;
  originalIndex?: number;
  _originalData?: IFabricacionConHoras;
}

export interface ComponentAvailability {
  [componentId: string]: {
    [woId: string]: {
      value: string | number;
      stock?: number;
      pedido?: number;
      fchEntrega?: string;
      disponible?: number;
    };
  };
}

export interface DetailTablesPanelProps {
  workOrders?: WorkOrder[];
  workOrderColors?: Record<string, string>;
  availableComponents?: string[];
  componentAvailability?: ComponentAvailability;
  onReorderWO?: (reorderedWOIds: string[]) => void;
  selectedWorkOrderIds?: string[];
  availableWOs?: string[];
  
  // ✅ PROPS PARA SINCRONIZACIÓN ACTUALIZADAS
  filteredFabrications?: IFabricacionConHoras[];  // Las mismas fabricaciones filtradas del Gantt
  useFilteredData?: boolean;  // Flag para usar datos filtrados o todos
  defaultLineFilter?: string; // ✅ NUEVA PROP AÑADIDA
  
  // Función para notificar actualizaciones exitosas (opcional)
  onWorkOrderUpdated?: (woId: string, field: string, value: any) => void;
}

export interface DragState {
  isDragging: boolean;
  draggedWO: string | null;
  draggedOverWO: string | null;
}

export interface TableSyncOptions {
  workOrders: WorkOrder[];
  selectedWorkOrderIds: string[];
  availableWOs: string[];
  localOrderedWOIds: string[];
  getOrderedWOIds: () => string[];
}